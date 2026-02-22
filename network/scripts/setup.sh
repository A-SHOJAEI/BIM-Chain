#!/bin/bash
#
# BIM-Chain Network Setup Script (Fabric 2.5 - Channel Participation API)
# Uses cryptogen for dev crypto + osnadmin for channel creation
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$NETWORK_DIR")"
CRYPTO_DIR="${NETWORK_DIR}/crypto-config"
CHANNEL_ARTIFACTS_DIR="${NETWORK_DIR}/channel-artifacts"
DOCKER_DIR="${NETWORK_DIR}/docker"
CONFIGTX_DIR="${NETWORK_DIR}/configtx"
BIN_DIR="${PROJECT_ROOT}/bin"

CHANNEL_NAME="bim-project"

export FABRIC_CFG_PATH="${CONFIGTX_DIR}"
export PATH="${BIN_DIR}:${PATH}"

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------
log_info() {
    echo "========================================================================"
    echo "  [INFO] $1"
    echo "========================================================================"
}

log_step() {
    echo ""
    echo "--- $1 ---"
}

check_prerequisites() {
    log_info "Checking prerequisites"

    local missing=0
    for cmd in cryptogen configtxgen osnadmin peer docker; do
        if ! command -v "$cmd" &>/dev/null; then
            echo "[ERROR] Required command not found: $cmd"
            missing=1
        fi
    done

    if [ "$missing" -eq 1 ]; then
        echo "[ERROR] Please install missing prerequisites."
        echo "        Run: ./install-fabric.sh --fabric-version 2.5.0 binary"
        exit 1
    fi

    echo "[OK] All prerequisites found."
}

# ---------------------------------------------------------------------------
# Step 1: Generate Crypto Material using cryptogen
# ---------------------------------------------------------------------------
generate_crypto_material() {
    log_info "Step 1: Generating crypto material using cryptogen"

    rm -rf "${CRYPTO_DIR}"
    mkdir -p "${CRYPTO_DIR}"

    cryptogen generate \
        --config="${CONFIGTX_DIR}/crypto-config.yaml" \
        --output="${CRYPTO_DIR}"

    echo "[OK] Crypto material generated."
}

# ---------------------------------------------------------------------------
# Step 2: Generate Channel Genesis Block
# ---------------------------------------------------------------------------
generate_channel_artifacts() {
    log_info "Step 2: Generating channel genesis block for '${CHANNEL_NAME}'"

    rm -rf "${CHANNEL_ARTIFACTS_DIR}"
    mkdir -p "${CHANNEL_ARTIFACTS_DIR}"

    # For channel participation API, we generate the channel genesis block directly
    configtxgen \
        -profile BIMProjectChannel \
        -outputBlock "${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}.block" \
        -channelID "${CHANNEL_NAME}"

    echo "[OK] Channel genesis block generated."
}

# ---------------------------------------------------------------------------
# Step 3: Start Docker Compose Network
# ---------------------------------------------------------------------------
start_network() {
    log_info "Step 3: Starting Docker Compose network"

    docker compose -f "${DOCKER_DIR}/docker-compose-fabric.yaml" up -d
    echo "Waiting 15 seconds for containers to initialize..."
    sleep 15

    docker ps --format "table {{.Names}}\t{{.Status}}" | grep bimchain || true

    echo "[OK] Docker Compose network started."
}

# ---------------------------------------------------------------------------
# Step 4: Join Orderers to Channel via osnadmin
# ---------------------------------------------------------------------------
join_orderers_to_channel() {
    log_info "Step 4: Joining orderers to channel '${CHANNEL_NAME}'"

    local ORDERER_TLS_DIR="${CRYPTO_DIR}/ordererOrganizations/bimchain.com/orderers"
    local ORDERER_ADMIN_TLS="${CRYPTO_DIR}/ordererOrganizations/bimchain.com/users/Admin@bimchain.com/tls"

    # Join each orderer using osnadmin
    local ports=(7053 8053 9053 10053 11053)
    local names=(orderer1 orderer2 orderer3 orderer4 orderer5)

    for i in "${!names[@]}"; do
        local name="${names[$i]}"
        local port="${ports[$i]}"

        log_step "Joining ${name}.bimchain.com to channel"
        osnadmin channel join \
            --channelID "${CHANNEL_NAME}" \
            --config-block "${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}.block" \
            -o "localhost:${port}" \
            --ca-file "${ORDERER_TLS_DIR}/${name}.bimchain.com/msp/tlscacerts/tlsca.bimchain.com-cert.pem" \
            --client-cert "${ORDERER_ADMIN_TLS}/client.crt" \
            --client-key "${ORDERER_ADMIN_TLS}/client.key"

        echo "[OK] ${name} joined channel."
    done

    echo "[OK] All orderers joined channel '${CHANNEL_NAME}'."
}

# ---------------------------------------------------------------------------
# Step 5: Join Peers to Channel
# ---------------------------------------------------------------------------
join_peers_to_channel() {
    log_info "Step 5: Joining peers to channel '${CHANNEL_NAME}'"

    export CORE_PEER_TLS_ENABLED=true

    # --- peer0.architect ---
    log_step "Joining peer0.architect.bimchain.com"
    export CORE_PEER_LOCALMSPID="ArchitectOrgMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_DIR}/peerOrganizations/architect.bimchain.com/peers/peer0.architect.bimchain.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${CRYPTO_DIR}/peerOrganizations/architect.bimchain.com/users/Admin@architect.bimchain.com/msp"
    export CORE_PEER_ADDRESS="localhost:7051"

    # Fetch the channel genesis block from an orderer
    peer channel fetch 0 "${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}-peer.block" \
        -o localhost:7050 \
        -c "${CHANNEL_NAME}" \
        --tls \
        --cafile "${CRYPTO_DIR}/ordererOrganizations/bimchain.com/orderers/orderer1.bimchain.com/msp/tlscacerts/tlsca.bimchain.com-cert.pem"

    peer channel join -b "${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}-peer.block"

    # --- peer1.architect ---
    log_step "Joining peer1.architect.bimchain.com"
    export CORE_PEER_ADDRESS="localhost:8051"
    peer channel join -b "${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}-peer.block"

    # --- peer0.engineer ---
    log_step "Joining peer0.engineer.bimchain.com"
    export CORE_PEER_LOCALMSPID="EngineerOrgMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_DIR}/peerOrganizations/engineer.bimchain.com/peers/peer0.engineer.bimchain.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${CRYPTO_DIR}/peerOrganizations/engineer.bimchain.com/users/Admin@engineer.bimchain.com/msp"
    export CORE_PEER_ADDRESS="localhost:9051"
    peer channel join -b "${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}-peer.block"

    # --- peer1.engineer ---
    log_step "Joining peer1.engineer.bimchain.com"
    export CORE_PEER_ADDRESS="localhost:10051"
    peer channel join -b "${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}-peer.block"

    echo "[OK] All peers joined channel '${CHANNEL_NAME}'."
}

# ---------------------------------------------------------------------------
# Step 6: Set Anchor Peers
# ---------------------------------------------------------------------------
set_anchor_peers() {
    log_info "Step 6: Setting anchor peers"

    local ORDERER_CA="${CRYPTO_DIR}/ordererOrganizations/bimchain.com/orderers/orderer1.bimchain.com/msp/tlscacerts/tlsca.bimchain.com-cert.pem"

    # Generate anchor peer update for ArchitectOrg
    log_step "Updating anchor peer for ArchitectOrg"
    export CORE_PEER_LOCALMSPID="ArchitectOrgMSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_DIR}/peerOrganizations/architect.bimchain.com/peers/peer0.architect.bimchain.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${CRYPTO_DIR}/peerOrganizations/architect.bimchain.com/users/Admin@architect.bimchain.com/msp"
    export CORE_PEER_ADDRESS="localhost:7051"

    # Use configtxlator to compute anchor peer update
    peer channel fetch config "${CHANNEL_ARTIFACTS_DIR}/config_block.pb" \
        -o localhost:7050 -c "${CHANNEL_NAME}" --tls --cafile "${ORDERER_CA}"

    configtxlator proto_decode --input "${CHANNEL_ARTIFACTS_DIR}/config_block.pb" --type common.Block \
        | jq '.data.data[0].payload.data.config' > "${CHANNEL_ARTIFACTS_DIR}/config.json"

    jq '.channel_group.groups.Application.groups.ArchitectOrgMSP.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers":[{"host":"peer0.architect.bimchain.com","port":7051}]},"version":"0"}}' \
        "${CHANNEL_ARTIFACTS_DIR}/config.json" > "${CHANNEL_ARTIFACTS_DIR}/modified_config.json"

    configtxlator proto_encode --input "${CHANNEL_ARTIFACTS_DIR}/config.json" --type common.Config \
        --output "${CHANNEL_ARTIFACTS_DIR}/config.pb"
    configtxlator proto_encode --input "${CHANNEL_ARTIFACTS_DIR}/modified_config.json" --type common.Config \
        --output "${CHANNEL_ARTIFACTS_DIR}/modified_config.pb"
    configtxlator compute_update --channel_id "${CHANNEL_NAME}" \
        --original "${CHANNEL_ARTIFACTS_DIR}/config.pb" \
        --updated "${CHANNEL_ARTIFACTS_DIR}/modified_config.pb" \
        --output "${CHANNEL_ARTIFACTS_DIR}/anchor_update.pb"

    echo '{"payload":{"header":{"channel_header":{"channel_id":"'${CHANNEL_NAME}'","type":2}},"data":{"config_update":'$(configtxlator proto_decode --input "${CHANNEL_ARTIFACTS_DIR}/anchor_update.pb" --type common.ConfigUpdate | jq -c .)'}}}' \
        | configtxlator proto_encode --type common.Envelope --output "${CHANNEL_ARTIFACTS_DIR}/anchor_update_envelope.pb"

    peer channel update -f "${CHANNEL_ARTIFACTS_DIR}/anchor_update_envelope.pb" \
        -c "${CHANNEL_NAME}" -o localhost:7050 --tls --cafile "${ORDERER_CA}" || echo "[WARN] Anchor peer update for ArchitectOrg may have already been applied"

    echo "[OK] Anchor peers configured (ArchitectOrg)."
    echo "[NOTE] EngineerOrg anchor peer is set in configtx.yaml genesis block."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    log_info "BIM-Chain Network Setup (Fabric 2.5 - Channel Participation API)"
    echo "Network directory: ${NETWORK_DIR}"
    echo "Channel name:      ${CHANNEL_NAME}"
    echo ""

    check_prerequisites
    generate_crypto_material
    generate_channel_artifacts
    start_network
    join_orderers_to_channel
    join_peers_to_channel
    set_anchor_peers

    log_info "BIM-Chain network setup complete!"
    echo ""
    echo "Channel '${CHANNEL_NAME}' is ready with the following peers:"
    echo "  - peer0.architect.bimchain.com:7051"
    echo "  - peer1.architect.bimchain.com:8051"
    echo "  - peer0.engineer.bimchain.com:9051"
    echo "  - peer1.engineer.bimchain.com:10051"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy chaincode using: ./deploy-chaincode.sh"
    echo "  2. Start application services using docker-compose-services.yaml"
}

main "$@"
