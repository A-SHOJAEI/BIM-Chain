#!/bin/bash
#
# BIM-Chain Chaincode Deployment Script
# Packages, installs, approves, and commits chaincode using Fabric lifecycle
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"
CRYPTO_DIR="${NETWORK_DIR}/crypto-config"
CHANNEL_ARTIFACTS_DIR="${NETWORK_DIR}/channel-artifacts"
PROJECT_ROOT="$(dirname "$NETWORK_DIR")"

CHANNEL_NAME="bim-project"
CC_NAME="${1:-bimchain}"
CC_VERSION="${2:-1.0}"
CC_SEQUENCE="${3:-1}"
CC_SRC_PATH="${PROJECT_ROOT}/packages/chaincode-go"
CC_PACKAGE_FILE="${NETWORK_DIR}/${CC_NAME}.tar.gz"

ORDERER_ADDRESS="orderer1.bimchain.com:7050"
ORDERER_CA="${CRYPTO_DIR}/ordererOrganizations/bimchain.com/orderers/orderer1.bimchain.com/msp/tlscacerts/tlsca.bimchain.com-cert.pem"

export FABRIC_CFG_PATH="${NETWORK_DIR}/configtx"

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

set_peer_env() {
    local org="$1"
    local peer="$2"
    local port="$3"

    if [ "$org" = "architect" ]; then
        export CORE_PEER_LOCALMSPID="ArchitectOrgMSP"
        export CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_DIR}/peerOrganizations/architect.bimchain.com/peers/${peer}.architect.bimchain.com/tls/ca.crt"
        export CORE_PEER_MSPCONFIGPATH="${CRYPTO_DIR}/peerOrganizations/architect.bimchain.com/users/Admin@architect.bimchain.com/msp"
    else
        export CORE_PEER_LOCALMSPID="EngineerOrgMSP"
        export CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_DIR}/peerOrganizations/engineer.bimchain.com/peers/${peer}.engineer.bimchain.com/tls/ca.crt"
        export CORE_PEER_MSPCONFIGPATH="${CRYPTO_DIR}/peerOrganizations/engineer.bimchain.com/users/Admin@engineer.bimchain.com/msp"
    fi

    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_ADDRESS="localhost:${port}"
}

# ---------------------------------------------------------------------------
# Step 1: Package Chaincode
# ---------------------------------------------------------------------------
package_chaincode() {
    log_info "Step 1: Packaging chaincode '${CC_NAME}' v${CC_VERSION}"

    if [ -f "${CC_PACKAGE_FILE}" ]; then
        echo "Removing existing package..."
        rm -f "${CC_PACKAGE_FILE}"
    fi

    peer lifecycle chaincode package "${CC_PACKAGE_FILE}" \
        --path "${CC_SRC_PATH}" \
        --lang golang \
        --label "${CC_NAME}_${CC_VERSION}"

    echo "[OK] Chaincode packaged: ${CC_PACKAGE_FILE}"
}

# ---------------------------------------------------------------------------
# Step 2: Install Chaincode on All Peers
# ---------------------------------------------------------------------------
install_chaincode() {
    log_info "Step 2: Installing chaincode on all peers"

    # --- peer0.architect ---
    log_step "Installing on peer0.architect.bimchain.com"
    set_peer_env "architect" "peer0" 7051
    peer lifecycle chaincode install "${CC_PACKAGE_FILE}"

    # --- peer1.architect ---
    log_step "Installing on peer1.architect.bimchain.com"
    set_peer_env "architect" "peer1" 8051
    peer lifecycle chaincode install "${CC_PACKAGE_FILE}"

    # --- peer0.engineer ---
    log_step "Installing on peer0.engineer.bimchain.com"
    set_peer_env "engineer" "peer0" 9051
    peer lifecycle chaincode install "${CC_PACKAGE_FILE}"

    # --- peer1.engineer ---
    log_step "Installing on peer1.engineer.bimchain.com"
    set_peer_env "engineer" "peer1" 10051
    peer lifecycle chaincode install "${CC_PACKAGE_FILE}"

    echo "[OK] Chaincode installed on all peers."
}

# ---------------------------------------------------------------------------
# Step 3: Get Package ID
# ---------------------------------------------------------------------------
get_package_id() {
    log_step "Querying installed chaincode package ID"

    set_peer_env "architect" "peer0" 7051

    PACKAGE_ID=$(peer lifecycle chaincode queryinstalled \
        --output json | \
        python3 -c "
import sys, json
data = json.load(sys.stdin)
for cc in data.get('installed_chaincodes', []):
    if cc.get('label') == '${CC_NAME}_${CC_VERSION}':
        print(cc['package_id'])
        break
")

    if [ -z "${PACKAGE_ID}" ]; then
        echo "[ERROR] Could not find package ID for ${CC_NAME}_${CC_VERSION}"
        exit 1
    fi

    echo "Package ID: ${PACKAGE_ID}"
}

# ---------------------------------------------------------------------------
# Step 4: Approve Chaincode for ArchitectOrg
# ---------------------------------------------------------------------------
approve_architect() {
    log_info "Step 3: Approving chaincode for ArchitectOrg"

    set_peer_env "architect" "peer0" 7051

    peer lifecycle chaincode approveformyorg \
        -o "${ORDERER_ADDRESS}" \
        --channelID "${CHANNEL_NAME}" \
        --name "${CC_NAME}" \
        --version "${CC_VERSION}" \
        --package-id "${PACKAGE_ID}" \
        --sequence "${CC_SEQUENCE}" \
        --tls \
        --cafile "${ORDERER_CA}"

    echo "[OK] Chaincode approved for ArchitectOrg."
}

# ---------------------------------------------------------------------------
# Step 5: Approve Chaincode for EngineerOrg
# ---------------------------------------------------------------------------
approve_engineer() {
    log_info "Step 4: Approving chaincode for EngineerOrg"

    set_peer_env "engineer" "peer0" 9051

    peer lifecycle chaincode approveformyorg \
        -o "${ORDERER_ADDRESS}" \
        --channelID "${CHANNEL_NAME}" \
        --name "${CC_NAME}" \
        --version "${CC_VERSION}" \
        --package-id "${PACKAGE_ID}" \
        --sequence "${CC_SEQUENCE}" \
        --tls \
        --cafile "${ORDERER_CA}"

    echo "[OK] Chaincode approved for EngineerOrg."
}

# ---------------------------------------------------------------------------
# Step 6: Check Commit Readiness
# ---------------------------------------------------------------------------
check_commit_readiness() {
    log_step "Checking commit readiness"

    set_peer_env "architect" "peer0" 7051

    peer lifecycle chaincode checkcommitreadiness \
        --channelID "${CHANNEL_NAME}" \
        --name "${CC_NAME}" \
        --version "${CC_VERSION}" \
        --sequence "${CC_SEQUENCE}" \
        --tls \
        --cafile "${ORDERER_CA}" \
        --output json
}

# ---------------------------------------------------------------------------
# Step 7: Commit Chaincode Definition
# ---------------------------------------------------------------------------
commit_chaincode() {
    log_info "Step 5: Committing chaincode definition"

    set_peer_env "architect" "peer0" 7051

    peer lifecycle chaincode commit \
        -o "${ORDERER_ADDRESS}" \
        --channelID "${CHANNEL_NAME}" \
        --name "${CC_NAME}" \
        --version "${CC_VERSION}" \
        --sequence "${CC_SEQUENCE}" \
        --tls \
        --cafile "${ORDERER_CA}" \
        --peerAddresses "localhost:7051" \
        --tlsRootCertFiles "${CRYPTO_DIR}/peerOrganizations/architect.bimchain.com/peers/peer0.architect.bimchain.com/tls/ca.crt" \
        --peerAddresses "localhost:9051" \
        --tlsRootCertFiles "${CRYPTO_DIR}/peerOrganizations/engineer.bimchain.com/peers/peer0.engineer.bimchain.com/tls/ca.crt"

    echo "[OK] Chaincode definition committed."
}

# ---------------------------------------------------------------------------
# Step 8: Verify with Lifecycle Query
# ---------------------------------------------------------------------------
verify_chaincode() {
    log_info "Step 6: Verifying chaincode deployment"

    log_step "Querying committed chaincode on channel '${CHANNEL_NAME}'"
    set_peer_env "architect" "peer0" 7051

    peer lifecycle chaincode querycommitted \
        --channelID "${CHANNEL_NAME}" \
        --name "${CC_NAME}" \
        --tls \
        --cafile "${ORDERER_CA}" \
        --output json

    log_step "Verifying chaincode is queryable on EngineerOrg peer"
    set_peer_env "engineer" "peer0" 9051

    peer lifecycle chaincode querycommitted \
        --channelID "${CHANNEL_NAME}" \
        --name "${CC_NAME}" \
        --tls \
        --cafile "${ORDERER_CA}" \
        --output json

    echo ""
    echo "[OK] Chaincode '${CC_NAME}' v${CC_VERSION} (sequence ${CC_SEQUENCE}) verified on both organizations."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    log_info "BIM-Chain Chaincode Deployment"
    echo "Chaincode name:     ${CC_NAME}"
    echo "Chaincode version:  ${CC_VERSION}"
    echo "Chaincode sequence: ${CC_SEQUENCE}"
    echo "Source path:         ${CC_SRC_PATH}"
    echo "Channel:             ${CHANNEL_NAME}"
    echo ""

    package_chaincode
    install_chaincode
    get_package_id
    approve_architect
    approve_engineer
    check_commit_readiness
    commit_chaincode
    verify_chaincode

    log_info "Chaincode deployment complete!"
    echo ""
    echo "Chaincode '${CC_NAME}' v${CC_VERSION} is now active on channel '${CHANNEL_NAME}'."
    echo ""
    echo "Usage:"
    echo "  Deploy new version:  ./deploy-chaincode.sh ${CC_NAME} 2.0 2"
    echo "  Deploy different CC: ./deploy-chaincode.sh my-chaincode 1.0 1"
}

main "$@"
