package governance

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"

	"github.com/bim-chain/fabric-bim-governance/chaincode/shared"
)

// GovernanceContract provides functions for multi-org approval workflows on the ledger.
type GovernanceContract struct {
	contractapi.Contract
}

// ProposeChange creates a new governance proposal.
// Key format: GOV~{proposalId}
func (c *GovernanceContract) ProposeChange(ctx contractapi.TransactionContextInterface, proposalJSON string) error {
	stub := ctx.GetStub()

	var proposal shared.GovernanceProposal
	if err := json.Unmarshal([]byte(proposalJSON), &proposal); err != nil {
		return fmt.Errorf("failed to parse proposal JSON: %w", err)
	}

	if proposal.ProposalID == "" {
		return fmt.Errorf("proposalId is required")
	}
	if proposal.Description == "" {
		return fmt.Errorf("description is required and cannot be empty")
	}

	proposal.DocType = "governance"
	proposal.Status = "PROPOSED"

	if proposal.Approvals == nil {
		proposal.Approvals = []shared.Approval{}
	}
	if proposal.Rejections == nil {
		proposal.Rejections = []shared.Approval{}
	}

	key, err := stub.CreateCompositeKey("GOV", []string{proposal.ProposalID})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %w", err)
	}

	data, err := json.Marshal(proposal)
	if err != nil {
		return fmt.Errorf("failed to marshal proposal: %w", err)
	}

	return stub.PutState(key, data)
}

// extractOrgMSP extracts the org MSP ID from the creator bytes.
// In our mock, the creator bytes contain the org MSP ID as a prefix (e.g., "Org1MSP-user").
func extractOrgMSP(creatorBytes []byte) string {
	s := string(creatorBytes)
	if idx := strings.Index(s, "-"); idx > 0 {
		return s[:idx]
	}
	return s
}

// ApproveChange records an organization's approval for a proposal.
func (c *GovernanceContract) ApproveChange(ctx contractapi.TransactionContextInterface, proposalID string, comment string) error {
	stub := ctx.GetStub()

	key, err := stub.CreateCompositeKey("GOV", []string{proposalID})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %w", err)
	}

	existing, err := stub.GetState(key)
	if err != nil {
		return fmt.Errorf("failed to get state: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("proposal %s not found", proposalID)
	}

	var proposal shared.GovernanceProposal
	if err := json.Unmarshal(existing, &proposal); err != nil {
		return fmt.Errorf("failed to unmarshal proposal: %w", err)
	}

	// Check if already resolved
	if proposal.Status != "PROPOSED" {
		return fmt.Errorf("proposal %s is already resolved (status: %s)", proposalID, proposal.Status)
	}

	// Get approver's org
	creatorBytes, err := stub.GetCreator()
	if err != nil {
		return fmt.Errorf("failed to get creator: %w", err)
	}
	approverOrg := extractOrgMSP(creatorBytes)

	// Check if org is in requiredOrgs
	orgAuthorized := false
	for _, org := range proposal.RequiredOrgs {
		if org == approverOrg {
			orgAuthorized = true
			break
		}
	}
	if !orgAuthorized {
		return fmt.Errorf("org %s is not authorized to approve this proposal", approverOrg)
	}

	// Check for duplicate approval from same org
	for _, a := range proposal.Approvals {
		if a.OrgMSPID == approverOrg {
			return fmt.Errorf("org %s has already approved this proposal", approverOrg)
		}
	}

	// Add approval
	approval := shared.Approval{
		OrgMSPID: approverOrg,
		UserID:   string(creatorBytes),
		Comment:  comment,
	}
	proposal.Approvals = append(proposal.Approvals, approval)

	// Check if all required orgs have approved
	if len(proposal.Approvals) >= len(proposal.RequiredOrgs) {
		allApproved := true
		for _, reqOrg := range proposal.RequiredOrgs {
			found := false
			for _, a := range proposal.Approvals {
				if a.OrgMSPID == reqOrg {
					found = true
					break
				}
			}
			if !found {
				allApproved = false
				break
			}
		}
		if allApproved {
			proposal.Status = "APPROVED"
		}
	}

	data, err := json.Marshal(proposal)
	if err != nil {
		return fmt.Errorf("failed to marshal proposal: %w", err)
	}

	return stub.PutState(key, data)
}

// RejectChange records an organization's rejection of a proposal.
func (c *GovernanceContract) RejectChange(ctx contractapi.TransactionContextInterface, proposalID string, reason string) error {
	stub := ctx.GetStub()

	key, err := stub.CreateCompositeKey("GOV", []string{proposalID})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %w", err)
	}

	existing, err := stub.GetState(key)
	if err != nil {
		return fmt.Errorf("failed to get state: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("proposal %s not found", proposalID)
	}

	var proposal shared.GovernanceProposal
	if err := json.Unmarshal(existing, &proposal); err != nil {
		return fmt.Errorf("failed to unmarshal proposal: %w", err)
	}

	if proposal.Status != "PROPOSED" {
		return fmt.Errorf("proposal %s is already resolved", proposalID)
	}

	creatorBytes, err := stub.GetCreator()
	if err != nil {
		return fmt.Errorf("failed to get creator: %w", err)
	}
	rejectorOrg := extractOrgMSP(creatorBytes)

	rejection := shared.Approval{
		OrgMSPID: rejectorOrg,
		UserID:   string(creatorBytes),
		Comment:  reason,
	}
	proposal.Rejections = append(proposal.Rejections, rejection)
	proposal.Status = "REJECTED"

	data, err := json.Marshal(proposal)
	if err != nil {
		return fmt.Errorf("failed to marshal proposal: %w", err)
	}

	return stub.PutState(key, data)
}

// QueryPending returns all pending proposals that require a given org's action.
func (c *GovernanceContract) QueryPending(ctx contractapi.TransactionContextInterface, orgMSPID string) ([]*shared.GovernanceProposal, error) {
	stub := ctx.GetStub()

	iter, err := stub.GetStateByPartialCompositeKey("GOV", []string{})
	if err != nil {
		return nil, fmt.Errorf("failed to query: %w", err)
	}
	defer iter.Close()

	var proposals []*shared.GovernanceProposal
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate: %w", err)
		}
		var proposal shared.GovernanceProposal
		if err := json.Unmarshal(kv.Value, &proposal); err != nil {
			continue
		}

		// Only pending proposals
		if proposal.Status != "PROPOSED" {
			continue
		}

		// Check if this org is in the required orgs
		for _, org := range proposal.RequiredOrgs {
			if org == orgMSPID {
				proposals = append(proposals, &proposal)
				break
			}
		}
	}

	if proposals == nil {
		proposals = []*shared.GovernanceProposal{}
	}
	return proposals, nil
}

// GetProposal retrieves a specific proposal by ID.
func (c *GovernanceContract) GetProposal(ctx contractapi.TransactionContextInterface, proposalID string) (*shared.GovernanceProposal, error) {
	stub := ctx.GetStub()

	key, err := stub.CreateCompositeKey("GOV", []string{proposalID})
	if err != nil {
		return nil, fmt.Errorf("failed to create composite key: %w", err)
	}

	data, err := stub.GetState(key)
	if err != nil {
		return nil, fmt.Errorf("failed to get state: %w", err)
	}
	if data == nil {
		return nil, fmt.Errorf("proposal %s not found", proposalID)
	}

	var proposal shared.GovernanceProposal
	if err := json.Unmarshal(data, &proposal); err != nil {
		return nil, fmt.Errorf("failed to unmarshal proposal: %w", err)
	}

	return &proposal, nil
}
