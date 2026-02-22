package governance

import (
	"encoding/json"
	"testing"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/bim-chain/fabric-bim-governance/chaincode/shared"
	"github.com/bim-chain/fabric-bim-governance/chaincode/shared/mocks"
)

func setupTest() (*GovernanceContract, *contractapi.TransactionContext, *mocks.MockStub) {
	contract := new(GovernanceContract)
	stub := mocks.NewMockStub()
	ctx := new(contractapi.TransactionContext)
	ctx.SetStub(stub)
	return contract, ctx, stub
}

func makeProposalJSON(id, modelID, proposerID, proposerOrg, description, hash string, requiredOrgs []string) string {
	proposal := shared.GovernanceProposal{
		DocType:      "governance",
		ProposalID:   id,
		ModelID:      modelID,
		ProposerID:   proposerID,
		ProposerOrg:  proposerOrg,
		Description:  description,
		ChangeHash:   hash,
		Status:       "PROPOSED",
		RequiredOrgs: requiredOrgs,
		Approvals:    []shared.Approval{},
		Rejections:   []shared.Approval{},
		CreatedAt:    "2025-01-15T10:00:00Z",
	}
	data, _ := json.Marshal(proposal)
	return string(data)
}

func TestProposeChange_Valid(t *testing.T) {
	contract, ctx, stub := setupTest()
	proposalJSON := makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Add new section", "hash-abc", []string{"Org1MSP", "Org2MSP"})

	err := contract.ProposeChange(ctx, proposalJSON)
	require.NoError(t, err)

	// Verify key format: GOV~{proposalId}
	key, _ := stub.CreateCompositeKey("GOV", []string{"prop-001"})
	val, err := stub.GetState(key)
	require.NoError(t, err)
	require.NotNil(t, val)

	var stored shared.GovernanceProposal
	json.Unmarshal(val, &stored)
	assert.Equal(t, "PROPOSED", stored.Status)
	assert.Equal(t, "prop-001", stored.ProposalID)
}

func TestProposeChange_MissingDescription(t *testing.T) {
	contract, ctx, _ := setupTest()
	proposalJSON := makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "", "hash-abc", []string{"Org1MSP"})

	err := contract.ProposeChange(ctx, proposalJSON)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "description")
}

func TestApproveChange_SingleOrg(t *testing.T) {
	contract, ctx, stub := setupTest()

	// Create proposal requiring only 1 org
	proposalJSON := makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Change X", "hash-abc", []string{"Org1MSP"})
	contract.ProposeChange(ctx, proposalJSON)

	// Approve from Org1
	stub.CreatorBytes = []byte("Org1MSP-user")
	err := contract.ApproveChange(ctx, "prop-001", "Looks good")
	require.NoError(t, err)

	// Verify status changed to APPROVED
	key, _ := stub.CreateCompositeKey("GOV", []string{"prop-001"})
	val, _ := stub.GetState(key)
	var stored shared.GovernanceProposal
	json.Unmarshal(val, &stored)
	assert.Equal(t, "APPROVED", stored.Status)
}

func TestApproveChange_MultiOrg(t *testing.T) {
	contract, ctx, stub := setupTest()

	// Create proposal requiring Org1 + Org2
	proposalJSON := makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Change X", "hash-abc", []string{"Org1MSP", "Org2MSP"})
	contract.ProposeChange(ctx, proposalJSON)

	// Approve from Org1 -> still PROPOSED
	stub.CreatorBytes = []byte("Org1MSP-user")
	err := contract.ApproveChange(ctx, "prop-001", "Org1 approves")
	require.NoError(t, err)

	key, _ := stub.CreateCompositeKey("GOV", []string{"prop-001"})
	val, _ := stub.GetState(key)
	var stored shared.GovernanceProposal
	json.Unmarshal(val, &stored)
	assert.Equal(t, "PROPOSED", stored.Status)

	// Approve from Org2 -> APPROVED
	stub.CreatorBytes = []byte("Org2MSP-user")
	err = contract.ApproveChange(ctx, "prop-001", "Org2 approves")
	require.NoError(t, err)

	val, _ = stub.GetState(key)
	json.Unmarshal(val, &stored)
	assert.Equal(t, "APPROVED", stored.Status)
}

func TestApproveChange_DuplicateFromSameOrg(t *testing.T) {
	contract, ctx, stub := setupTest()

	proposalJSON := makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Change X", "hash-abc", []string{"Org1MSP", "Org2MSP"})
	contract.ProposeChange(ctx, proposalJSON)

	// Org1 approves twice
	stub.CreatorBytes = []byte("Org1MSP-user")
	contract.ApproveChange(ctx, "prop-001", "First approval")
	err := contract.ApproveChange(ctx, "prop-001", "Second approval")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already approved")
}

func TestApproveChange_UnauthorizedOrg(t *testing.T) {
	contract, ctx, stub := setupTest()

	proposalJSON := makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Change X", "hash-abc", []string{"Org1MSP", "Org2MSP"})
	contract.ProposeChange(ctx, proposalJSON)

	// Org3 tries to approve (not in requiredOrgs)
	stub.CreatorBytes = []byte("Org3MSP-user")
	err := contract.ApproveChange(ctx, "prop-001", "Unauthorized approval")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not authorized")
}

func TestApproveChange_AlreadyResolved(t *testing.T) {
	contract, ctx, stub := setupTest()

	// Create and fully approve
	proposalJSON := makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Change X", "hash-abc", []string{"Org1MSP"})
	contract.ProposeChange(ctx, proposalJSON)
	stub.CreatorBytes = []byte("Org1MSP-user")
	contract.ApproveChange(ctx, "prop-001", "Approved")

	// Try to approve again
	err := contract.ApproveChange(ctx, "prop-001", "Too late")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already resolved")
}

func TestRejectChange_Valid(t *testing.T) {
	contract, ctx, stub := setupTest()

	proposalJSON := makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Change X", "hash-abc", []string{"Org1MSP", "Org2MSP"})
	contract.ProposeChange(ctx, proposalJSON)

	stub.CreatorBytes = []byte("Org1MSP-user")
	err := contract.RejectChange(ctx, "prop-001", "Does not meet standards")
	require.NoError(t, err)

	key, _ := stub.CreateCompositeKey("GOV", []string{"prop-001"})
	val, _ := stub.GetState(key)
	var stored shared.GovernanceProposal
	json.Unmarshal(val, &stored)
	assert.Equal(t, "REJECTED", stored.Status)
}

func TestRejectChange_WithReason(t *testing.T) {
	contract, ctx, stub := setupTest()

	proposalJSON := makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Change X", "hash-abc", []string{"Org1MSP", "Org2MSP"})
	contract.ProposeChange(ctx, proposalJSON)

	stub.CreatorBytes = []byte("Org1MSP-user")
	err := contract.RejectChange(ctx, "prop-001", "Code violations found")
	require.NoError(t, err)

	key, _ := stub.CreateCompositeKey("GOV", []string{"prop-001"})
	val, _ := stub.GetState(key)
	var stored shared.GovernanceProposal
	json.Unmarshal(val, &stored)
	assert.Len(t, stored.Rejections, 1)
	assert.Equal(t, "Code violations found", stored.Rejections[0].Comment)
}

func TestQueryPending_FiltersByOrg(t *testing.T) {
	contract, ctx, _ := setupTest()

	// 2 proposals require Org1
	contract.ProposeChange(ctx, makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Change 1", "hash1", []string{"Org1MSP"}))
	contract.ProposeChange(ctx, makeProposalJSON("prop-002", "model-001", "user1", "Org1MSP", "Change 2", "hash2", []string{"Org1MSP", "Org2MSP"}))
	// 1 requires only Org2
	contract.ProposeChange(ctx, makeProposalJSON("prop-003", "model-001", "user1", "Org1MSP", "Change 3", "hash3", []string{"Org2MSP"}))

	results, err := contract.QueryPending(ctx, "Org1MSP")
	require.NoError(t, err)
	assert.Len(t, results, 2)
}

func TestGetProposal_Found(t *testing.T) {
	contract, ctx, _ := setupTest()
	proposalJSON := makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Change X", "hash-abc", []string{"Org1MSP"})
	contract.ProposeChange(ctx, proposalJSON)

	result, err := contract.GetProposal(ctx, "prop-001")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "prop-001", result.ProposalID)
	assert.Equal(t, "PROPOSED", result.Status)
}

func TestGetProposal_NotFound(t *testing.T) {
	contract, ctx, _ := setupTest()
	result, err := contract.GetProposal(ctx, "nonexistent")
	require.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "not found")
}

func TestProposeChange_MissingProposalID(t *testing.T) {
	contract, ctx, _ := setupTest()
	proposalJSON := makeProposalJSON("", "model-001", "user1", "Org1MSP", "A description", "hash-abc", []string{"Org1MSP"})
	err := contract.ProposeChange(ctx, proposalJSON)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "proposalId")
}

func TestProposeChange_InvalidJSON(t *testing.T) {
	contract, ctx, _ := setupTest()
	err := contract.ProposeChange(ctx, "not valid json")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse")
}

func TestApproveChange_NotFound(t *testing.T) {
	contract, ctx, stub := setupTest()
	stub.CreatorBytes = []byte("Org1MSP-user")
	err := contract.ApproveChange(ctx, "nonexistent", "comment")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestRejectChange_NotFound(t *testing.T) {
	contract, ctx, stub := setupTest()
	stub.CreatorBytes = []byte("Org1MSP-user")
	err := contract.RejectChange(ctx, "nonexistent", "reason")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestRejectChange_AlreadyResolved(t *testing.T) {
	contract, ctx, stub := setupTest()
	proposalJSON := makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Change X", "hash-abc", []string{"Org1MSP"})
	contract.ProposeChange(ctx, proposalJSON)

	// Approve first
	stub.CreatorBytes = []byte("Org1MSP-user")
	contract.ApproveChange(ctx, "prop-001", "Approved")

	// Now try to reject
	err := contract.RejectChange(ctx, "prop-001", "Too late")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already resolved")
}

func TestExtractOrgMSP_NoSeparator(t *testing.T) {
	result := extractOrgMSP([]byte("Org1MSP"))
	assert.Equal(t, "Org1MSP", result)
}

func TestQueryPending_EmptyResult(t *testing.T) {
	contract, ctx, _ := setupTest()
	results, err := contract.QueryPending(ctx, "NonExistentOrg")
	require.NoError(t, err)
	assert.Empty(t, results)
}

func TestQueryPending_ExcludesResolved(t *testing.T) {
	contract, ctx, stub := setupTest()

	// Create 3 proposals
	contract.ProposeChange(ctx, makeProposalJSON("prop-001", "model-001", "user1", "Org1MSP", "Change 1", "hash1", []string{"Org1MSP"}))
	contract.ProposeChange(ctx, makeProposalJSON("prop-002", "model-001", "user1", "Org1MSP", "Change 2", "hash2", []string{"Org1MSP"}))
	contract.ProposeChange(ctx, makeProposalJSON("prop-003", "model-001", "user1", "Org1MSP", "Change 3", "hash3", []string{"Org1MSP"}))

	// Approve prop-001
	stub.CreatorBytes = []byte("Org1MSP-user")
	contract.ApproveChange(ctx, "prop-001", "Approved")

	// Reject prop-002
	contract.RejectChange(ctx, "prop-002", "Rejected")

	// Query pending
	results, err := contract.QueryPending(ctx, "Org1MSP")
	require.NoError(t, err)
	assert.Len(t, results, 1, "should only return the 1 pending proposal")
	assert.Equal(t, "prop-003", results[0].ProposalID)
}
