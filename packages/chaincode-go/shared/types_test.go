package shared

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuditRecord_JSONRoundTrip(t *testing.T) {
	record := AuditRecord{
		DocType:         "audit",
		ModelID:         "model-001",
		ElementUniqueID: "elem-abc-123",
		ChangeType:      ChangeTypeAdd,
		ElementHash:     "sha256:abc123",
		UserID:          "user1",
		OrgMSPID:        "ArchitectOrgMSP",
		Timestamp:       "2025-01-15T10:30:00Z",
	}
	data, err := json.Marshal(record)
	require.NoError(t, err)

	var decoded AuditRecord
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	assert.Equal(t, record, decoded)
}

func TestChangeType_Values(t *testing.T) {
	assert.Equal(t, ChangeType("ADD"), ChangeTypeAdd)
	assert.Equal(t, ChangeType("MODIFY"), ChangeTypeModify)
	assert.Equal(t, ChangeType("DELETE"), ChangeTypeDelete)
}

func TestIPRecord_JSONRoundTrip(t *testing.T) {
	record := IPRecord{
		DocType:           "ip",
		ElementUniqueID:   "elem-xyz-789",
		CreatorUserID:     "architect1",
		CreatorOrgMSPID:   "ArchitectOrgMSP",
		CreationTimestamp: "2025-01-15T09:00:00Z",
		FamilyName:        "Custom Door",
		Contributions: []Contribution{
			{UserID: "engineer1", OrgMSPID: "EngineerOrgMSP",
				Timestamp: "2025-01-16T11:00:00Z", ChangeHash: "sha256:def456"},
		},
	}
	data, err := json.Marshal(record)
	require.NoError(t, err)

	var decoded IPRecord
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	assert.Equal(t, record, decoded)
}

func TestGovernanceProposal_StatusValues(t *testing.T) {
	proposal := GovernanceProposal{Status: "PROPOSED"}
	assert.Equal(t, "PROPOSED", proposal.Status)
}
