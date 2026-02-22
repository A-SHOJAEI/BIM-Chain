# BIM-Chain API Reference

Base URL: `http://localhost:3001/api/v1`

All endpoints except `/auth/login` and `/auth/refresh` require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## Health Check

### GET /health

Check service status.

**Response 200**

```json
{
  "status": "ok",
  "service": "bim-chain-middleware",
  "version": "0.1.0"
}
```

---

## Authentication

### POST /api/v1/auth/login

Authenticate a user and receive JWT tokens.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | User identifier |
| `password` | string | Yes | User password |

**Example Request**

```json
{
  "username": "admin",
  "password": "adminpw"
}
```

**Response 200**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "admin",
    "orgId": "Org1MSP"
  }
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 400 | Missing or invalid fields |
| 401 | Invalid credentials |

---

### POST /api/v1/auth/refresh

Refresh an expired access token.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `refreshToken` | string | Yes | A valid refresh token from login |

**Example Request**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 200**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 400 | Missing refresh token |
| 401 | Invalid or expired refresh token |

---

## Change Records (Audit Trail)

### POST /api/v1/changes

Submit one or more BIM change records to the blockchain. Accepts either a single change record object or an array of change records.

**Request Body (single record)**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `modelId` | string | Yes | Revit model identifier |
| `elementUniqueId` | string | Yes | Revit element unique ID |
| `changeType` | string | Yes | One of: `ADD`, `MODIFY`, `DELETE` |
| `elementHash` | string | Yes | SHA-256 hash of element state after change |
| `previousHash` | string | No | SHA-256 hash before change (for `MODIFY`) |
| `userId` | string | Yes | User who made the change |
| `orgId` | string | Yes | Organization MSP ID |
| `timestamp` | string | No | ISO 8601 timestamp (auto-generated if omitted) |
| `parameterChanges` | array | No | Array of `{name, oldValue, newValue}` objects |

**Example Request (single)**

```json
{
  "modelId": "project-tower-a",
  "elementUniqueId": "wall-001-ext",
  "changeType": "MODIFY",
  "elementHash": "f6e5d4c3b2a1987654321098765432109876fedcba0987654321fedcba098765",
  "previousHash": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
  "userId": "alice",
  "orgId": "Org1MSP",
  "parameterChanges": [
    { "name": "Width", "oldValue": "200mm", "newValue": "300mm" }
  ]
}
```

**Example Request (batch)**

```json
[
  {
    "modelId": "project-tower-a",
    "elementUniqueId": "wall-001-ext",
    "changeType": "MODIFY",
    "elementHash": "f6e5d4c3...",
    "userId": "alice",
    "orgId": "Org1MSP"
  },
  {
    "modelId": "project-tower-a",
    "elementUniqueId": "door-042",
    "changeType": "ADD",
    "elementHash": "abcdef12...",
    "userId": "alice",
    "orgId": "Org1MSP"
  }
]
```

**Response 201**

```json
{
  "txIds": ["fab-tx-abc123", "fab-tx-def456"]
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 400 | Validation error (missing or invalid fields) |
| 401 | Unauthorized (missing or invalid JWT) |
| 500 | Fabric transaction failure |

---

### GET /api/v1/audit-trail/:modelId

Query the audit trail for a specific BIM model.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `modelId` | string | The model identifier to query |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startTime` | string (ISO 8601) | No | Filter records from this timestamp |
| `endTime` | string (ISO 8601) | No | Filter records up to this timestamp |

**Example Request**

```
GET /api/v1/audit-trail/project-tower-a?startTime=2025-01-01T00:00:00Z&endTime=2025-06-30T23:59:59Z
```

**Response 200**

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
    "orgMspId": "Org1MSP",
    "timestamp": "2025-06-15T10:30:00.000Z",
    "txId": "fab-tx-abc123def456",
    "parameterChanges": [
      { "name": "Width", "oldValue": "200mm", "newValue": "300mm" }
    ]
  }
]
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |

---

## Intellectual Property (IP Attribution)

### GET /api/v1/ip-attribution/:elementId

Query IP attribution records for a specific BIM element.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `elementId` | string | The element unique identifier |

**Response 200**

```json
{
  "docType": "ip",
  "elementUniqueId": "wall-001-ext",
  "creatorUserId": "alice",
  "creatorOrgMspId": "Org1MSP",
  "creationTimestamp": "2025-03-01T09:00:00.000Z",
  "familyName": "Basic Wall",
  "contributions": [
    {
      "userId": "bob",
      "orgMspId": "Org2MSP",
      "timestamp": "2025-03-05T14:00:00.000Z",
      "changeHash": "sha256:def456",
      "description": "Structural review"
    }
  ]
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 404 | Element not found |

---

### GET /api/v1/ip-attribution?org=:orgMspId

Query all IP records belonging to a specific organization.

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `org` | string | Yes | The organization MSP ID |

**Example Request**

```
GET /api/v1/ip-attribution?org=Org1MSP
```

**Response 200**

```json
[
  {
    "docType": "ip",
    "elementUniqueId": "wall-001-ext",
    "creatorUserId": "alice",
    "creatorOrgMspId": "Org1MSP",
    "creationTimestamp": "2025-03-01T09:00:00.000Z",
    "familyName": "Basic Wall",
    "contributions": []
  }
]
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |

---

### POST /api/v1/ip-attribution/register

Register a new BIM element for IP tracking.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `elementUniqueId` | string | Yes | Unique element identifier |
| `creatorUserId` | string | Yes | Creator user ID |
| `creatorOrgMspId` | string | Yes | Creator organization MSP ID |
| `creationTimestamp` | string | No | ISO 8601 timestamp (auto-generated if omitted) |
| `familyName` | string | No | Revit family name |

**Example Request**

```json
{
  "elementUniqueId": "beam-055",
  "creatorUserId": "charlie",
  "creatorOrgMspId": "Org2MSP",
  "familyName": "W-Wide Flange"
}
```

**Response 201**

```json
{
  "elementId": "beam-055"
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 400 | Validation error |
| 401 | Unauthorized |
| 500 | Fabric transaction failure |

---

### POST /api/v1/ip-attribution/contribute

Add a contribution record to an existing IP-tracked element.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `elementId` | string | Yes | Element unique identifier |
| `userId` | string | Yes | Contributing user ID |
| `orgMspId` | string | Yes | Contributing organization MSP ID |
| `changeHash` | string | Yes | SHA-256 hash of the contribution |
| `timestamp` | string | No | ISO 8601 timestamp (auto-generated if omitted) |
| `description` | string | No | Description of the contribution |

**Example Request**

```json
{
  "elementId": "wall-001-ext",
  "userId": "bob",
  "orgMspId": "Org2MSP",
  "changeHash": "sha256:contrib789",
  "description": "Structural load analysis"
}
```

**Response 201**

```json
{
  "status": "ok"
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 400 | Validation error |
| 401 | Unauthorized |
| 500 | Fabric transaction failure |

---

## Governance

### POST /api/v1/governance/proposals

Create a new governance proposal for a design change.

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `proposalId` | string | Yes | Unique proposal identifier |
| `modelId` | string | Yes | Model identifier |
| `proposerId` | string | Yes | User proposing the change |
| `proposerOrg` | string | Yes | Proposer organization MSP ID |
| `description` | string | Yes | Human-readable description of the proposed change |
| `changeHash` | string | Yes | Hash of the proposed change |
| `requiredOrgs` | array | Yes | Array of org MSP IDs required to approve |

**Example Request**

```json
{
  "proposalId": "prop-2025-001",
  "modelId": "project-tower-a",
  "proposerId": "alice",
  "proposerOrg": "Org1MSP",
  "description": "Increase exterior wall thickness from 200mm to 300mm",
  "changeHash": "sha256:proposal-hash",
  "requiredOrgs": ["Org1MSP", "Org2MSP"]
}
```

**Response 201**

```json
{
  "proposalId": "prop-2025-001"
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 400 | Validation error |
| 401 | Unauthorized |
| 500 | Fabric transaction failure |

---

### POST /api/v1/governance/proposals/:id/approve

Approve a pending governance proposal.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | The proposal identifier |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User approving the proposal |
| `orgMspId` | string | Yes | Approver organization MSP ID |
| `comment` | string | No | Optional approval comment |

**Example Request**

```json
{
  "userId": "bob",
  "orgMspId": "Org2MSP",
  "comment": "Structural review confirms wall can support increased thickness"
}
```

**Response 200**

```json
{
  "status": "ok",
  "proposalId": "prop-2025-001"
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 400 | Invalid state or duplicate approval |
| 401 | Unauthorized |
| 500 | Fabric transaction failure |

---

### POST /api/v1/governance/proposals/:id/reject

Reject a pending governance proposal.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | The proposal identifier |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User rejecting the proposal |
| `orgMspId` | string | Yes | Rejecter organization MSP ID |
| `reason` | string | Yes | Reason for rejection |

**Example Request**

```json
{
  "userId": "carol",
  "orgMspId": "Org2MSP",
  "reason": "Increased wall thickness exceeds structural load limits"
}
```

**Response 200**

```json
{
  "status": "ok",
  "proposalId": "prop-2025-001"
}
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 400 | Invalid state or missing reason |
| 401 | Unauthorized |
| 500 | Fabric transaction failure |

---

### GET /api/v1/governance/pending?org=:orgMspId

Query all pending governance proposals for an organization.

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `org` | string | Yes | The organization MSP ID |

**Example Request**

```
GET /api/v1/governance/pending?org=Org2MSP
```

**Response 200**

```json
[
  {
    "docType": "governance",
    "proposalId": "prop-2025-001",
    "modelId": "project-tower-a",
    "proposerId": "alice",
    "proposerOrg": "Org1MSP",
    "description": "Increase exterior wall thickness from 200mm to 300mm",
    "changeHash": "sha256:proposal-hash",
    "status": "PROPOSED",
    "requiredOrgs": ["Org1MSP", "Org2MSP"],
    "approvals": [],
    "rejections": [],
    "createdAt": "2025-06-15T10:30:00.000Z"
  }
]
```

**Error Responses**

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
