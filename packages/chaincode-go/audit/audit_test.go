package audit

import (
	"encoding/json"
	"testing"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/bim-chain/fabric-bim-governance/chaincode/shared"
	"github.com/bim-chain/fabric-bim-governance/chaincode/shared/mocks"
)

func setupTest() (*AuditContract, *contractapi.TransactionContext, *mocks.MockStub) {
	contract := new(AuditContract)
	stub := mocks.NewMockStub()
	ctx := new(contractapi.TransactionContext)
	ctx.SetStub(stub)
	return contract, ctx, stub
}

func makeAuditRecordJSON(modelID, elementID, changeType, hash, userID, orgID, ts string) string {
	record := shared.AuditRecord{
		DocType:         "audit",
		ModelID:         modelID,
		ElementUniqueID: elementID,
		ChangeType:      shared.ChangeType(changeType),
		ElementHash:     hash,
		UserID:          userID,
		OrgMSPID:        orgID,
		Timestamp:       ts,
	}
	data, _ := json.Marshal(record)
	return string(data)
}

func TestRecordChange_ValidInput(t *testing.T) {
	contract, ctx, stub := setupTest()
	recordJSON := makeAuditRecordJSON("model-001", "elem-abc", "ADD", "sha256:abc123", "user1", "Org1MSP", "2025-01-15T10:30:00Z")

	err := contract.RecordChange(ctx, recordJSON)
	require.NoError(t, err)

	// Verify record is stored in state with composite key format: AUDIT~{modelId}~{timestamp}~{txId}
	expectedKey, _ := stub.CreateCompositeKey("AUDIT", []string{"model-001", "2025-01-15T10:30:00Z", stub.TxIDValue})
	val, err := stub.GetState(expectedKey)
	require.NoError(t, err)
	require.NotNil(t, val, "record should be stored in state")

	// Verify the stored record has TxID populated
	var stored shared.AuditRecord
	err = json.Unmarshal(val, &stored)
	require.NoError(t, err)
	assert.Equal(t, stub.TxIDValue, stored.TxID)
	assert.Equal(t, "model-001", stored.ModelID)
	assert.Equal(t, "elem-abc", stored.ElementUniqueID)
}

func TestRecordChange_MissingModelID(t *testing.T) {
	contract, ctx, _ := setupTest()
	recordJSON := makeAuditRecordJSON("", "elem-abc", "ADD", "sha256:abc123", "user1", "Org1MSP", "2025-01-15T10:30:00Z")

	err := contract.RecordChange(ctx, recordJSON)
	require.Error(t, err, "should reject record with empty ModelID")
	assert.Contains(t, err.Error(), "modelId")
}

func TestRecordChange_MissingElementID(t *testing.T) {
	contract, ctx, _ := setupTest()
	recordJSON := makeAuditRecordJSON("model-001", "", "ADD", "sha256:abc123", "user1", "Org1MSP", "2025-01-15T10:30:00Z")

	err := contract.RecordChange(ctx, recordJSON)
	require.Error(t, err, "should reject record with empty ElementUniqueID")
	assert.Contains(t, err.Error(), "elementUniqueId")
}

func TestRecordChange_MissingHash(t *testing.T) {
	contract, ctx, _ := setupTest()
	recordJSON := makeAuditRecordJSON("model-001", "elem-abc", "ADD", "", "user1", "Org1MSP", "2025-01-15T10:30:00Z")

	err := contract.RecordChange(ctx, recordJSON)
	require.Error(t, err, "should reject record with empty ElementHash")
	assert.Contains(t, err.Error(), "elementHash")
}

func TestRecordChange_InvalidChangeType(t *testing.T) {
	contract, ctx, _ := setupTest()
	recordJSON := makeAuditRecordJSON("model-001", "elem-abc", "INVALID", "sha256:abc123", "user1", "Org1MSP", "2025-01-15T10:30:00Z")

	err := contract.RecordChange(ctx, recordJSON)
	require.Error(t, err, "should reject record with invalid change type")
	assert.Contains(t, err.Error(), "changeType")
}

func TestRecordChange_EmitsChaincodeEvent(t *testing.T) {
	contract, ctx, stub := setupTest()
	recordJSON := makeAuditRecordJSON("model-001", "elem-abc", "ADD", "sha256:abc123", "user1", "Org1MSP", "2025-01-15T10:30:00Z")

	err := contract.RecordChange(ctx, recordJSON)
	require.NoError(t, err)

	// Verify SetEvent was called with "AuditRecorded"
	eventPayload, ok := stub.Events["AuditRecorded"]
	assert.True(t, ok, "should emit AuditRecorded event")
	assert.NotNil(t, eventPayload)

	// Verify event payload contains modelId and elementUniqueId
	var eventData map[string]string
	err = json.Unmarshal(eventPayload, &eventData)
	require.NoError(t, err)
	assert.Equal(t, "model-001", eventData["modelId"])
	assert.Equal(t, "elem-abc", eventData["elementUniqueId"])
}

func TestQueryByModel_ReturnsAllRecords(t *testing.T) {
	contract, ctx, stub := setupTest()

	// Store 3 records for model-A
	for i, ts := range []string{"2025-01-15T10:00:00Z", "2025-01-15T11:00:00Z", "2025-01-15T12:00:00Z"} {
		stub.TxIDValue = "tx-a-" + string(rune('0'+i))
		recordJSON := makeAuditRecordJSON("model-A", "elem-"+string(rune('a'+i)), "ADD", "hash-"+string(rune('a'+i)), "user1", "Org1MSP", ts)
		err := contract.RecordChange(ctx, recordJSON)
		require.NoError(t, err)
	}

	// Store 2 records for model-B
	for i, ts := range []string{"2025-01-15T10:00:00Z", "2025-01-15T11:00:00Z"} {
		stub.TxIDValue = "tx-b-" + string(rune('0'+i))
		recordJSON := makeAuditRecordJSON("model-B", "elem-b-"+string(rune('a'+i)), "ADD", "hash-b-"+string(rune('a'+i)), "user1", "Org1MSP", ts)
		err := contract.RecordChange(ctx, recordJSON)
		require.NoError(t, err)
	}

	// Query model-A, expect exactly 3
	results, err := contract.QueryByModel(ctx, "model-A")
	require.NoError(t, err)
	assert.Len(t, results, 3)
}

func TestQueryByModel_EmptyResult(t *testing.T) {
	contract, ctx, _ := setupTest()

	results, err := contract.QueryByModel(ctx, "nonexistent-model")
	require.NoError(t, err)
	assert.Empty(t, results, "should return empty array for nonexistent model")
}

func TestQueryByElement_ReturnsHistory(t *testing.T) {
	contract, ctx, stub := setupTest()

	// Store 3 records for the same element: ADD, MODIFY, MODIFY
	changes := []struct {
		changeType string
		hash       string
		ts         string
		txID       string
	}{
		{"ADD", "hash-v1", "2025-01-15T10:00:00Z", "tx-001"},
		{"MODIFY", "hash-v2", "2025-01-15T11:00:00Z", "tx-002"},
		{"MODIFY", "hash-v3", "2025-01-15T12:00:00Z", "tx-003"},
	}

	for _, c := range changes {
		stub.TxIDValue = c.txID
		recordJSON := makeAuditRecordJSON("model-001", "elem-abc", c.changeType, c.hash, "user1", "Org1MSP", c.ts)
		err := contract.RecordChange(ctx, recordJSON)
		require.NoError(t, err)
	}

	// Query by element
	results, err := contract.QueryByElement(ctx, "elem-abc")
	require.NoError(t, err)
	assert.Len(t, results, 3)

	// Verify chronological order
	for i := 1; i < len(results); i++ {
		assert.True(t, results[i].Timestamp >= results[i-1].Timestamp, "results should be in chronological order")
	}
}

func TestQueryByTimeRange_FiltersCorrectly(t *testing.T) {
	contract, ctx, stub := setupTest()

	// Store records at T1 through T5
	timestamps := []string{
		"2025-01-15T08:00:00Z",
		"2025-01-15T09:00:00Z",
		"2025-01-15T10:00:00Z",
		"2025-01-15T11:00:00Z",
		"2025-01-15T12:00:00Z",
	}
	for i, ts := range timestamps {
		stub.TxIDValue = "tx-" + string(rune('0'+i))
		recordJSON := makeAuditRecordJSON("model-001", "elem-"+string(rune('a'+i)), "ADD", "hash-"+string(rune('a'+i)), "user1", "Org1MSP", ts)
		err := contract.RecordChange(ctx, recordJSON)
		require.NoError(t, err)
	}

	// Query T2-T4 (index 1-3 inclusive)
	results, err := contract.QueryByTimeRange(ctx, "model-001", "2025-01-15T09:00:00Z", "2025-01-15T11:00:00Z")
	require.NoError(t, err)
	assert.Len(t, results, 3, "should return records at T2, T3, T4")
}

func TestGetModelVersion_RecordsSnapshot(t *testing.T) {
	contract, ctx, _ := setupTest()

	version := shared.ModelVersion{
		DocType:        "modelVersion",
		ModelID:        "model-001",
		VersionNumber:  1,
		MerkleRootHash: "sha256:merkle-root-hash-v1",
		PreviousHash:   "",
		UserID:         "user1",
		OrgMSPID:       "Org1MSP",
		Timestamp:      "2025-01-15T10:00:00Z",
		ElementCount:   42,
		SyncAction:     "SaveToLocal",
	}
	versionJSON, _ := json.Marshal(version)

	err := contract.RecordModelVersion(ctx, string(versionJSON))
	require.NoError(t, err)

	// Query it back
	result, err := contract.GetModelVersion(ctx, "model-001", 1)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "sha256:merkle-root-hash-v1", result.MerkleRootHash)
	assert.Equal(t, 1, result.VersionNumber)
	assert.Equal(t, 42, result.ElementCount)
}

func TestGetModelVersion_ChainValidation(t *testing.T) {
	contract, ctx, stub := setupTest()

	// Version 1
	v1 := shared.ModelVersion{
		DocType:        "modelVersion",
		ModelID:        "model-001",
		VersionNumber:  1,
		MerkleRootHash: "sha256:merkle-root-v1",
		PreviousHash:   "",
		UserID:         "user1",
		OrgMSPID:       "Org1MSP",
		Timestamp:      "2025-01-15T10:00:00Z",
		ElementCount:   10,
		SyncAction:     "SaveToLocal",
	}
	v1JSON, _ := json.Marshal(v1)
	stub.TxIDValue = "tx-v1"
	err := contract.RecordModelVersion(ctx, string(v1JSON))
	require.NoError(t, err)

	// Version 2 references version 1's hash
	v2 := shared.ModelVersion{
		DocType:        "modelVersion",
		ModelID:        "model-001",
		VersionNumber:  2,
		MerkleRootHash: "sha256:merkle-root-v2",
		PreviousHash:   "sha256:merkle-root-v1",
		UserID:         "user1",
		OrgMSPID:       "Org1MSP",
		Timestamp:      "2025-01-15T11:00:00Z",
		ElementCount:   15,
		SyncAction:     "SynchronizeWithCentral",
	}
	v2JSON, _ := json.Marshal(v2)
	stub.TxIDValue = "tx-v2"
	err = contract.RecordModelVersion(ctx, string(v2JSON))
	require.NoError(t, err)

	// Verify the hash chain
	result1, err := contract.GetModelVersion(ctx, "model-001", 1)
	require.NoError(t, err)
	result2, err := contract.GetModelVersion(ctx, "model-001", 2)
	require.NoError(t, err)

	assert.Equal(t, result1.MerkleRootHash, result2.PreviousHash, "version 2 should reference version 1's hash")
}

func TestRecordChange_InvalidJSON(t *testing.T) {
	contract, ctx, _ := setupTest()
	err := contract.RecordChange(ctx, "not valid json")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse")
}

func TestRecordModelVersion_MissingModelID(t *testing.T) {
	contract, ctx, _ := setupTest()
	v := shared.ModelVersion{MerkleRootHash: "hash"}
	data, _ := json.Marshal(v)
	err := contract.RecordModelVersion(ctx, string(data))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "modelId")
}

func TestRecordModelVersion_MissingMerkleHash(t *testing.T) {
	contract, ctx, _ := setupTest()
	v := shared.ModelVersion{ModelID: "model-001"}
	data, _ := json.Marshal(v)
	err := contract.RecordModelVersion(ctx, string(data))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "merkleRootHash")
}

func TestRecordModelVersion_InvalidJSON(t *testing.T) {
	contract, ctx, _ := setupTest()
	err := contract.RecordModelVersion(ctx, "not valid json")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse")
}

func TestGetModelVersion_NotFound(t *testing.T) {
	contract, ctx, _ := setupTest()
	result, err := contract.GetModelVersion(ctx, "nonexistent", 1)
	require.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "not found")
}

func TestQueryByElement_EmptyResult(t *testing.T) {
	contract, ctx, _ := setupTest()
	results, err := contract.QueryByElement(ctx, "nonexistent-elem")
	require.NoError(t, err)
	assert.Empty(t, results)
}

func TestQueryByTimeRange_EmptyResult(t *testing.T) {
	contract, ctx, _ := setupTest()
	results, err := contract.QueryByTimeRange(ctx, "nonexistent", "2025-01-01T00:00:00Z", "2025-01-02T00:00:00Z")
	require.NoError(t, err)
	assert.Empty(t, results)
}

func TestAuditRecord_Immutability(t *testing.T) {
	contract, ctx, stub := setupTest()

	// Store first record
	stub.TxIDValue = "tx-001"
	recordJSON := makeAuditRecordJSON("model-001", "elem-abc", "ADD", "hash-v1", "user1", "Org1MSP", "2025-01-15T10:00:00Z")
	err := contract.RecordChange(ctx, recordJSON)
	require.NoError(t, err)

	// Attempt to overwrite with same key (same model, timestamp, txId)
	err = contract.RecordChange(ctx, recordJSON)
	require.Error(t, err, "should reject overwrite of existing record")
	assert.Contains(t, err.Error(), "already exists")
}
