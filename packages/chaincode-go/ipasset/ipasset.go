package ipasset

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"

	"github.com/bim-chain/fabric-bim-governance/chaincode/shared"
)

// IPAssetContract provides functions for IP attribution tracking on the ledger.
type IPAssetContract struct {
	contractapi.Contract
}

// RegisterElement registers a new IP-tracked BIM element.
// Key format: IP~{elementUniqueId}
func (c *IPAssetContract) RegisterElement(ctx contractapi.TransactionContextInterface, ipRecordJSON string) error {
	stub := ctx.GetStub()

	var record shared.IPRecord
	if err := json.Unmarshal([]byte(ipRecordJSON), &record); err != nil {
		return fmt.Errorf("failed to parse IP record JSON: %w", err)
	}

	if record.ElementUniqueID == "" {
		return fmt.Errorf("elementUniqueId is required")
	}

	record.DocType = "ip"

	key, err := stub.CreateCompositeKey("IP", []string{record.ElementUniqueID})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %w", err)
	}

	// Check if element is already registered
	existing, err := stub.GetState(key)
	if err != nil {
		return fmt.Errorf("failed to check existing state: %w", err)
	}
	if existing != nil {
		return fmt.Errorf("element %s is already registered", record.ElementUniqueID)
	}

	// Initialize contributions if nil
	if record.Contributions == nil {
		record.Contributions = []shared.Contribution{}
	}

	data, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal IP record: %w", err)
	}

	return stub.PutState(key, data)
}

// RecordContribution adds a contribution record to an existing IP-tracked element.
func (c *IPAssetContract) RecordContribution(ctx contractapi.TransactionContextInterface, elementUniqueID string, contributionJSON string) error {
	stub := ctx.GetStub()

	key, err := stub.CreateCompositeKey("IP", []string{elementUniqueID})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %w", err)
	}

	existing, err := stub.GetState(key)
	if err != nil {
		return fmt.Errorf("failed to get state: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("element %s not found", elementUniqueID)
	}

	var record shared.IPRecord
	if err := json.Unmarshal(existing, &record); err != nil {
		return fmt.Errorf("failed to unmarshal existing record: %w", err)
	}

	var contribution shared.Contribution
	if err := json.Unmarshal([]byte(contributionJSON), &contribution); err != nil {
		return fmt.Errorf("failed to parse contribution JSON: %w", err)
	}

	// Check for duplicate contribution (same changeHash)
	for _, c := range record.Contributions {
		if c.ChangeHash == contribution.ChangeHash {
			return fmt.Errorf("duplicate contribution: changeHash %s already recorded", contribution.ChangeHash)
		}
	}

	record.Contributions = append(record.Contributions, contribution)

	data, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal updated record: %w", err)
	}

	return stub.PutState(key, data)
}

// QueryByCreator returns all IP records created by a given user.
func (c *IPAssetContract) QueryByCreator(ctx contractapi.TransactionContextInterface, userID string) ([]*shared.IPRecord, error) {
	stub := ctx.GetStub()

	iter, err := stub.GetStateByPartialCompositeKey("IP", []string{})
	if err != nil {
		return nil, fmt.Errorf("failed to query: %w", err)
	}
	defer iter.Close()

	var records []*shared.IPRecord
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate: %w", err)
		}
		var record shared.IPRecord
		if err := json.Unmarshal(kv.Value, &record); err != nil {
			continue
		}
		if record.CreatorUserID == userID {
			records = append(records, &record)
		}
	}

	if records == nil {
		records = []*shared.IPRecord{}
	}
	return records, nil
}

// QueryByOrg returns all IP records belonging to a given organization.
func (c *IPAssetContract) QueryByOrg(ctx contractapi.TransactionContextInterface, orgMSPID string) ([]*shared.IPRecord, error) {
	stub := ctx.GetStub()

	iter, err := stub.GetStateByPartialCompositeKey("IP", []string{})
	if err != nil {
		return nil, fmt.Errorf("failed to query: %w", err)
	}
	defer iter.Close()

	var records []*shared.IPRecord
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate: %w", err)
		}
		var record shared.IPRecord
		if err := json.Unmarshal(kv.Value, &record); err != nil {
			continue
		}
		if record.CreatorOrgMSPID == orgMSPID {
			records = append(records, &record)
		}
	}

	if records == nil {
		records = []*shared.IPRecord{}
	}
	return records, nil
}

// TransferOwnership transfers element ownership to a new user/org.
func (c *IPAssetContract) TransferOwnership(ctx contractapi.TransactionContextInterface, elementUniqueID string, newOwnerID string, newOwnerOrg string) error {
	stub := ctx.GetStub()

	key, err := stub.CreateCompositeKey("IP", []string{elementUniqueID})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %w", err)
	}

	existing, err := stub.GetState(key)
	if err != nil {
		return fmt.Errorf("failed to get state: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("element %s not found", elementUniqueID)
	}

	var record shared.IPRecord
	if err := json.Unmarshal(existing, &record); err != nil {
		return fmt.Errorf("failed to unmarshal record: %w", err)
	}

	record.CreatorUserID = newOwnerID
	record.CreatorOrgMSPID = newOwnerOrg

	data, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal record: %w", err)
	}

	return stub.PutState(key, data)
}

// GetContributionSummary returns contribution count per org for an element.
func (c *IPAssetContract) GetContributionSummary(ctx contractapi.TransactionContextInterface, elementUniqueID string) (map[string]int, error) {
	stub := ctx.GetStub()

	key, err := stub.CreateCompositeKey("IP", []string{elementUniqueID})
	if err != nil {
		return nil, fmt.Errorf("failed to create composite key: %w", err)
	}

	existing, err := stub.GetState(key)
	if err != nil {
		return nil, fmt.Errorf("failed to get state: %w", err)
	}
	if existing == nil {
		return nil, fmt.Errorf("element %s not found", elementUniqueID)
	}

	var record shared.IPRecord
	if err := json.Unmarshal(existing, &record); err != nil {
		return nil, fmt.Errorf("failed to unmarshal record: %w", err)
	}

	summary := make(map[string]int)
	for _, c := range record.Contributions {
		summary[c.OrgMSPID]++
	}

	return summary, nil
}
