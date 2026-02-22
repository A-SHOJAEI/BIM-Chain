# BIM-Chain: Blockchain-Secured BIM Collaboration

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Go Tests](https://img.shields.io/badge/chaincode_tests-59_passing-brightgreen)]()
[![Node Tests](https://img.shields.io/badge/middleware_tests-36_passing-brightgreen)]()
[![Frontend Tests](https://img.shields.io/badge/frontend_tests-33_passing-brightgreen)]()
[![Plugin Tests](https://img.shields.io/badge/plugin_tests-24_passing-brightgreen)]()

---

## What is BIM-Chain?

BIM-Chain connects Autodesk Revit to a private blockchain network so that every design change made by any team member is permanently and tamper-proof recorded.

**In plain terms:** Imagine a shared Google Doc where every keystroke is logged, every contributor is identified by their company badge, and no one -- not even an administrator -- can delete or alter the history. BIM-Chain does the same thing for building designs in Revit.

### Who is this for?

| Role | What BIM-Chain gives you |
|------|--------------------------|
| **Project Managers** | A tamper-proof log of every design change -- who did what, when, and for which organization. No more "he said, she said" in design disputes. |
| **Architects & Engineers** | Your individual contributions to a shared model are permanently attributed to you. Every wall, beam, or duct you create or modify carries your name and your firm's identity on the blockchain. |
| **Legal / Compliance** | Court-admissible, cryptographically verifiable evidence of authorship and modification history for every element in the building model. |
| **IT / DevOps** | A Hyperledger Fabric permissioned blockchain with Raft consensus, mutual TLS, and X.509 certificate-based identity -- no cryptocurrency, no public exposure, fully enterprise-controlled. |

### How it works (the 30-second version)

1. A designer opens a Revit project. The BIM-Chain plugin starts automatically.
2. The designer draws a wall, moves a door, or deletes a column -- normal Revit work.
3. Behind the scenes, the plugin captures each change (element ID, geometry hash, change type) and sends it to the BIM-Chain middleware server.
4. The middleware writes the change to a Hyperledger Fabric blockchain shared across all participating firms.
5. A web dashboard lets anyone on the project view the full audit trail, see who created each element (IP attribution), and approve or reject design governance proposals.

No extra steps for the designer. No new software to learn. Revit works exactly as before -- BIM-Chain adds the blockchain layer transparently.

---

## The Problem

### BIM platforms have no native security model

The AEC industry relies on BIM platforms like Autodesk Revit as the single source of truth for multi-billion-dollar construction projects, yet these platforms were designed for productivity -- not security. In 2025, seven CVEs were disclosed for Autodesk Revit (CVE-2025-1256 through CVE-2025-1651), exposing vulnerabilities from out-of-bounds writes to use-after-free conditions triggered by maliciously crafted model files. Meanwhile, construction has become the top global target for ransomware, with groups like LockBit and ALPHV/BlackCat systematically targeting AEC firms because they hold time-sensitive project data.

### No element-level IP protection exists

Despite the collaborative nature of BIM workflows -- where architects, structural engineers, MEP consultants, and contractors all contribute to a shared model -- no commercial BIM platform provides element-level intellectual property attribution. When a structural engineer modifies a beam or an architect refines a facade panel, that contribution is either untracked or buried in coarse-grained Revit worksharing logs. In disputes over design credit, liability, or contractual deliverables, there is no cryptographically verifiable record of who created or modified any individual element.

### Audit trails are centralized and unverifiable

Existing audit trails in BIM environments are centralized, server-side logs that can be modified or deleted by anyone with administrative access. They lack cryptographic verification -- there is no way to prove a log entry has not been tampered with. BIM-Chain fills this gap by recording every change on a Hyperledger Fabric blockchain where committed transactions are secured by the consensus of multiple independent organizations and cannot be altered retroactively.

---

## Features

| Feature | Description |
|---------|-------------|
| **Immutable Audit Trail** | Every BIM element change is recorded on the blockchain with the author's identity, organization, SHA-256 element hash, and timestamp. Once committed, entries cannot be modified or deleted by any party. |
| **IP Attribution** | Intellectual property ownership is tracked at the individual element level. Each element carries a provenance chain linking it to every contributor who has created or modified it. |
| **Governance Workflows** | Design changes can be submitted as on-chain proposals. Approvers from each stakeholder organization vote to approve or reject, with the full lifecycle recorded immutably. |
| **Real-time Dashboard** | A web dashboard shows live audit timelines, element provenance, governance proposals, and connection status. |
| **Transparent to Designers** | The Revit plugin captures changes automatically in the background. Designers work in Revit exactly as they normally would. |

---

## Architecture

BIM-Chain has four layers:

```
  Revit Plugin (C#)          Next.js Dashboard
       |                           |
       | REST + JWT                | REST + JWT
       v                           v
  Fastify Middleware (Node.js/TypeScript)
       |
       | gRPC + mutual TLS
       v
  Hyperledger Fabric Network
  (2 orgs, 4 peers, 5 Raft orderers, CouchDB, Fabric CA)
```

**Data flow:** The Revit plugin captures element-level changes and sends them as authenticated REST requests to the middleware. The middleware validates the request, enriches it with organizational context, and submits a transaction to the Hyperledger Fabric network. Go smart contracts (chaincode) execute the business logic -- recording audit entries, registering IP assets, or processing governance proposals. CouchDB stores the world state for rich queries. The Next.js dashboard lets stakeholders monitor audit trails, review proposals, and inspect IP attribution.

### Blockchain network topology

| Component | Count | Details |
|-----------|-------|---------|
| Peer organizations | 2 | ArchitectOrg, EngineerOrg |
| Peers per org | 2 | 4 total peers |
| Orderer nodes | 5 | Raft consensus |
| Certificate authorities | 2 | One per organization |
| State databases | 4 | CouchDB (one per peer) |

Each organization operates its own peers and certificate authority. All inter-node communication uses mutual TLS. This means no single organization controls the network -- both must participate for transactions to be committed.

---

## Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker & Docker Compose | Latest stable | Runs the Fabric network, CouchDB, and services |
| Node.js | 20 LTS or later | Middleware API server and frontend build |
| Go | 1.21+ | Compile and test chaincode |
| .NET SDK | 8.0+ | Build the Revit plugin (Windows only) |
| Autodesk Revit | 2024 or 2026 | Required only for the plugin (Windows only) |

### Step 1 -- Clone the repository

```bash
git clone https://github.com/A-SHOJAEI/BIM-Chain.git
cd BIM-Chain
```

### Step 2 -- Install dependencies

```bash
# Middleware
cd packages/middleware
npm ci

# Frontend
cd ../frontend
npm ci

cd ../..
```

### Step 3 -- Start the Fabric network

```bash
cd network/scripts
./setup.sh
```

This script generates cryptographic material, creates the channel genesis block, launches all Docker containers (peers, orderers, CAs, CouchDB), joins peers to the channel, and sets anchor peers.

### Step 4 -- Deploy the smart contracts

```bash
./deploy-chaincode.sh    # Package, install, approve, and commit chaincode
./enroll-users.sh        # Register and enroll users for both organizations
```

### Step 5 -- Start the middleware and dashboard

```bash
# Terminal 1: Middleware API
cd packages/middleware
npm run dev
# Runs at http://localhost:3001

# Terminal 2: Frontend dashboard
cd packages/frontend
npm run dev
# Dashboard runs at http://localhost:3000
```

Open http://localhost:3000 in your browser. The dashboard should show a green "Connected" indicator.

### Step 6 -- Install the Revit plugin (Windows only)

```bash
cd packages/revit-plugin
dotnet build BIMChain.sln --configuration Release
```

Copy the built files to Revit's add-in directory:

```
%APPDATA%\Autodesk\Revit\Addins\2026\
```

Place both:
- `BIMChain.addin` (manifest file)
- `BIMChain\` folder (containing `BIMChain.Plugin.dll` and dependencies)

Launch Revit. You will see a **BIM Chain** tab in the ribbon with three buttons:
- **Sync Now** -- Manually push queued changes to the blockchain
- **Status** -- View connection status, queue count, and organization info
- **Open Dashboard** -- Open the web dashboard in your browser

The plugin also auto-syncs every 30 seconds in the background.

### Development mode (without Docker)

For development and testing without a full Fabric network, the middleware includes a mock mode:

```bash
# Start middleware in mock mode
cd packages/middleware
FABRIC_MOCK=true PORT=3100 npm run dev

# Start frontend pointing to middleware
cd packages/frontend
NEXT_PUBLIC_API_URL=http://localhost:3100 npm run dev -- -p 3200
```

Mock mode simulates the blockchain in memory -- all API endpoints work identically, but data is not persisted between restarts.

> **Note on Windows:** If ports 3000/3001 are blocked (common with Hyper-V), use alternative ports as shown above (3100/3200). Update the Revit plugin's API URL in the Status dialog accordingly.

---

## Project Structure

```
BIM-Chain/
├── packages/
│   ├── chaincode-go/           # Smart contracts (Go)
│   │   ├── audit/              #   Audit trail recording and queries
│   │   ├── ipasset/            #   IP attribution and element ownership
│   │   ├── governance/         #   Proposal and voting workflows
│   │   ├── shared/             #   Shared types and utilities
│   │   └── main.go             #   Chaincode entry point
│   ├── middleware/             # REST API server (Node.js/Fastify/TypeScript)
│   │   ├── src/
│   │   │   ├── routes/         #   API route handlers
│   │   │   ├── services/       #   Fabric Gateway integration + mock service
│   │   │   └── middleware/     #   JWT auth and request validation
│   │   └── tests/              #   Unit and integration tests (36 tests)
│   ├── frontend/               # Web dashboard (Next.js 14 / React / Tailwind)
│   │   ├── app/                #   Pages: home, audit, IP, governance
│   │   ├── components/         #   UI components
│   │   ├── lib/                #   API client with auto-authentication
│   │   └── __tests__/          #   Component and API tests (33 tests)
│   └── revit-plugin/           # Autodesk Revit add-in (C# .NET 8)
│       ├── BIMChain.Plugin/    #   Plugin source, commands, and event handlers
│       └── BIMChain.Tests/     #   Unit tests (24 tests)
├── network/
│   ├── docker/                 # Docker Compose files
│   │   ├── docker-compose-fabric.yaml    # Peers, orderers, CAs, CouchDB
│   │   └── docker-compose-services.yaml  # Middleware, frontend, IPFS
│   ├── configtx/               # Fabric channel configuration
│   ├── crypto-config/          # Generated cryptographic material
│   ├── channel-artifacts/      # Channel genesis block and anchor peer configs
│   └── scripts/
│       ├── setup.sh            # Initialize and start the Fabric network
│       ├── teardown.sh         # Stop and remove all containers
│       ├── deploy-chaincode.sh # Package, install, and commit chaincode
│       └── enroll-users.sh     # Register and enroll Fabric CA identities
├── tests/
│   ├── contract/               # Cross-component contract tests
│   └── e2e/                    # End-to-end integration tests
├── docs/                       # Detailed documentation
│   ├── architecture.md         #   System architecture deep-dive
│   ├── api-reference.md        #   REST API endpoint reference
│   ├── chaincode-reference.md  #   Smart contract function reference
│   ├── deployment-guide.md     #   Production deployment instructions
│   └── revit-plugin-guide.md   #   Plugin installation and usage guide
├── .github/workflows/          # CI/CD pipelines (GitHub Actions)
│   ├── chaincode.yml
│   ├── middleware.yml
│   ├── frontend.yml
│   ├── integration.yml
│   └── revit-plugin.yml
├── CONTRIBUTING.md
├── SECURITY.md
├── CODE_OF_CONDUCT.md
└── LICENSE                     # Apache License 2.0
```

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Revit Plugin | C# / .NET 8, Revit API | Captures element-level BIM changes directly from the designer's environment |
| Middleware | Node.js 20, Fastify 5, TypeScript | REST API gateway with JWT auth, validation, and Fabric Gateway integration |
| Blockchain | Hyperledger Fabric 2.5 LTS | Permissioned distributed ledger with Raft consensus and MSP-based identity |
| Smart Contracts | Go 1.22, Fabric Contract API | On-chain logic for audit recording, IP management, and governance |
| State Database | Apache CouchDB | JSON document store for rich queries against the Fabric world state |
| Frontend | Next.js 14, React 18, Tailwind CSS | Real-time dashboard for audit trails, IP attribution, and governance |
| Authentication | JWT + Fabric CA (X.509) | JWT for REST sessions, X.509 certificates for blockchain transaction signing |
| CI/CD | GitHub Actions | Automated build, test, and lint pipelines for every component |
| Containers | Docker Compose | Local development and testing environment |

---

## Test Results

All automated tests pass across all four components:

| Component | Tests | Framework |
|-----------|-------|-----------|
| Go Chaincode | 59 passing (4 packages) | Go testing |
| Middleware | 36 passing (7 suites) | Jest + Supertest |
| Frontend | 33 passing (7 suites) | Jest + React Testing Library |
| Revit Plugin | 24 passing | xUnit |
| **Total** | **152 passing** | |

Manual integration testing was performed with Revit 2026 and covered:
- Element creation, modification, and deletion captured as blockchain records
- Bulk operations (multiple elements in one session)
- IP attribution showing correct creator and organization
- Governance proposal workflow (create, approve, reject)

---

## API Endpoints

The middleware exposes these REST endpoints (all require JWT authentication):

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Authenticate and receive a JWT token |
| POST | `/api/v1/changes` | Submit element change records to the blockchain |
| GET | `/api/v1/audit-trail/:modelId` | Retrieve audit trail for a model |
| GET | `/api/v1/ip-attribution/:elementId` | Get IP attribution for an element |
| GET | `/api/v1/governance/pending?org=OrgId` | List pending governance proposals |
| POST | `/api/v1/governance/proposals` | Create a new governance proposal |
| POST | `/api/v1/governance/proposals/:id/approve` | Approve a proposal |
| POST | `/api/v1/governance/proposals/:id/reject` | Reject a proposal |
| GET | `/health` | Health check (no auth required) |

Full API documentation with request/response schemas: [docs/api-reference.md](docs/api-reference.md)

---

## Documentation

- **[Architecture Overview](docs/architecture.md)** -- System architecture, data flow, consensus model, and security boundaries
- **[API Reference](docs/api-reference.md)** -- REST API endpoints, schemas, authentication, and examples
- **[Chaincode Reference](docs/chaincode-reference.md)** -- Smart contract functions, transaction semantics, and CouchDB indexes
- **[Deployment Guide](docs/deployment-guide.md)** -- Production deployment with TLS, Fabric CA, and monitoring
- **[Revit Plugin Guide](docs/revit-plugin-guide.md)** -- Plugin installation, configuration, and troubleshooting

---

## Frequently Asked Questions

**Do designers need to change how they work in Revit?**
No. The plugin runs invisibly in the background. Designers create, modify, and delete elements exactly as they normally would. Changes are captured and synced automatically every 30 seconds.

**Is this a cryptocurrency?**
No. Hyperledger Fabric is a permissioned enterprise blockchain with no cryptocurrency, no mining, and no public exposure. Only organizations explicitly invited to the network can participate.

**Can a single organization tamper with the records?**
No. Transactions require endorsement from peers in multiple organizations before they are committed. No single organization can unilaterally alter the ledger.

**What happens if the network goes down?**
The Revit plugin queues changes locally. When connectivity is restored, queued changes are automatically submitted on the next sync cycle.

**Does this replace Revit's built-in worksharing?**
No. BIM-Chain complements worksharing by adding a tamper-proof audit layer on top. Revit's native collaboration features continue to work as before.

**What Revit versions are supported?**
The plugin targets .NET 8 and has been tested with Revit 2026. It should also work with Revit 2024 and 2025 (which support .NET 8 add-ins).

---

## Contributing

We welcome contributions from the AEC technology and blockchain communities. Please read our **[Contributing Guide](CONTRIBUTING.md)** before submitting a pull request.

- Fork the repository and create a feature branch from `main`
- Ensure all existing tests pass and add tests for your changes
- Follow the established code style for each language (Go, TypeScript, C#)
- Open a pull request with a clear description of the change

Please review our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Security

If you discover a vulnerability, **do not open a public issue.** Follow the responsible disclosure process in our **[Security Policy](SECURITY.md)**.

BIM-Chain's security relies on Hyperledger Fabric's permissioned architecture, mutual TLS for all gRPC communication, X.509 certificate-based identity, and JWT authentication for REST API access. All transactions are endorsed by peers across independent organizations before being committed.

---

## License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE) for the full text.

Copyright 2025 BIM-Chain Contributors.
