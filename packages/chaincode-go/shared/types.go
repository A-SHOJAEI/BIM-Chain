package shared

// ChangeType represents the type of BIM element change
type ChangeType string

const (
	ChangeTypeAdd    ChangeType = "ADD"
	ChangeTypeModify ChangeType = "MODIFY"
	ChangeTypeDelete ChangeType = "DELETE"
)

// AuditRecord represents an immutable record of a BIM model change
type AuditRecord struct {
	DocType           string        `json:"docType"`
	ModelID           string        `json:"modelId"`
	ElementUniqueID   string        `json:"elementUniqueId"`
	ChangeType        ChangeType    `json:"changeType"`
	ElementHash       string        `json:"elementHash"`
	PreviousHash      string        `json:"previousHash,omitempty" metadata:",optional"`
	UserID            string        `json:"userId"`
	OrgMSPID          string        `json:"orgMspId"`
	Timestamp         string        `json:"timestamp"`
	TxID              string        `json:"txId,omitempty" metadata:",optional"`
	WorksharingAction string        `json:"worksharingAction,omitempty" metadata:",optional"`
	ParameterChanges  []ParamChange `json:"parameterChanges,omitempty" metadata:",optional"`
}

// ParamChange represents a single parameter modification
type ParamChange struct {
	Name     string `json:"name"`
	OldValue string `json:"oldValue"`
	NewValue string `json:"newValue"`
}

// IPRecord represents intellectual property ownership of a BIM element
type IPRecord struct {
	DocType           string         `json:"docType"`
	ElementUniqueID   string         `json:"elementUniqueId"`
	CreatorUserID     string         `json:"creatorUserId"`
	CreatorOrgMSPID   string         `json:"creatorOrgMspId"`
	CreationTimestamp string         `json:"creationTimestamp"`
	FamilyName        string         `json:"familyName,omitempty"`
	CategoryName      string         `json:"categoryName,omitempty"`
	Contributions     []Contribution `json:"contributions"`
	LicenseType       string         `json:"licenseType,omitempty"`
	Restrictions      []string       `json:"restrictions,omitempty"`
}

// Contribution records a modification to an IP-tracked element
type Contribution struct {
	UserID      string `json:"userId"`
	OrgMSPID    string `json:"orgMspId"`
	Timestamp   string `json:"timestamp"`
	ChangeHash  string `json:"changeHash"`
	Description string `json:"description,omitempty"`
}

// GovernanceProposal represents a change requiring multi-org approval
type GovernanceProposal struct {
	DocType      string     `json:"docType"`
	ProposalID   string     `json:"proposalId"`
	ModelID      string     `json:"modelId"`
	ElementID    string     `json:"elementId,omitempty"`
	ProposerID   string     `json:"proposerId"`
	ProposerOrg  string     `json:"proposerOrg"`
	Description  string     `json:"description"`
	ChangeHash   string     `json:"changeHash"`
	Status       string     `json:"status"` // PROPOSED, APPROVED, REJECTED
	RequiredOrgs []string   `json:"requiredOrgs"`
	Approvals    []Approval `json:"approvals"`
	Rejections   []Approval `json:"rejections"`
	CreatedAt    string     `json:"createdAt"`
	ResolvedAt   string     `json:"resolvedAt,omitempty"`
}

// Approval represents a single org's approval or rejection
type Approval struct {
	OrgMSPID  string `json:"orgMspId"`
	UserID    string `json:"userId"`
	Timestamp string `json:"timestamp"`
	Comment   string `json:"comment,omitempty"`
}

// ModelVersion represents a tamper-proof model snapshot record
type ModelVersion struct {
	DocType        string `json:"docType"`
	ModelID        string `json:"modelId"`
	VersionNumber  int    `json:"versionNumber"`
	MerkleRootHash string `json:"merkleRootHash"`
	PreviousHash   string `json:"previousHash"`
	UserID         string `json:"userId"`
	OrgMSPID       string `json:"orgMspId"`
	Timestamp      string `json:"timestamp"`
	ElementCount   int    `json:"elementCount"`
	SyncAction     string `json:"syncAction"`
	OffChainCID    string `json:"offChainCid,omitempty"`
}
