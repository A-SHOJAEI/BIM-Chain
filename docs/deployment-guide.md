# BIM-Chain Deployment Guide

This guide covers deploying the complete BIM-Chain system from development through production, including the Hyperledger Fabric blockchain network, middleware API, frontend dashboard, and supporting services.

---

## Prerequisites

| Component | Version | Purpose |
|-----------|---------|---------|
| Docker Engine | 24+ | Container runtime for all services |
| Docker Compose | v2 (plugin) | Multi-container orchestration |
| Go | 1.21+ | Chaincode compilation |
| Node.js | 20 LTS | Middleware and frontend build |
| .NET SDK | 8.0 | Revit plugin build |
| Hyperledger Fabric binaries | 2.5 | `peer`, `orderer`, `configtxgen`, `cryptogen` |
| Fabric CA Client | 1.5 | Certificate enrollment |

### Installing Fabric Binaries

```bash
# Download Fabric binaries and Docker images
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh --fabric-version 2.5.0 --ca-version 1.5.7 binary docker

# Add binaries to PATH
export PATH=$PWD/bin:$PATH
```

---

## Directory Structure

```
BIM-Chain/
  network/
    configtx/
      configtx.yaml              # Channel and organization configuration
      crypto-config.yaml         # Cryptogen topology definition
    docker/
      docker-compose-fabric.yaml # Fabric network (peers, orderers, CAs, CouchDB)
      docker-compose-services.yaml # Application services (middleware, frontend, IPFS)
    crypto-config/               # Generated certificates and keys
    scripts/                     # Setup, teardown, deployment scripts
  packages/
    chaincode-go/                # Go chaincode source
    middleware/                   # Fastify REST API
    frontend/                    # Next.js dashboard
    revit-plugin/                # .NET 8 Revit add-in
  config/
    configtx.yaml                # Reference configuration
    core.yaml                    # Peer configuration reference
    orderer.yaml                 # Orderer configuration reference
```

---

## Development Setup (Docker Compose)

The development environment runs the entire BIM-Chain stack in Docker containers on a single machine.

### Step 1: Generate Cryptographic Material

For development, use `cryptogen` to generate certificates based on the topology defined in `crypto-config.yaml`:

```bash
cd network/configtx

# Generate crypto material for all organizations
cryptogen generate --config=crypto-config.yaml --output=../crypto-config
```

This creates the following organizational structure:
- **OrdererOrg** (`bimchain.com`): 5 orderer identities + 1 admin
- **ArchitectOrg** (`architect.bimchain.com`): 2 peer identities + 1 user + 1 admin
- **EngineerOrg** (`engineer.bimchain.com`): 2 peer identities + 1 user + 1 admin

### Step 2: Generate Channel Configuration

```bash
# Generate the channel creation transaction
configtxgen -profile BIMProjectChannel \
  -outputCreateChannelTx ../channel-artifacts/bim-project.tx \
  -channelID bim-project \
  -configPath .

# Generate anchor peer updates for each org
configtxgen -profile BIMProjectChannel \
  -outputAnchorPeersUpdate ../channel-artifacts/ArchitectOrgAnchors.tx \
  -channelID bim-project \
  -asOrg ArchitectOrg \
  -configPath .

configtxgen -profile BIMProjectChannel \
  -outputAnchorPeersUpdate ../channel-artifacts/EngineerOrgAnchors.tx \
  -channelID bim-project \
  -asOrg EngineerOrg \
  -configPath .
```

### Step 3: Start the Fabric Network

```bash
cd network/docker

# Start the Fabric network (peers, orderers, CAs, CouchDB)
docker compose -f docker-compose-fabric.yaml up -d
```

This launches:

| Container | Image | Ports |
|-----------|-------|-------|
| `ca.architect.bimchain.com` | `hyperledger/fabric-ca:1.5` | 7054 |
| `ca.engineer.bimchain.com` | `hyperledger/fabric-ca:1.5` | 8054 |
| `orderer1.bimchain.com` | `hyperledger/fabric-orderer:2.5` | 7050, 7053 |
| `orderer2.bimchain.com` | `hyperledger/fabric-orderer:2.5` | 8050, 8053 |
| `orderer3.bimchain.com` | `hyperledger/fabric-orderer:2.5` | 9050, 9053 |
| `orderer4.bimchain.com` | `hyperledger/fabric-orderer:2.5` | 10050, 10053 |
| `orderer5.bimchain.com` | `hyperledger/fabric-orderer:2.5` | 11050, 11053 |
| `peer0.architect.bimchain.com` | `hyperledger/fabric-peer:2.5` | 7051 |
| `peer1.architect.bimchain.com` | `hyperledger/fabric-peer:2.5` | 8051 |
| `peer0.engineer.bimchain.com` | `hyperledger/fabric-peer:2.5` | 9051 |
| `peer1.engineer.bimchain.com` | `hyperledger/fabric-peer:2.5` | 10051 |
| `couchdb.peer0.architect` | `couchdb:3.3` | 5984 |
| `couchdb.peer1.architect` | `couchdb:3.3` | 12984 |
| `couchdb.peer0.engineer` | `couchdb:3.3` | 7984 |
| `couchdb.peer1.engineer` | `couchdb:3.3` | 8984 |

### Step 4: Create Channel and Join Peers

```bash
# Set environment for ArchitectOrg admin
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="ArchitectOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=../crypto-config/peerOrganizations/architect.bimchain.com/peers/peer0.architect.bimchain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=../crypto-config/peerOrganizations/architect.bimchain.com/users/Admin@architect.bimchain.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# Create channel using channel participation API
osnadmin channel join \
  --channelID bim-project \
  --config-block ../channel-artifacts/bim-project.block \
  -o localhost:7053 \
  --ca-file ../crypto-config/ordererOrganizations/bimchain.com/orderers/orderer1.bimchain.com/tls/ca.crt \
  --client-cert ../crypto-config/ordererOrganizations/bimchain.com/orderers/orderer1.bimchain.com/tls/server.crt \
  --client-key ../crypto-config/ordererOrganizations/bimchain.com/orderers/orderer1.bimchain.com/tls/server.key

# Join peer0.architect to the channel
peer channel join -b ../channel-artifacts/bim-project.block

# Join peer1.architect
export CORE_PEER_ADDRESS=localhost:8051
export CORE_PEER_TLS_ROOTCERT_FILE=../crypto-config/peerOrganizations/architect.bimchain.com/peers/peer1.architect.bimchain.com/tls/ca.crt
peer channel join -b ../channel-artifacts/bim-project.block

# Switch to EngineerOrg admin and join peers
export CORE_PEER_LOCALMSPID="EngineerOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=../crypto-config/peerOrganizations/engineer.bimchain.com/peers/peer0.engineer.bimchain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=../crypto-config/peerOrganizations/engineer.bimchain.com/users/Admin@engineer.bimchain.com/msp
export CORE_PEER_ADDRESS=localhost:9051
peer channel join -b ../channel-artifacts/bim-project.block

export CORE_PEER_ADDRESS=localhost:10051
export CORE_PEER_TLS_ROOTCERT_FILE=../crypto-config/peerOrganizations/engineer.bimchain.com/peers/peer1.engineer.bimchain.com/tls/ca.crt
peer channel join -b ../channel-artifacts/bim-project.block
```

### Step 5: Deploy Chaincode

Package, install, approve, and commit the BIM governance chaincode using the Fabric lifecycle:

```bash
# Package the chaincode
cd ../../packages/chaincode-go
peer lifecycle chaincode package bim-governance.tar.gz \
  --path . \
  --lang golang \
  --label bim-governance_1.0

# Install on ArchitectOrg peers
export CORE_PEER_LOCALMSPID="ArchitectOrgMSP"
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=../../network/crypto-config/peerOrganizations/architect.bimchain.com/peers/peer0.architect.bimchain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=../../network/crypto-config/peerOrganizations/architect.bimchain.com/users/Admin@architect.bimchain.com/msp

peer lifecycle chaincode install bim-governance.tar.gz

# Query installed to get PACKAGE_ID
peer lifecycle chaincode queryinstalled
# Output: bim-governance_1.0:abc123def456...
export CC_PACKAGE_ID=bim-governance_1.0:<hash_from_output>

# Approve for ArchitectOrg
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 \
  --tls --cafile ../../network/crypto-config/ordererOrganizations/bimchain.com/orderers/orderer1.bimchain.com/tls/ca.crt \
  --channelID bim-project \
  --name bim-governance \
  --version 1.0 \
  --package-id $CC_PACKAGE_ID \
  --sequence 1

# Install on EngineerOrg peers and approve
export CORE_PEER_LOCALMSPID="EngineerOrgMSP"
export CORE_PEER_ADDRESS=localhost:9051
export CORE_PEER_TLS_ROOTCERT_FILE=../../network/crypto-config/peerOrganizations/engineer.bimchain.com/peers/peer0.engineer.bimchain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=../../network/crypto-config/peerOrganizations/engineer.bimchain.com/users/Admin@engineer.bimchain.com/msp

peer lifecycle chaincode install bim-governance.tar.gz
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 \
  --tls --cafile ../../network/crypto-config/ordererOrganizations/bimchain.com/orderers/orderer1.bimchain.com/tls/ca.crt \
  --channelID bim-project \
  --name bim-governance \
  --version 1.0 \
  --package-id $CC_PACKAGE_ID \
  --sequence 1

# Check commit readiness
peer lifecycle chaincode checkcommitreadiness \
  --channelID bim-project \
  --name bim-governance \
  --version 1.0 \
  --sequence 1

# Commit (requires endorsement from both orgs)
peer lifecycle chaincode commit \
  -o localhost:7050 \
  --tls --cafile ../../network/crypto-config/ordererOrganizations/bimchain.com/orderers/orderer1.bimchain.com/tls/ca.crt \
  --channelID bim-project \
  --name bim-governance \
  --version 1.0 \
  --sequence 1 \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles ../../network/crypto-config/peerOrganizations/architect.bimchain.com/peers/peer0.architect.bimchain.com/tls/ca.crt \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles ../../network/crypto-config/peerOrganizations/engineer.bimchain.com/peers/peer0.engineer.bimchain.com/tls/ca.crt

# Verify
peer lifecycle chaincode querycommitted --channelID bim-project --name bim-governance
```

### Step 6: Start Application Services

```bash
cd ../../network/docker

# Start IPFS, middleware, and frontend
docker compose -f docker-compose-services.yaml up -d
```

This launches:

| Container | Image | Ports | Purpose |
|-----------|-------|-------|---------|
| `bimchain-ipfs` | `ipfs/kubo:latest` | 4001, 5001, 8080 | Off-chain data storage |
| `bimchain-middleware` | Custom (Fastify) | 3001 | REST API + Fabric Gateway |
| `bimchain-frontend` | Custom (Next.js) | 3000 | Web dashboard |

### Step 7: Verify Deployment

```bash
# Middleware health check
curl http://localhost:3001/health
# Expected: {"status":"ok","service":"bim-chain-middleware","version":"0.1.0"}

# Frontend
curl -s http://localhost:3000 | head -1
# Expected: HTML content

# Authenticate and test chaincode
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpw"}' | jq -r '.token')

curl http://localhost:3001/api/v1/audit-trail/test-model \
  -H "Authorization: Bearer $TOKEN"
# Expected: [] (empty array, no records yet)
```

### Teardown

```bash
# Stop application services
docker compose -f docker-compose-services.yaml down -v

# Stop Fabric network and remove all data
docker compose -f docker-compose-fabric.yaml down -v

# Remove generated crypto material
rm -rf ../crypto-config ../channel-artifacts
```

---

## TLS Certificate Setup

All Fabric network communication uses mutual TLS. Certificates are organized as follows:

### Development (cryptogen)

In development, `cryptogen` generates all TLS certificates automatically based on `crypto-config.yaml`. Each node gets:

```
network/crypto-config/
  ordererOrganizations/bimchain.com/orderers/orderer1.bimchain.com/
    tls/
      ca.crt        # TLS CA root certificate
      server.crt    # Server TLS certificate
      server.key    # Server TLS private key
  peerOrganizations/architect.bimchain.com/peers/peer0.architect.bimchain.com/
    tls/
      ca.crt        # TLS CA root certificate
      server.crt    # Server TLS certificate
      server.key    # Server TLS private key
```

### Production (Fabric CA)

In production, use Fabric CA to issue TLS certificates. Each Fabric CA server has TLS enabled:

```yaml
# From docker-compose-fabric.yaml
environment:
  - FABRIC_CA_SERVER_TLS_ENABLED=true
```

To enroll a peer's TLS identity:

```bash
# Enroll TLS identity for peer0.architect
fabric-ca-client enroll \
  -u https://peer0:peer0pw@ca.architect.bimchain.com:7054 \
  --enrollment.profile tls \
  --csr.hosts peer0.architect.bimchain.com,localhost \
  --tls.certfiles /path/to/ca-cert.pem \
  -M /path/to/peer0-tls-msp
```

### Middleware TLS

For the middleware REST API in production, configure a TLS certificate (e.g., from Let's Encrypt) for HTTPS:

```bash
# Environment variables for middleware TLS
export MIDDLEWARE_TLS_CERT=/path/to/fullchain.pem
export MIDDLEWARE_TLS_KEY=/path/to/privkey.pem
```

The Fabric Gateway SDK connection from middleware to peers uses the peer's TLS CA certificate:

```typescript
// From app.ts - FabricServiceImpl constructor
const tlsCert = fs.readFileSync(path.resolve(this.tlsCertPath));
const tlsCredentials = grpc.credentials.createSsl(tlsCert);
```

---

## Fabric CA Configuration

Each organization runs its own Fabric CA for identity management.

### CA Server Configuration

The CA servers are configured via `fabric-ca-server-config.yaml` files located at:
- `network/crypto-config/fabric-ca/architect/fabric-ca-server-config.yaml`
- `network/crypto-config/fabric-ca/engineer/fabric-ca-server-config.yaml`

Key settings:

```yaml
# CA name (must match the org)
ca:
  name: ca-architect

# TLS configuration
tls:
  enabled: true
  certfile: /etc/hyperledger/fabric-ca-server/tls-cert.pem
  keyfile: /etc/hyperledger/fabric-ca-server/tls-key.pem

# CSR (Certificate Signing Request) defaults
csr:
  cn: ca.architect.bimchain.com
  names:
    - O: ArchitectOrg
      OU: Fabric
  hosts:
    - ca.architect.bimchain.com
    - localhost

# Database (default: SQLite for dev, PostgreSQL for production)
db:
  type: sqlite3
  datasource: fabric-ca-server.db
```

### Enrolling Users

Register and enroll application users via the Fabric CA client:

```bash
# Set CA client home
export FABRIC_CA_CLIENT_HOME=/tmp/ca-client

# Enroll the CA admin
fabric-ca-client enroll \
  -u https://admin:adminpw@ca.architect.bimchain.com:7054 \
  --tls.certfiles /path/to/ca-tls-cert.pem

# Register a new user
fabric-ca-client register \
  --id.name alice \
  --id.secret alicepw \
  --id.type client \
  --id.affiliation architect \
  --id.attrs 'hf.Registrar.Roles=client,role=designer:ecert' \
  --tls.certfiles /path/to/ca-tls-cert.pem

# Enroll the new user
fabric-ca-client enroll \
  -u https://alice:alicepw@ca.architect.bimchain.com:7054 \
  --tls.certfiles /path/to/ca-tls-cert.pem \
  -M /path/to/alice-msp
```

The middleware's `IdentityService` automates this process for API users. In production, replace the `MockIdentityService` with a `FabricCAIdentityService` that calls the Fabric CA client SDK.

---

## Environment Variables Reference

### Middleware

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP listen port |
| `HOST` | `0.0.0.0` | HTTP listen address |
| `JWT_SECRET` | `dev-secret-change-in-production` | Secret key for signing JWT tokens. **MUST be changed in production** to a cryptographically random value (at least 32 bytes). |
| `JWT_EXPIRY` | `1h` | JWT token expiry duration (e.g., `1h`, `30m`, `24h`) |
| `FABRIC_CONNECTION_PROFILE` | `""` (empty = mock mode) | Path to the Fabric connection profile JSON. When empty, the middleware uses `MockFabricService`. |
| `FABRIC_PEER_ENDPOINT` | `localhost:7051` | gRPC endpoint of the Fabric peer |
| `FABRIC_TLS_CERT_PATH` | `""` | Path to the peer's TLS CA certificate (PEM) |
| `FABRIC_MSP_ID` | `ArchitectOrgMSP` | MSP identifier for the connecting identity |
| `FABRIC_CERT_PATH` | `""` | Path to the user's enrollment certificate (PEM) |
| `FABRIC_KEY_PATH` | `""` | Path to the user's private key (PEM) |
| `FABRIC_CHANNEL` | `bim-project` | Fabric channel name |
| `FABRIC_CHAINCODE` | `bim-governance` | Chaincode name |
| `FABRIC_PEER_HOST_ALIAS` | `peer0.architect.bimchain.com` | TLS server name override for the peer connection |
| `USERS_JSON` | (see auth.ts defaults) | JSON string mapping usernames to `{password, orgId}` objects. Overrides the hardcoded dev users. |
| `NODE_ENV` | `development` | Node.js environment (`development`, `production`) |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP listen port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Middleware API URL (accessible from the browser) |
| `HOSTNAME` | `0.0.0.0` | Listen address |
| `NODE_ENV` | `development` | Node.js environment |

### Fabric Peer (docker-compose-fabric.yaml)

| Variable | Value | Description |
|----------|-------|-------------|
| `CORE_PEER_ID` | `peer0.architect.bimchain.com` | Unique peer identifier |
| `CORE_PEER_ADDRESS` | `peer0.architect.bimchain.com:7051` | Peer listen address |
| `CORE_PEER_LOCALMSPID` | `ArchitectOrgMSP` | Organization MSP ID |
| `CORE_PEER_TLS_ENABLED` | `true` | Enable TLS for peer communication |
| `CORE_PEER_GOSSIP_BOOTSTRAP` | `peer1.architect.bimchain.com:8051` | Gossip bootstrap peer address |
| `CORE_PEER_GOSSIP_EXTERNALENDPOINT` | `peer0.architect.bimchain.com:7051` | External gossip endpoint |
| `CORE_LEDGER_STATE_STATEDATABASE` | `CouchDB` | State database type |
| `CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS` | `couchdb.peer0.architect:5984` | CouchDB address |
| `CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME` | `bimadmin` | CouchDB username |
| `CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD` | `bimadminpw` | CouchDB password |
| `CORE_METRICS_PROVIDER` | `prometheus` | Metrics exporter type |

### Fabric Orderer

| Variable | Value | Description |
|----------|-------|-------------|
| `ORDERER_GENERAL_LISTENPORT` | `7050` | Client-facing listen port |
| `ORDERER_GENERAL_LOCALMSPID` | `OrdererMSP` | Orderer MSP ID |
| `ORDERER_GENERAL_TLS_ENABLED` | `true` | Enable TLS |
| `ORDERER_GENERAL_BOOTSTRAPMETHOD` | `none` | Uses channel participation API (no system channel) |
| `ORDERER_CHANNELPARTICIPATION_ENABLED` | `true` | Enable channel participation API |
| `ORDERER_ADMIN_LISTENADDRESS` | `0.0.0.0:7053` | Admin API listen address |

### Chaincode (CCAAS mode)

| Variable | Default | Description |
|----------|---------|-------------|
| `CHAINCODE_ID` | `""` | Chaincode package ID (required for CCAAS mode) |
| `CHAINCODE_SERVER_ADDRESS` | `""` | Address for the chaincode gRPC server (e.g., `0.0.0.0:9999`) |

### IPFS

| Variable | Value | Description |
|----------|-------|-------------|
| `IPFS_PROFILE` | `server` | IPFS configuration profile |
| `IPFS_API_URL` | `http://ipfs:5001` | IPFS API endpoint (used by middleware) |

---

## Kubernetes with Helm (Production)

For production deployments, Kubernetes provides scalability, rolling updates, and fault tolerance. The following guidance outlines the recommended approach.

### Architecture

In a Kubernetes deployment, each Fabric component runs as a separate pod:

```
Namespace: bimchain-fabric
  StatefulSet: orderer (5 replicas)
  StatefulSet: peer-architect (2 replicas)
  StatefulSet: peer-engineer (2 replicas)
  Deployment: ca-architect (1 replica)
  Deployment: ca-engineer (1 replica)
  StatefulSet: couchdb-architect (2 replicas)
  StatefulSet: couchdb-engineer (2 replicas)

Namespace: bimchain-app
  Deployment: middleware (2+ replicas, behind LoadBalancer)
  Deployment: frontend (2+ replicas, behind Ingress)
  StatefulSet: ipfs (1+ replicas)
```

### Helm Charts

Use the Hyperledger Fabric Helm charts as a starting point:

```bash
# Add the Hyperledger Helm repository
helm repo add hyperledger https://hyperledger.github.io/bevel

# Install peers
helm install arch-peer hyperledger/fabric-peer \
  --namespace bimchain-fabric \
  --set peer.mspID=ArchitectOrgMSP \
  --set peer.gossip.bootstrap=peer1-arch-peer:7051 \
  --set storage.size=10Gi \
  --values values-architect-peer.yaml

# Install orderers
helm install orderer hyperledger/fabric-orderer \
  --namespace bimchain-fabric \
  --set orderer.type=etcdraft \
  --set orderer.replicas=5 \
  --values values-orderer.yaml
```

### Persistent Storage

Use Kubernetes PersistentVolumeClaims (PVCs) for:
- Orderer block storage (`/var/hyperledger/production/orderer`)
- Peer ledger storage (`/var/hyperledger/production`)
- CouchDB data (`/opt/couchdb/data`)
- IPFS data (`/data/ipfs`)

Recommended storage class: `gp3` (AWS), `pd-ssd` (GCP), or `managed-premium` (Azure).

### Secrets Management

Store sensitive data in Kubernetes Secrets:

```bash
# Create secret for JWT signing key
kubectl create secret generic middleware-secrets \
  --namespace bimchain-app \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32)

# Create secret for Fabric identity
kubectl create secret generic fabric-identity \
  --namespace bimchain-app \
  --from-file=cert.pem=/path/to/user-cert.pem \
  --from-file=key.pem=/path/to/user-key.pem \
  --from-file=tls-ca.pem=/path/to/peer-tls-ca.pem

# Create secret for CouchDB credentials
kubectl create secret generic couchdb-credentials \
  --namespace bimchain-fabric \
  --from-literal=COUCHDB_USER=bimadmin \
  --from-literal=COUCHDB_PASSWORD=$(openssl rand -hex 16)
```

### Ingress

Configure an Ingress controller (e.g., nginx-ingress or AWS ALB) for external access:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: bimchain-ingress
  namespace: bimchain-app
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - bimchain.example.com
        - api.bimchain.example.com
      secretName: bimchain-tls
  rules:
    - host: bimchain.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 3000
    - host: api.bimchain.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: middleware
                port:
                  number: 3001
```

---

## Monitoring (Prometheus / Grafana)

### Fabric Peer Metrics

All Fabric peers in the BIM-Chain network are configured with `CORE_METRICS_PROVIDER=prometheus`, which exposes metrics on each peer's operations endpoint (default: port 9443).

Key metrics to monitor:

| Metric | Description |
|--------|-------------|
| `fabric_peer_proposal_count` | Number of proposals received by the peer |
| `fabric_peer_proposal_duration` | Proposal processing duration |
| `fabric_peer_endorser_proposal_duration` | Endorsement processing time |
| `fabric_peer_gossip_membership_total_peers_known` | Number of known peers in gossip network |
| `fabric_peer_ledger_block_processing_time` | Time to process and commit blocks |
| `fabric_peer_ledger_blockchain_height` | Current blockchain height |

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'fabric-peers'
    static_configs:
      - targets:
          - 'peer0.architect.bimchain.com:9443'
          - 'peer1.architect.bimchain.com:9443'
          - 'peer0.engineer.bimchain.com:9443'
          - 'peer1.engineer.bimchain.com:9443'
    tls_config:
      ca_file: /etc/prometheus/tls/ca.crt
      cert_file: /etc/prometheus/tls/client.crt
      key_file: /etc/prometheus/tls/client.key

  - job_name: 'fabric-orderers'
    static_configs:
      - targets:
          - 'orderer1.bimchain.com:8443'
          - 'orderer2.bimchain.com:8443'
          - 'orderer3.bimchain.com:8443'
          - 'orderer4.bimchain.com:8443'
          - 'orderer5.bimchain.com:8443'

  - job_name: 'middleware'
    static_configs:
      - targets: ['middleware:3001']
    metrics_path: /metrics

  - job_name: 'couchdb'
    static_configs:
      - targets:
          - 'couchdb.peer0.architect:5984'
          - 'couchdb.peer1.architect:5984'
          - 'couchdb.peer0.engineer:5984'
          - 'couchdb.peer1.engineer:5984'
    metrics_path: /_node/_local/_prometheus
```

### Grafana Dashboards

Recommended Grafana dashboards:

1. **Fabric Network Overview**: Blockchain height, transaction throughput, block processing time, gossip membership
2. **Chaincode Performance**: Proposal count, endorsement latency, chaincode execution time
3. **Middleware Health**: Request rate, response latency (p50/p95/p99), error rate, active connections
4. **CouchDB Health**: Read/write operations, disk usage, compaction status

The Hyperledger Fabric community provides pre-built Grafana dashboards that can be imported:
- Fabric Peer Dashboard: Grafana ID `10716`
- Fabric Orderer Dashboard: Grafana ID `10717`

---

## Backup and Recovery

### What to Back Up

| Component | Data Location | Backup Method | Frequency |
|-----------|---------------|---------------|-----------|
| **Fabric Ledger** (block files) | `/var/hyperledger/production` on each peer | Volume snapshot or file copy | Daily |
| **CouchDB World State** | `/opt/couchdb/data` on each CouchDB instance | CouchDB replication or volume snapshot | Daily |
| **Crypto Material** | `network/crypto-config/` | Encrypted file backup to secure storage | On change |
| **Channel Configuration** | `network/channel-artifacts/` | File backup | On change |
| **IPFS Data** | `/data/ipfs` on IPFS node | Volume snapshot or IPFS cluster replication | Daily |
| **Middleware Configuration** | Environment variables, connection profiles | Version control (git) | On change |

### Ledger Backup

The Fabric ledger is the most critical data store. Each peer maintains a complete copy, so the system can tolerate peer failures. However, you should still maintain offline backups.

```bash
# Stop the peer to ensure data consistency
docker stop peer0.architect.bimchain.com

# Create a backup of the ledger volume
docker run --rm \
  -v peer0.architect.bimchain.com:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/peer0-ledger-$(date +%Y%m%d).tar.gz -C /source .

# Restart the peer
docker start peer0.architect.bimchain.com
```

### CouchDB Backup

CouchDB supports continuous replication for backup:

```bash
# Create a one-time replication to a backup CouchDB
curl -X POST http://bimadmin:bimadminpw@localhost:5984/_replicate \
  -H "Content-Type: application/json" \
  -d '{
    "source": "http://bimadmin:bimadminpw@couchdb.peer0.architect:5984/bim-project_bim-governance",
    "target": "http://bimadmin:bimadminpw@backup-couchdb:5984/bim-project_bim-governance_backup",
    "create_target": true
  }'
```

### Crypto Material Backup

Crypto material (certificates and private keys) is essential for identity recovery. Store backups in an encrypted, access-controlled location:

```bash
# Create encrypted backup of crypto material
tar czf - network/crypto-config/ | \
  openssl enc -aes-256-cbc -salt -pbkdf2 \
  -out backups/crypto-material-$(date +%Y%m%d).tar.gz.enc
```

### Disaster Recovery Procedure

1. **Restore crypto material** from encrypted backup to the `network/crypto-config/` directory.
2. **Start infrastructure** (Docker or Kubernetes) with the restored crypto material.
3. **Restore ledger** by copying block files to the peer's production directory and restarting.
4. **Verify state** by querying the chaincode and comparing with the last known good state.
5. **Restore IPFS** data from backup or rely on IPFS cluster replication for off-chain data recovery.
6. **Restart application services** (middleware, frontend) and verify connectivity.

### Recovery Point Objective (RPO) and Recovery Time Objective (RTO)

| Scenario | RPO | RTO |
|----------|-----|-----|
| Single peer failure | 0 (other peers have full copy) | Minutes (restart or failover) |
| Single orderer failure | 0 (Raft tolerates 2 failures out of 5) | Automatic (Raft re-election) |
| CouchDB failure | 0 (rebuild from ledger) | Minutes (peer rebuilds state from blocks) |
| IPFS node failure | Last backup | Minutes to hours (restore from backup) |
| Full datacenter failure | Last off-site backup | Hours (full restore procedure) |
