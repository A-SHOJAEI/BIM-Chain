package audit

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"

	"github.com/bim-chain/fabric-bim-governance/chaincode/shared"
)

// AuditContract provides functions for managing BIM audit trails on the ledger.
type AuditContract struct {
	contractapi.Contract
}

// RecordChange stores an immutable audit record of a BIM element change.
// Composite key format: AUDIT~{modelId}~{timestamp}~{txId}
func (c *AuditContract) RecordChange(ctx contractapi.TransactionContextInterface, recordJSON string) error {
	stub := ctx.GetStub()

	var record shared.AuditRecord
	if err := json.Unmarshal([]byte(recordJSON), &record); err != nil {
		return fmt.Errorf("failed to parse record JSON: %w", err)
	}

	// Validate required fields
	if record.ModelID == "" {
		return fmt.Errorf("modelId is required and cannot be empty")
	}
	if record.ElementUniqueID == "" {
		return fmt.Errorf("elementUniqueId is required and cannot be empty")
	}
	if record.ElementHash == "" {
		return fmt.Errorf("elementHash is required and cannot be empty")
	}
	if record.ChangeType != shared.ChangeTypeAdd &&
		record.ChangeType != shared.ChangeTypeModify &&
		record.ChangeType != shared.ChangeTypeDelete {
		return fmt.Errorf("changeType must be ADD, MODIFY, or DELETE, got %q", record.ChangeType)
	}

	// Populate TxID from the transaction
	record.TxID = stub.GetTxID()

	// Create composite key
	key, err := stub.CreateCompositeKey("AUDIT", []string{record.ModelID, record.Timestamp, record.TxID})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %w", err)
	}

	// Check immutability: record must not already exist
	existing, err := stub.GetState(key)
	if err != nil {
		return fmt.Errorf("failed to check existing state: %w", err)
	}
	if existing != nil {
		return fmt.Errorf("audit record already exists for key %s", key)
	}

	// Ensure docType is set
	record.DocType = "audit"

	// Store the record
	data, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal record: %w", err)
	}
	if err := stub.PutState(key, data); err != nil {
		return fmt.Errorf("failed to store record: %w", err)
	}

	// Emit chaincode event
	eventPayload, _ := json.Marshal(map[string]string{
		"modelId":         record.ModelID,
		"elementUniqueId": record.ElementUniqueID,
		"changeType":      string(record.ChangeType),
		"txId":            record.TxID,
	})
	if err := stub.SetEvent("AuditRecorded", eventPayload); err != nil {
		return fmt.Errorf("failed to set event: %w", err)
	}

	return nil
}

// QueryByModel returns all audit records for a given model using composite key prefix matching.
func (c *AuditContract) QueryByModel(ctx contractapi.TransactionContextInterface, modelID string) ([]*shared.AuditRecord, error) {
	stub := ctx.GetStub()

	iter, err := stub.GetStateByPartialCompositeKey("AUDIT", []string{modelID})
	if err != nil {
		return nil, fmt.Errorf("failed to query by model: %w", err)
	}
	defer iter.Close()

	var records []*shared.AuditRecord
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate results: %w", err)
		}
		var record shared.AuditRecord
		if err := json.Unmarshal(kv.Value, &record); err != nil {
			return nil, fmt.Errorf("failed to unmarshal record: %w", err)
		}
		records = append(records, &record)
	}

	if records == nil {
		records = []*shared.AuditRecord{}
	}

	return records, nil
}

// QueryByElement returns all audit records for a given element.
// Uses composite key iteration and filters by elementUniqueId.
func (c *AuditContract) QueryByElement(ctx contractapi.TransactionContextInterface, elementUniqueID string) ([]*shared.AuditRecord, error) {
	stub := ctx.GetStub()

	// Iterate all AUDIT keys and filter by element
	iter, err := stub.GetStateByPartialCompositeKey("AUDIT", []string{})
	if err != nil {
		return nil, fmt.Errorf("failed to query by element: %w", err)
	}
	defer iter.Close()

	var records []*shared.AuditRecord
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate results: %w", err)
		}
		var record shared.AuditRecord
		if err := json.Unmarshal(kv.Value, &record); err != nil {
			return nil, fmt.Errorf("failed to unmarshal record: %w", err)
		}
		if record.ElementUniqueID == elementUniqueID {
			records = append(records, &record)
		}
	}

	if records == nil {
		records = []*shared.AuditRecord{}
	}

	// Sort chronologically
	sort.Slice(records, func(i, j int) bool {
		return records[i].Timestamp < records[j].Timestamp
	})

	return records, nil
}

// QueryByTimeRange returns records within a timestamp range (inclusive on both ends).
func (c *AuditContract) QueryByTimeRange(ctx contractapi.TransactionContextInterface, modelID string, startTime string, endTime string) ([]*shared.AuditRecord, error) {
	stub := ctx.GetStub()

	iter, err := stub.GetStateByPartialCompositeKey("AUDIT", []string{modelID})
	if err != nil {
		return nil, fmt.Errorf("failed to query by time range: %w", err)
	}
	defer iter.Close()

	var records []*shared.AuditRecord
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate results: %w", err)
		}
		var record shared.AuditRecord
		if err := json.Unmarshal(kv.Value, &record); err != nil {
			return nil, fmt.Errorf("failed to unmarshal record: %w", err)
		}
		if record.Timestamp >= startTime && record.Timestamp <= endTime {
			records = append(records, &record)
		}
	}

	if records == nil {
		records = []*shared.AuditRecord{}
	}

	sort.Slice(records, func(i, j int) bool {
		return records[i].Timestamp < records[j].Timestamp
	})

	return records, nil
}

// RecordModelVersion stores a hash-linked model version snapshot.
// Key format: VERSION~{modelId}~{versionNumber}
func (c *AuditContract) RecordModelVersion(ctx contractapi.TransactionContextInterface, versionJSON string) error {
	stub := ctx.GetStub()

	var version shared.ModelVersion
	if err := json.Unmarshal([]byte(versionJSON), &version); err != nil {
		return fmt.Errorf("failed to parse version JSON: %w", err)
	}

	if version.ModelID == "" {
		return fmt.Errorf("modelId is required")
	}
	if version.MerkleRootHash == "" {
		return fmt.Errorf("merkleRootHash is required")
	}

	version.DocType = "modelVersion"

	key, err := stub.CreateCompositeKey("VERSION", []string{version.ModelID, fmt.Sprintf("%d", version.VersionNumber)})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %w", err)
	}

	data, err := json.Marshal(version)
	if err != nil {
		return fmt.Errorf("failed to marshal version: %w", err)
	}

	return stub.PutState(key, data)
}

// GetModelVersion retrieves a specific model version.
func (c *AuditContract) GetModelVersion(ctx contractapi.TransactionContextInterface, modelID string, versionNumber int) (*shared.ModelVersion, error) {
	stub := ctx.GetStub()

	key, err := stub.CreateCompositeKey("VERSION", []string{modelID, fmt.Sprintf("%d", versionNumber)})
	if err != nil {
		return nil, fmt.Errorf("failed to create composite key: %w", err)
	}

	data, err := stub.GetState(key)
	if err != nil {
		return nil, fmt.Errorf("failed to get state: %w", err)
	}
	if data == nil {
		return nil, fmt.Errorf("model version %s v%d not found", modelID, versionNumber)
	}

	var version shared.ModelVersion
	if err := json.Unmarshal(data, &version); err != nil {
		return nil, fmt.Errorf("failed to unmarshal version: %w", err)
	}

	return &version, nil
}
