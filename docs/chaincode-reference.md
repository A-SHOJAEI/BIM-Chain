# BIM-Chain Chaincode Reference

Complete API reference for all smart contract functions deployed to the Hyperledger Fabric network. The chaincode is written in Go and consists of three contracts bundled into a single deployment: **AuditContract**, **IPAssetContract**, and **GovernanceContract**.

- **Package**: `github.com/bim-chain/fabric-bim-governance/chaincode`
- **Chaincode name**: `bim-governance`
- **Channel**: `bim-project`
- **Source**: `packages/chaincode-go/`

---

## Shared Types

All types are defined in `packages/chaincode-go/shared/types.go`.

### ChangeType

```go
type ChangeType string

const (
    ChangeTypeAdd    ChangeType = "ADD"
    ChangeTypeModify ChangeType = "MODIFY"
    ChangeTypeDelete ChangeType = "DELETE"
)
```

### AuditRecord

```go
type AuditRecord struct {
    DocType           string        `json:"docType"`
    ModelID           string        `json:"modelId"`
    ElementUniqueID   string        `json:"elementUniqueId"`
    ChangeType        ChangeType    `json:"changeType"`
    ElementHash       string        `json:"elementHash"`
    PreviousHash      string        `json:"previousHash,omitempty"`
    UserID            string        `json:"userId"`
    OrgMSPID          string        `json:"orgMspId"`
    Timestamp         string        `json:"timestamp"`
    TxID              string        `json:"txId,omitempty"`
    WorksharingAction string        `json:"worksharingAction,omitempty"`
    ParameterChanges  []ParamChange `json:"parameterChanges,omitempty"`
}
```

### ParamChange

```go
type ParamChange struct {
    Name     string `json:"name"`
    OldValue string `json:"oldValue"`
    NewValue string `json:"newValue"`
}
```

### IPRecord

```go
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
```

### Contribution

```go
type Contribution struct {
    UserID      string `json:"userId"`
    OrgMSPID    string `json:"orgMspId"`
    Timestamp   string `json:"timestamp"`
    ChangeHash  string `json:"changeHash"`
    Description string `json:"description,omitempty"`
}
```

### GovernanceProposal

```go
type GovernanceProposal struct {
    DocType      string     `json:"docType"`
    ProposalID   string     `json:"proposalId"`
    ModelID      string     `json:"modelId"`
    ElementID    string     `json:"elementId,omitempty"`
    ProposerID   string     `json:"proposerId"`
    ProposerOrg  string     `json:"proposerOrg"`
    Description  string     `json:"description"`
    ChangeHash   string     `json:"changeHash"`
    Status       string     `json:"status"`       // PROPOSED, APPROVED, REJECTED
    RequiredOrgs []string   `json:"requiredOrgs"`
    Approvals    []Approval `json:"approvals"`
    Rejections   []Approval `json:"rejections"`
    CreatedAt    string     `json:"createdAt"`
    ResolvedAt   string     `json:"resolvedAt,omitempty"`
}
```

### Approval

```go
type Approval struct {
    OrgMSPID  string `json:"orgMspId"`
    UserID    string `json:"userId"`
    Timestamp string `json:"timestamp"`
    Comment   string `json:"comment,omitempty"`
}
```

### ModelVersion

```go
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
```

---

## AuditContract

Manages immutable audit trails for BIM element changes. Records are stored with composite key prefix `AUDIT~{modelId}~{timestamp}~{txId}`. Model versions are stored with prefix `VERSION~{modelId}~{versionNumber}`.

---

### RecordChange

Stores an immutable audit record of a BIM element change on the ledger. Emits an `AuditRecorded` chaincode event.

| Property | Value |
|----------|-------|
| **Contract** | `AuditContract` |
| **Function** | `RecordChange` |
| **Transaction type** | Submit (write) |
| **Composite key** | `AUDIT~{modelId}~{timestamp}~{txId}` |
| **Access control** | Any authenticated identity enrolled in the channel (any MSP, any OU) |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `recordJSON` | `string` | Yes | JSON-serialized `AuditRecord` object |

**Required fields in recordJSON**: `modelId`, `elementUniqueId`, `elementHash`, `changeType` (must be `ADD`, `MODIFY`, or `DELETE`).

**Return type**: `error` -- Returns `nil` on success.

**Validation rules**:
- `modelId` must be non-empty
- `elementUniqueId` must be non-empty
- `elementHash` must be non-empty
- `changeType` must be one of `ADD`, `MODIFY`, `DELETE`
- The composite key must not already exist (immutability guarantee)

**Event emitted**: `AuditRecorded` with payload:
```json
{"modelId": "...", "elementUniqueId": "...", "changeType": "...", "txId": "..."}
```

**Example -- peer CLI invoke**

```bash
peer chaincode invoke \
  -o orderer1.bimchain.com:7050 \
  --tls --cafile $ORDERER_CA \
  -C bim-project -n bim-governance \
  --peerAddresses peer0.architect.bimchain.com:7051 --tlsRootCertFiles $ARCH_PEER_CA \
  --peerAddresses peer0.engineer.bimchain.com:9051 --tlsRootCertFiles $ENG_PEER_CA \
  -c '{"function":"AuditContract:RecordChange","Args":["{\"modelId\":\"project-tower-a\",\"elementUniqueId\":\"wall-001-ext\",\"changeType\":\"MODIFY\",\"elementHash\":\"f6e5d4c3b2a1987654321098765432109876fedcba0987654321fedcba098765\",\"previousHash\":\"a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456\",\"userId\":\"alice\",\"orgMspId\":\"ArchitectOrgMSP\",\"timestamp\":\"2025-06-15T10:30:00.000Z\",\"parameterChanges\":[{\"name\":\"Width\",\"oldValue\":\"200mm\",\"newValue\":\"300mm\"}]}"]}'
```

**Example -- middleware REST API**

```bash
curl -X POST http://localhost:3001/api/v1/changes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "modelId": "project-tower-a",
    "elementUniqueId": "wall-001-ext",
    "changeType": "MODIFY",
    "elementHash": "f6e5d4c3b2a1987654321098765432109876fedcba0987654321fedcba098765",
    "previousHash": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    "userId": "alice",
    "orgId": "ArchitectOrgMSP",
    "timestamp": "2025-06-15T10:30:00.000Z",
    "parameterChanges": [{"name": "Width", "oldValue": "200mm", "newValue": "300mm"}]
  }'
```

**Example response** (HTTP 201):

```json
{
  "txIds": ["fab-tx-a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"]
}
```

---

### QueryByModel

Returns all audit records for a given model using composite key prefix matching on `AUDIT~{modelId}`.

| Property | Value |
|----------|-------|
| **Contract** | `AuditContract` |
| **Function** | `QueryByModel` |
| **Transaction type** | Evaluate (read-only) |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `modelID` | `string` | Yes | The model identifier to query |

**Return type**: `[]*AuditRecord` -- A slice of audit records. Returns an empty array `[]` if none found.

**Example -- peer CLI query**

```bash
peer chaincode query \
  -C bim-project -n bim-governance \
  -c '{"function":"AuditContract:QueryByModel","Args":["project-tower-a"]}'
```

**Example -- middleware REST API**

```bash
curl http://localhost:3001/api/v1/audit-trail/project-tower-a \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Example response**:

```json
[
  {
    "docType": "audit",
    "modelId": "project-tower-a",
    "elementUniqueId": "wall-001-ext",
    "changeType": "ADD",
    "elementHash": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    "userId": "alice",
    "orgMspId": "ArchitectOrgMSP",
    "timestamp": "2025-03-01T09:00:00.000Z",
    "txId": "fab-tx-001"
  },
  {
    "docType": "audit",
    "modelId": "project-tower-a",
    "elementUniqueId": "wall-001-ext",
    "changeType": "MODIFY",
    "elementHash": "f6e5d4c3b2a1987654321098765432109876fedcba0987654321fedcba098765",
    "previousHash": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    "userId": "bob",
    "orgMspId": "EngineerOrgMSP",
    "timestamp": "2025-06-15T10:30:00.000Z",
    "txId": "fab-tx-002",
    "parameterChanges": [{"name": "Width", "oldValue": "200mm", "newValue": "300mm"}]
  }
]
```

---

### QueryByElement

Returns all audit records for a given element, sorted chronologically by timestamp (ascending). Iterates all `AUDIT~` keys and filters by `elementUniqueId`.

| Property | Value |
|----------|-------|
| **Contract** | `AuditContract` |
| **Function** | `QueryByElement` |
| **Transaction type** | Evaluate (read-only) |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `elementUniqueID` | `string` | Yes | The element unique ID to query |

**Return type**: `[]*AuditRecord` -- A chronologically sorted slice. Returns `[]` if none found.

**Example -- peer CLI query**

```bash
peer chaincode query \
  -C bim-project -n bim-governance \
  -c '{"function":"AuditContract:QueryByElement","Args":["wall-001-ext"]}'
```

**Example response**:

```json
[
  {
    "docType": "audit",
    "modelId": "project-tower-a",
    "elementUniqueId": "wall-001-ext",
    "changeType": "ADD",
    "elementHash": "a1b2c3d4...",
    "userId": "alice",
    "orgMspId": "ArchitectOrgMSP",
    "timestamp": "2025-03-01T09:00:00.000Z",
    "txId": "fab-tx-001"
  },
  {
    "docType": "audit",
    "modelId": "project-tower-a",
    "elementUniqueId": "wall-001-ext",
    "changeType": "MODIFY",
    "elementHash": "f6e5d4c3...",
    "previousHash": "a1b2c3d4...",
    "userId": "bob",
    "orgMspId": "EngineerOrgMSP",
    "timestamp": "2025-06-15T10:30:00.000Z",
    "txId": "fab-tx-002"
  }
]
```

---

### QueryByTimeRange

Returns audit records for a model within a timestamp range (inclusive on both ends), sorted chronologically.

| Property | Value |
|----------|-------|
| **Contract** | `AuditContract` |
| **Function** | `QueryByTimeRange` |
| **Transaction type** | Evaluate (read-only) |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `modelID` | `string` | Yes | The model identifier |
| `startTime` | `string` | Yes | ISO 8601 start timestamp (inclusive) |
| `endTime` | `string` | Yes | ISO 8601 end timestamp (inclusive) |

**Return type**: `[]*AuditRecord` -- A chronologically sorted slice within the range. Returns `[]` if none found.

**Example -- peer CLI query**

```bash
peer chaincode query \
  -C bim-project -n bim-governance \
  -c '{"function":"AuditContract:QueryByTimeRange","Args":["project-tower-a","2025-06-01T00:00:00.000Z","2025-06-30T23:59:59.999Z"]}'
```

**Example -- middleware REST API**

```bash
curl "http://localhost:3001/api/v1/audit-trail/project-tower-a?startTime=2025-06-01T00:00:00.000Z&endTime=2025-06-30T23:59:59.999Z" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Example response**:

```json
[
  {
    "docType": "audit",
    "modelId": "project-tower-a",
    "elementUniqueId": "wall-001-ext",
    "changeType": "MODIFY",
    "elementHash": "f6e5d4c3...",
    "previousHash": "a1b2c3d4...",
    "userId": "alice",
    "orgMspId": "ArchitectOrgMSP",
    "timestamp": "2025-06-15T10:30:00.000Z",
    "txId": "fab-tx-abc123"
  }
]
```

---

### RecordModelVersion

Stores a hash-linked model version snapshot on the ledger. Each version records the Merkle root hash of all element hashes at a point in time, forming a hash chain across versions.

| Property | Value |
|----------|-------|
| **Contract** | `AuditContract` |
| **Function** | `RecordModelVersion` |
| **Transaction type** | Submit (write) |
| **Composite key** | `VERSION~{modelId}~{versionNumber}` |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `versionJSON` | `string` | Yes | JSON-serialized `ModelVersion` object |

**Required fields in versionJSON**: `modelId`, `merkleRootHash`.

**Return type**: `error` -- Returns `nil` on success.

**Example -- peer CLI invoke**

```bash
peer chaincode invoke \
  -o orderer1.bimchain.com:7050 \
  --tls --cafile $ORDERER_CA \
  -C bim-project -n bim-governance \
  --peerAddresses peer0.architect.bimchain.com:7051 --tlsRootCertFiles $ARCH_PEER_CA \
  --peerAddresses peer0.engineer.bimchain.com:9051 --tlsRootCertFiles $ENG_PEER_CA \
  -c '{"function":"AuditContract:RecordModelVersion","Args":["{\"modelId\":\"project-tower-a\",\"versionNumber\":42,\"merkleRootHash\":\"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890\",\"previousHash\":\"9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba\",\"userId\":\"alice\",\"orgMspId\":\"ArchitectOrgMSP\",\"timestamp\":\"2025-06-15T18:00:00.000Z\",\"elementCount\":1250,\"syncAction\":\"SynchronizeWithCentral\"}"]}'
```

**Example response** (transaction committed successfully, no return payload for invoke):

```
Chaincode invoke successful. result: status:200
```

---

### GetModelVersion

Retrieves a specific model version by model ID and version number.

| Property | Value |
|----------|-------|
| **Contract** | `AuditContract` |
| **Function** | `GetModelVersion` |
| **Transaction type** | Evaluate (read-only) |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `modelID` | `string` | Yes | The model identifier |
| `versionNumber` | `int` | Yes | The version number to retrieve |

**Return type**: `*ModelVersion` -- The model version record, or an error if not found.

**Example -- peer CLI query**

```bash
peer chaincode query \
  -C bim-project -n bim-governance \
  -c '{"function":"AuditContract:GetModelVersion","Args":["project-tower-a","42"]}'
```

**Example response**:

```json
{
  "docType": "modelVersion",
  "modelId": "project-tower-a",
  "versionNumber": 42,
  "merkleRootHash": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "previousHash": "9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
  "userId": "alice",
  "orgMspId": "ArchitectOrgMSP",
  "timestamp": "2025-06-15T18:00:00.000Z",
  "elementCount": 1250,
  "syncAction": "SynchronizeWithCentral",
  "offChainCid": ""
}
```

---

## IPAssetContract

Manages intellectual property attribution for BIM elements. Each IP record is stored with a composite key `IP~{elementUniqueId}`. Tracks element creators, contribution history from multiple users and organizations, ownership, and licensing.

---

### RegisterElement

Registers a new BIM element for IP tracking on the ledger. Fails if the element is already registered (prevents double-registration).

| Property | Value |
|----------|-------|
| **Contract** | `IPAssetContract` |
| **Function** | `RegisterElement` |
| **Transaction type** | Submit (write) |
| **Composite key** | `IP~{elementUniqueId}` |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ipRecordJSON` | `string` | Yes | JSON-serialized `IPRecord` object |

**Required fields in ipRecordJSON**: `elementUniqueId`.

**Return type**: `error` -- Returns `nil` on success. Returns an error if the element is already registered.

**Example -- peer CLI invoke**

```bash
peer chaincode invoke \
  -o orderer1.bimchain.com:7050 \
  --tls --cafile $ORDERER_CA \
  -C bim-project -n bim-governance \
  --peerAddresses peer0.architect.bimchain.com:7051 --tlsRootCertFiles $ARCH_PEER_CA \
  --peerAddresses peer0.engineer.bimchain.com:9051 --tlsRootCertFiles $ENG_PEER_CA \
  -c '{"function":"IPAssetContract:RegisterElement","Args":["{\"elementUniqueId\":\"wall-001-ext\",\"creatorUserId\":\"alice\",\"creatorOrgMspId\":\"ArchitectOrgMSP\",\"creationTimestamp\":\"2025-03-01T09:00:00.000Z\",\"familyName\":\"Basic Wall\",\"categoryName\":\"Walls\",\"licenseType\":\"CC-BY-4.0\",\"restrictions\":[\"no-commercial-reuse\"]}"]}'
```

**Example -- middleware REST API**

```bash
curl -X POST http://localhost:3001/api/v1/ip-attribution/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "elementUniqueId": "wall-001-ext",
    "creatorUserId": "alice",
    "creatorOrgMspId": "ArchitectOrgMSP",
    "creationTimestamp": "2025-03-01T09:00:00.000Z",
    "familyName": "Basic Wall"
  }'
```

**Example response** (HTTP 201):

```json
{
  "elementId": "wall-001-ext"
}
```

---

### RecordContribution

Adds a contribution record to an existing IP-tracked element. Prevents duplicate contributions based on `changeHash`.

| Property | Value |
|----------|-------|
| **Contract** | `IPAssetContract` |
| **Function** | `RecordContribution` |
| **Transaction type** | Submit (write) |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `elementUniqueID` | `string` | Yes | The element to add the contribution to |
| `contributionJSON` | `string` | Yes | JSON-serialized `Contribution` object |

**Return type**: `error` -- Returns `nil` on success. Returns an error if:
- The element is not found (not registered)
- A contribution with the same `changeHash` already exists

**Example -- peer CLI invoke**

```bash
peer chaincode invoke \
  -o orderer1.bimchain.com:7050 \
  --tls --cafile $ORDERER_CA \
  -C bim-project -n bim-governance \
  --peerAddresses peer0.architect.bimchain.com:7051 --tlsRootCertFiles $ARCH_PEER_CA \
  --peerAddresses peer0.engineer.bimchain.com:9051 --tlsRootCertFiles $ENG_PEER_CA \
  -c '{"function":"IPAssetContract:RecordContribution","Args":["wall-001-ext","{\"userId\":\"bob\",\"orgMspId\":\"EngineerOrgMSP\",\"timestamp\":\"2025-03-05T14:00:00.000Z\",\"changeHash\":\"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890\",\"description\":\"Structural review and parameter adjustment\"}"]}'
```

**Example -- middleware REST API**

```bash
curl -X POST http://localhost:3001/api/v1/ip-attribution/contribute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "elementId": "wall-001-ext",
    "userId": "bob",
    "orgMspId": "EngineerOrgMSP",
    "changeHash": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "description": "Structural review and parameter adjustment"
  }'
```

**Example response** (HTTP 201):

```json
{
  "status": "ok"
}
```

---

### QueryByCreator

Returns all IP records where `creatorUserId` matches the given user ID.

| Property | Value |
|----------|-------|
| **Contract** | `IPAssetContract` |
| **Function** | `QueryByCreator` |
| **Transaction type** | Evaluate (read-only) |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `userID` | `string` | Yes | The user ID to filter by |

**Return type**: `[]*IPRecord` -- A slice of IP records. Returns `[]` if none found.

**Example -- peer CLI query**

```bash
peer chaincode query \
  -C bim-project -n bim-governance \
  -c '{"function":"IPAssetContract:QueryByCreator","Args":["alice"]}'
```

**Example response**:

```json
[
  {
    "docType": "ip",
    "elementUniqueId": "wall-001-ext",
    "creatorUserId": "alice",
    "creatorOrgMspId": "ArchitectOrgMSP",
    "creationTimestamp": "2025-03-01T09:00:00.000Z",
    "familyName": "Basic Wall",
    "categoryName": "Walls",
    "contributions": [
      {
        "userId": "bob",
        "orgMspId": "EngineerOrgMSP",
        "timestamp": "2025-03-05T14:00:00.000Z",
        "changeHash": "abcdef12...",
        "description": "Structural review and parameter adjustment"
      }
    ],
    "licenseType": "CC-BY-4.0",
    "restrictions": ["no-commercial-reuse"]
  }
]
```

---

### QueryByOrg

Returns all IP records where `creatorOrgMspId` matches the given organization MSP ID.

| Property | Value |
|----------|-------|
| **Contract** | `IPAssetContract` |
| **Function** | `QueryByOrg` |
| **Transaction type** | Evaluate (read-only) |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `orgMSPID` | `string` | Yes | The organization MSP ID to filter by (e.g., `ArchitectOrgMSP`) |

**Return type**: `[]*IPRecord` -- A slice of IP records. Returns `[]` if none found.

**Example -- peer CLI query**

```bash
peer chaincode query \
  -C bim-project -n bim-governance \
  -c '{"function":"IPAssetContract:QueryByOrg","Args":["ArchitectOrgMSP"]}'
```

**Example -- middleware REST API**

```bash
curl "http://localhost:3001/api/v1/ip-attribution?org=ArchitectOrgMSP" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Example response**:

```json
[
  {
    "docType": "ip",
    "elementUniqueId": "wall-001-ext",
    "creatorUserId": "alice",
    "creatorOrgMspId": "ArchitectOrgMSP",
    "creationTimestamp": "2025-03-01T09:00:00.000Z",
    "familyName": "Basic Wall",
    "categoryName": "Walls",
    "contributions": [],
    "licenseType": "CC-BY-4.0",
    "restrictions": ["no-commercial-reuse"]
  },
  {
    "docType": "ip",
    "elementUniqueId": "door-005-int",
    "creatorUserId": "alice",
    "creatorOrgMspId": "ArchitectOrgMSP",
    "creationTimestamp": "2025-03-02T11:30:00.000Z",
    "familyName": "Single-Flush",
    "categoryName": "Doors",
    "contributions": []
  }
]
```

---

### TransferOwnership

Transfers element ownership to a new user and organization. Updates the `creatorUserId` and `creatorOrgMspId` fields on the IP record.

| Property | Value |
|----------|-------|
| **Contract** | `IPAssetContract` |
| **Function** | `TransferOwnership` |
| **Transaction type** | Submit (write) |
| **Access control** | Any authenticated identity enrolled in the channel. In production, this should be restricted to the current owner or an admin role via ABAC policies. |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `elementUniqueID` | `string` | Yes | The element to transfer |
| `newOwnerID` | `string` | Yes | New owner user ID |
| `newOwnerOrg` | `string` | Yes | New owner organization MSP ID |

**Return type**: `error` -- Returns `nil` on success. Returns an error if the element is not found.

**Example -- peer CLI invoke**

```bash
peer chaincode invoke \
  -o orderer1.bimchain.com:7050 \
  --tls --cafile $ORDERER_CA \
  -C bim-project -n bim-governance \
  --peerAddresses peer0.architect.bimchain.com:7051 --tlsRootCertFiles $ARCH_PEER_CA \
  --peerAddresses peer0.engineer.bimchain.com:9051 --tlsRootCertFiles $ENG_PEER_CA \
  -c '{"function":"IPAssetContract:TransferOwnership","Args":["wall-001-ext","charlie","EngineerOrgMSP"]}'
```

**Example response** (transaction committed successfully):

```
Chaincode invoke successful. result: status:200
```

---

### GetContributionSummary

Returns the number of contributions per organization for a given element. Useful for attribution dashboards.

| Property | Value |
|----------|-------|
| **Contract** | `IPAssetContract` |
| **Function** | `GetContributionSummary` |
| **Transaction type** | Evaluate (read-only) |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `elementUniqueID` | `string` | Yes | The element to summarize |

**Return type**: `map[string]int` -- A map from organization MSP ID to contribution count. Returns an error if the element is not found.

**Example -- peer CLI query**

```bash
peer chaincode query \
  -C bim-project -n bim-governance \
  -c '{"function":"IPAssetContract:GetContributionSummary","Args":["wall-001-ext"]}'
```

**Example response**:

```json
{
  "ArchitectOrgMSP": 3,
  "EngineerOrgMSP": 2
}
```

---

## GovernanceContract

Manages multi-organization approval workflows for design changes. Each proposal is stored with composite key `GOV~{proposalId}`. Proposals transition through states: `PROPOSED` -> `APPROVED` or `REJECTED`.

---

### ProposeChange

Creates a new governance proposal requiring multi-org approval. The `status` is automatically set to `PROPOSED` and `approvals`/`rejections` arrays are initialized to empty.

| Property | Value |
|----------|-------|
| **Contract** | `GovernanceContract` |
| **Function** | `ProposeChange` |
| **Transaction type** | Submit (write) |
| **Composite key** | `GOV~{proposalId}` |
| **Access control** | Any authenticated identity enrolled in the channel (proposer can be from any org) |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `proposalJSON` | `string` | Yes | JSON-serialized `GovernanceProposal` object |

**Required fields in proposalJSON**: `proposalId`, `description`.

**Return type**: `error` -- Returns `nil` on success.

**Example -- peer CLI invoke**

```bash
peer chaincode invoke \
  -o orderer1.bimchain.com:7050 \
  --tls --cafile $ORDERER_CA \
  -C bim-project -n bim-governance \
  --peerAddresses peer0.architect.bimchain.com:7051 --tlsRootCertFiles $ARCH_PEER_CA \
  --peerAddresses peer0.engineer.bimchain.com:9051 --tlsRootCertFiles $ENG_PEER_CA \
  -c '{"function":"GovernanceContract:ProposeChange","Args":["{\"proposalId\":\"prop-2025-001\",\"modelId\":\"project-tower-a\",\"elementId\":\"wall-001-ext\",\"proposerId\":\"alice\",\"proposerOrg\":\"ArchitectOrgMSP\",\"description\":\"Increase exterior wall thickness from 200mm to 300mm for thermal performance\",\"changeHash\":\"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890\",\"requiredOrgs\":[\"ArchitectOrgMSP\",\"EngineerOrgMSP\"],\"createdAt\":\"2025-06-15T10:30:00.000Z\"}"]}'
```

**Example -- middleware REST API**

```bash
curl -X POST http://localhost:3001/api/v1/governance/proposals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "proposalId": "prop-2025-001",
    "modelId": "project-tower-a",
    "proposerId": "alice",
    "proposerOrg": "ArchitectOrgMSP",
    "description": "Increase exterior wall thickness from 200mm to 300mm for thermal performance",
    "changeHash": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "requiredOrgs": ["ArchitectOrgMSP", "EngineerOrgMSP"]
  }'
```

**Example response** (HTTP 201):

```json
{
  "proposalId": "prop-2025-001"
}
```

---

### ApproveChange

Records an organization's approval for a pending proposal. The approver's organization is extracted from the transaction creator certificate. When all organizations listed in `requiredOrgs` have approved, the proposal status transitions to `APPROVED`.

| Property | Value |
|----------|-------|
| **Contract** | `GovernanceContract` |
| **Function** | `ApproveChange` |
| **Transaction type** | Submit (write) |
| **Access control** | Only organizations listed in the proposal's `requiredOrgs` field. The approver's org MSP is extracted from the transaction creator identity via `stub.GetCreator()`. |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `proposalID` | `string` | Yes | The proposal identifier to approve |
| `comment` | `string` | Yes | Approval comment (can be empty string) |

**Return type**: `error` -- Returns `nil` on success. Returns an error if:
- The proposal is not found
- The proposal is already resolved (status is not `PROPOSED`)
- The calling organization is not in the `requiredOrgs` list
- The calling organization has already approved this proposal

**Example -- peer CLI invoke**

```bash
# Invoked as EngineerOrg identity
peer chaincode invoke \
  -o orderer1.bimchain.com:7050 \
  --tls --cafile $ORDERER_CA \
  -C bim-project -n bim-governance \
  --peerAddresses peer0.architect.bimchain.com:7051 --tlsRootCertFiles $ARCH_PEER_CA \
  --peerAddresses peer0.engineer.bimchain.com:9051 --tlsRootCertFiles $ENG_PEER_CA \
  -c '{"function":"GovernanceContract:ApproveChange","Args":["prop-2025-001","Structural review confirms feasibility"]}'
```

**Example -- middleware REST API**

```bash
curl -X POST http://localhost:3001/api/v1/governance/proposals/prop-2025-001/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "orgMspId": "EngineerOrgMSP",
    "userId": "bob",
    "comment": "Structural review confirms feasibility"
  }'
```

**Example response**:

```json
{
  "status": "ok",
  "proposalId": "prop-2025-001"
}
```

---

### RejectChange

Records an organization's rejection of a pending proposal. A single rejection immediately transitions the proposal status to `REJECTED`.

| Property | Value |
|----------|-------|
| **Contract** | `GovernanceContract` |
| **Function** | `RejectChange` |
| **Transaction type** | Submit (write) |
| **Access control** | Any authenticated identity enrolled in the channel. The rejector's org MSP is extracted from `stub.GetCreator()`. |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `proposalID` | `string` | Yes | The proposal identifier to reject |
| `reason` | `string` | Yes | Reason for rejection |

**Return type**: `error` -- Returns `nil` on success. Returns an error if the proposal is not found or already resolved.

**Example -- peer CLI invoke**

```bash
peer chaincode invoke \
  -o orderer1.bimchain.com:7050 \
  --tls --cafile $ORDERER_CA \
  -C bim-project -n bim-governance \
  --peerAddresses peer0.architect.bimchain.com:7051 --tlsRootCertFiles $ARCH_PEER_CA \
  --peerAddresses peer0.engineer.bimchain.com:9051 --tlsRootCertFiles $ENG_PEER_CA \
  -c '{"function":"GovernanceContract:RejectChange","Args":["prop-2025-001","Exceeds structural load limits for current foundation design"]}'
```

**Example -- middleware REST API**

```bash
curl -X POST http://localhost:3001/api/v1/governance/proposals/prop-2025-001/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "orgMspId": "EngineerOrgMSP",
    "userId": "bob",
    "reason": "Exceeds structural load limits for current foundation design"
  }'
```

**Example response**:

```json
{
  "status": "ok",
  "proposalId": "prop-2025-001"
}
```

---

### QueryPending

Returns all pending proposals that require a given organization's action. Only returns proposals where `status == "PROPOSED"` and the org is listed in `requiredOrgs`.

| Property | Value |
|----------|-------|
| **Contract** | `GovernanceContract` |
| **Function** | `QueryPending` |
| **Transaction type** | Evaluate (read-only) |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `orgMSPID` | `string` | Yes | The organization MSP ID to query pending proposals for |

**Return type**: `[]*GovernanceProposal` -- A slice of pending proposals. Returns `[]` if none found.

**Example -- peer CLI query**

```bash
peer chaincode query \
  -C bim-project -n bim-governance \
  -c '{"function":"GovernanceContract:QueryPending","Args":["EngineerOrgMSP"]}'
```

**Example -- middleware REST API**

```bash
curl "http://localhost:3001/api/v1/governance/pending?org=EngineerOrgMSP" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Example response**:

```json
[
  {
    "docType": "governance",
    "proposalId": "prop-2025-001",
    "modelId": "project-tower-a",
    "elementId": "wall-001-ext",
    "proposerId": "alice",
    "proposerOrg": "ArchitectOrgMSP",
    "description": "Increase exterior wall thickness from 200mm to 300mm for thermal performance",
    "changeHash": "abcdef12...",
    "status": "PROPOSED",
    "requiredOrgs": ["ArchitectOrgMSP", "EngineerOrgMSP"],
    "approvals": [
      {
        "orgMspId": "ArchitectOrgMSP",
        "userId": "ArchitectOrgMSP-alice",
        "comment": "Proposer approval"
      }
    ],
    "rejections": [],
    "createdAt": "2025-06-15T10:30:00.000Z"
  }
]
```

---

### GetProposal

Retrieves a specific governance proposal by ID, regardless of its status.

| Property | Value |
|----------|-------|
| **Contract** | `GovernanceContract` |
| **Function** | `GetProposal` |
| **Transaction type** | Evaluate (read-only) |
| **Access control** | Any authenticated identity enrolled in the channel |

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `proposalID` | `string` | Yes | The proposal identifier |

**Return type**: `*GovernanceProposal` -- The full proposal record, or an error if not found.

**Example -- peer CLI query**

```bash
peer chaincode query \
  -C bim-project -n bim-governance \
  -c '{"function":"GovernanceContract:GetProposal","Args":["prop-2025-001"]}'
```

**Example response**:

```json
{
  "docType": "governance",
  "proposalId": "prop-2025-001",
  "modelId": "project-tower-a",
  "elementId": "wall-001-ext",
  "proposerId": "alice",
  "proposerOrg": "ArchitectOrgMSP",
  "description": "Increase exterior wall thickness from 200mm to 300mm for thermal performance",
  "changeHash": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "status": "APPROVED",
  "requiredOrgs": ["ArchitectOrgMSP", "EngineerOrgMSP"],
  "approvals": [
    {
      "orgMspId": "ArchitectOrgMSP",
      "userId": "ArchitectOrgMSP-alice",
      "comment": "Proposer approval"
    },
    {
      "orgMspId": "EngineerOrgMSP",
      "userId": "EngineerOrgMSP-bob",
      "comment": "Structural review confirms feasibility"
    }
  ],
  "rejections": [],
  "createdAt": "2025-06-15T10:30:00.000Z",
  "resolvedAt": "2025-06-16T14:00:00.000Z"
}
```

---

## Middleware REST API Mapping

The middleware (Fastify) maps REST endpoints to chaincode functions as follows:

| HTTP Method | Endpoint | Chaincode Function | Auth |
|-------------|----------|--------------------|------|
| `POST` | `/api/v1/changes` | `AuditContract:RecordChange` | JWT required |
| `GET` | `/api/v1/audit-trail/:modelId` | `AuditContract:QueryByModel` | JWT required |
| `GET` | `/api/v1/audit-trail/:modelId?startTime=...&endTime=...` | `AuditContract:QueryByTimeRange` | JWT required |
| `POST` | `/api/v1/ip-attribution/register` | `IPAssetContract:RegisterElement` | JWT required |
| `POST` | `/api/v1/ip-attribution/contribute` | `IPAssetContract:RecordContribution` | JWT required |
| `GET` | `/api/v1/ip-attribution/:elementId` | `IPAssetContract:GetContributionSummary` | JWT required |
| `GET` | `/api/v1/ip-attribution?org=...` | `IPAssetContract:QueryByOrg` | JWT required |
| `POST` | `/api/v1/governance/proposals` | `GovernanceContract:ProposeChange` | JWT required |
| `POST` | `/api/v1/governance/proposals/:id/approve` | `GovernanceContract:ApproveChange` | JWT required |
| `POST` | `/api/v1/governance/proposals/:id/reject` | `GovernanceContract:RejectChange` | JWT required |
| `GET` | `/api/v1/governance/pending?org=...` | `GovernanceContract:QueryPending` | JWT required |
| `POST` | `/api/v1/auth/login` | N/A (JWT issuance) | No auth |
| `POST` | `/api/v1/auth/refresh` | N/A (JWT refresh) | JWT required |
| `GET` | `/health` | N/A (health check) | No auth |
