package ipasset

import (
	"encoding/json"
	"testing"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/bim-chain/fabric-bim-governance/chaincode/shared"
	"github.com/bim-chain/fabric-bim-governance/chaincode/shared/mocks"
)

func setupTest() (*IPAssetContract, *contractapi.TransactionContext, *mocks.MockStub) {
	contract := new(IPAssetContract)
	stub := mocks.NewMockStub()
	ctx := new(contractapi.TransactionContext)
	ctx.SetStub(stub)
	return contract, ctx, stub
}

func makeIPRecordJSON(elementID, creatorUser, creatorOrg, ts, familyName string) string {
	record := shared.IPRecord{
		DocType:           "ip",
		ElementUniqueID:   elementID,
		CreatorUserID:     creatorUser,
		CreatorOrgMSPID:   creatorOrg,
		CreationTimestamp: ts,
		FamilyName:        familyName,
		Contributions:     []shared.Contribution{},
	}
	data, _ := json.Marshal(record)
	return string(data)
}

func makeContributionJSON(userID, orgID, ts, hash, desc string) string {
	c := shared.Contribution{
		UserID:      userID,
		OrgMSPID:    orgID,
		Timestamp:   ts,
		ChangeHash:  hash,
		Description: desc,
	}
	data, _ := json.Marshal(c)
	return string(data)
}

func TestRegisterElement_NewElement(t *testing.T) {
	contract, ctx, stub := setupTest()
	recordJSON := makeIPRecordJSON("elem-001", "architect1", "ArchitectOrgMSP", "2025-01-15T09:00:00Z", "Custom Door")

	err := contract.RegisterElement(ctx, recordJSON)
	require.NoError(t, err)

	// Verify key format: IP~{elementUniqueId}
	key, _ := stub.CreateCompositeKey("IP", []string{"elem-001"})
	val, err := stub.GetState(key)
	require.NoError(t, err)
	require.NotNil(t, val)

	var stored shared.IPRecord
	err = json.Unmarshal(val, &stored)
	require.NoError(t, err)
	assert.Equal(t, "architect1", stored.CreatorUserID)
	assert.Equal(t, "ArchitectOrgMSP", stored.CreatorOrgMSPID)
	assert.Equal(t, "2025-01-15T09:00:00Z", stored.CreationTimestamp)
}

func TestRegisterElement_AlreadyExists(t *testing.T) {
	contract, ctx, _ := setupTest()
	recordJSON := makeIPRecordJSON("elem-001", "architect1", "ArchitectOrgMSP", "2025-01-15T09:00:00Z", "Custom Door")

	err := contract.RegisterElement(ctx, recordJSON)
	require.NoError(t, err)

	// Second registration should fail
	err = contract.RegisterElement(ctx, recordJSON)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already registered")
}

func TestRegisterElement_SetsCallerAsCreator(t *testing.T) {
	contract, ctx, stub := setupTest()
	recordJSON := makeIPRecordJSON("elem-002", "user-from-json", "OrgFromJSON", "2025-01-15T09:00:00Z", "Wall")

	err := contract.RegisterElement(ctx, recordJSON)
	require.NoError(t, err)

	key, _ := stub.CreateCompositeKey("IP", []string{"elem-002"})
	val, _ := stub.GetState(key)
	var stored shared.IPRecord
	json.Unmarshal(val, &stored)

	// Creator fields should be set from the JSON input
	assert.Equal(t, "user-from-json", stored.CreatorUserID)
	assert.Equal(t, "OrgFromJSON", stored.CreatorOrgMSPID)
}

func TestRecordContribution_ValidContributor(t *testing.T) {
	contract, ctx, stub := setupTest()

	// Register element by Org1
	recordJSON := makeIPRecordJSON("elem-001", "architect1", "ArchitectOrgMSP", "2025-01-15T09:00:00Z", "Custom Door")
	err := contract.RegisterElement(ctx, recordJSON)
	require.NoError(t, err)

	// Add contribution from Org2
	contribJSON := makeContributionJSON("engineer1", "EngineerOrgMSP", "2025-01-16T11:00:00Z", "sha256:contrib1", "Updated structure")
	err = contract.RecordContribution(ctx, "elem-001", contribJSON)
	require.NoError(t, err)

	// Verify contribution is appended
	key, _ := stub.CreateCompositeKey("IP", []string{"elem-001"})
	val, _ := stub.GetState(key)
	var stored shared.IPRecord
	json.Unmarshal(val, &stored)
	assert.Len(t, stored.Contributions, 1)
	assert.Equal(t, "engineer1", stored.Contributions[0].UserID)
	assert.Equal(t, "EngineerOrgMSP", stored.Contributions[0].OrgMSPID)
}

func TestRecordContribution_ElementNotFound(t *testing.T) {
	contract, ctx, _ := setupTest()

	contribJSON := makeContributionJSON("engineer1", "EngineerOrgMSP", "2025-01-16T11:00:00Z", "sha256:contrib1", "")
	err := contract.RecordContribution(ctx, "nonexistent-elem", contribJSON)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestRecordContribution_DuplicateContribution(t *testing.T) {
	contract, ctx, _ := setupTest()

	recordJSON := makeIPRecordJSON("elem-001", "architect1", "ArchitectOrgMSP", "2025-01-15T09:00:00Z", "Door")
	contract.RegisterElement(ctx, recordJSON)

	// Same contribution twice with identical changeHash
	contribJSON := makeContributionJSON("engineer1", "EngineerOrgMSP", "2025-01-16T11:00:00Z", "sha256:same-hash", "")
	err := contract.RecordContribution(ctx, "elem-001", contribJSON)
	require.NoError(t, err)

	err = contract.RecordContribution(ctx, "elem-001", contribJSON)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "duplicate")
}

func TestQueryByCreator_ReturnsOwnedElements(t *testing.T) {
	contract, ctx, _ := setupTest()

	// Register 3 elements by user-A
	for _, id := range []string{"elem-a1", "elem-a2", "elem-a3"} {
		contract.RegisterElement(ctx, makeIPRecordJSON(id, "user-A", "Org1MSP", "2025-01-15T09:00:00Z", "Family"))
	}
	// Register 2 by user-B
	for _, id := range []string{"elem-b1", "elem-b2"} {
		contract.RegisterElement(ctx, makeIPRecordJSON(id, "user-B", "Org1MSP", "2025-01-15T09:00:00Z", "Family"))
	}

	results, err := contract.QueryByCreator(ctx, "user-A")
	require.NoError(t, err)
	assert.Len(t, results, 3)
}

func TestQueryByOrg_ReturnsOrgElements(t *testing.T) {
	contract, ctx, _ := setupTest()

	// Register elements from different orgs
	contract.RegisterElement(ctx, makeIPRecordJSON("elem-arch1", "user1", "ArchitectOrgMSP", "2025-01-15T09:00:00Z", "Door"))
	contract.RegisterElement(ctx, makeIPRecordJSON("elem-arch2", "user2", "ArchitectOrgMSP", "2025-01-15T10:00:00Z", "Window"))
	contract.RegisterElement(ctx, makeIPRecordJSON("elem-eng1", "user3", "EngineerOrgMSP", "2025-01-15T11:00:00Z", "Beam"))

	results, err := contract.QueryByOrg(ctx, "ArchitectOrgMSP")
	require.NoError(t, err)
	assert.Len(t, results, 2)
}

func TestTransferOwnership_Authorized(t *testing.T) {
	contract, ctx, stub := setupTest()

	recordJSON := makeIPRecordJSON("elem-001", "original-owner", "Org1MSP", "2025-01-15T09:00:00Z", "Door")
	contract.RegisterElement(ctx, recordJSON)

	// Transfer
	err := contract.TransferOwnership(ctx, "elem-001", "new-owner", "Org2MSP")
	require.NoError(t, err)

	// Verify new creator
	key, _ := stub.CreateCompositeKey("IP", []string{"elem-001"})
	val, _ := stub.GetState(key)
	var stored shared.IPRecord
	json.Unmarshal(val, &stored)
	assert.Equal(t, "new-owner", stored.CreatorUserID)
	assert.Equal(t, "Org2MSP", stored.CreatorOrgMSPID)
}

func TestTransferOwnership_NotOwner(t *testing.T) {
	contract, ctx, _ := setupTest()

	// Element doesn't exist - should fail
	err := contract.TransferOwnership(ctx, "nonexistent", "new-owner", "Org2MSP")
	require.Error(t, err)
}

func TestRegisterElement_MissingElementID(t *testing.T) {
	contract, ctx, _ := setupTest()
	recordJSON := makeIPRecordJSON("", "architect1", "ArchitectOrgMSP", "2025-01-15T09:00:00Z", "Door")
	err := contract.RegisterElement(ctx, recordJSON)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "elementUniqueId")
}

func TestRegisterElement_InvalidJSON(t *testing.T) {
	contract, ctx, _ := setupTest()
	err := contract.RegisterElement(ctx, "not valid json")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse")
}

func TestRecordContribution_InvalidJSON(t *testing.T) {
	contract, ctx, _ := setupTest()
	recordJSON := makeIPRecordJSON("elem-001", "architect1", "ArchitectOrgMSP", "2025-01-15T09:00:00Z", "Door")
	contract.RegisterElement(ctx, recordJSON)

	err := contract.RecordContribution(ctx, "elem-001", "not valid json")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse")
}

func TestGetContributionSummary_NotFound(t *testing.T) {
	contract, ctx, _ := setupTest()
	result, err := contract.GetContributionSummary(ctx, "nonexistent")
	require.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "not found")
}

func TestTransferOwnership_ElementNotFound(t *testing.T) {
	contract, ctx, _ := setupTest()
	err := contract.TransferOwnership(ctx, "nonexistent", "new-owner", "Org2MSP")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestQueryByCreator_EmptyResult(t *testing.T) {
	contract, ctx, _ := setupTest()
	results, err := contract.QueryByCreator(ctx, "nonexistent-user")
	require.NoError(t, err)
	assert.Empty(t, results)
}

func TestQueryByOrg_EmptyResult(t *testing.T) {
	contract, ctx, _ := setupTest()
	results, err := contract.QueryByOrg(ctx, "NonExistentOrg")
	require.NoError(t, err)
	assert.Empty(t, results)
}

func TestGetContributionSummary(t *testing.T) {
	contract, ctx, _ := setupTest()

	// Register element
	recordJSON := makeIPRecordJSON("elem-001", "architect1", "ArchitectOrgMSP", "2025-01-15T09:00:00Z", "Door")
	contract.RegisterElement(ctx, recordJSON)

	// Add 5 contributions from 3 orgs
	contributions := []struct {
		user string
		org  string
		hash string
	}{
		{"user1", "ArchitectOrgMSP", "hash1"},
		{"user2", "EngineerOrgMSP", "hash2"},
		{"user3", "EngineerOrgMSP", "hash3"},
		{"user4", "ContractorOrgMSP", "hash4"},
		{"user5", "ArchitectOrgMSP", "hash5"},
	}
	for _, c := range contributions {
		contribJSON := makeContributionJSON(c.user, c.org, "2025-01-16T10:00:00Z", c.hash, "")
		err := contract.RecordContribution(ctx, "elem-001", contribJSON)
		require.NoError(t, err)
	}

	summary, err := contract.GetContributionSummary(ctx, "elem-001")
	require.NoError(t, err)
	assert.Equal(t, 2, summary["ArchitectOrgMSP"])
	assert.Equal(t, 2, summary["EngineerOrgMSP"])
	assert.Equal(t, 1, summary["ContractorOrgMSP"])
}
