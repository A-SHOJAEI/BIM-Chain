#!/bin/bash
#
# BIM-Chain Network Teardown Script
# Stops containers, removes crypto material, channel artifacts, and prunes volumes
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"
CRYPTO_DIR="${NETWORK_DIR}/crypto-config"
CHANNEL_ARTIFACTS_DIR="${NETWORK_DIR}/channel-artifacts"
DOCKER_DIR="${NETWORK_DIR}/docker"

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

# ---------------------------------------------------------------------------
# Step 1: Stop and Remove All Containers
# ---------------------------------------------------------------------------
stop_containers() {
    log_info "Step 1: Stopping and removing all containers"

    log_step "Stopping Fabric network containers"
    if [ -f "${DOCKER_DIR}/docker-compose-fabric.yaml" ]; then
        docker-compose -f "${DOCKER_DIR}/docker-compose-fabric.yaml" down --remove-orphans 2>/dev/null || true
    fi

    log_step "Stopping service containers"
    if [ -f "${DOCKER_DIR}/docker-compose-services.yaml" ]; then
        docker-compose -f "${DOCKER_DIR}/docker-compose-services.yaml" down --remove-orphans 2>/dev/null || true
    fi

    log_step "Removing any remaining BIM-Chain containers"
    CONTAINERS=$(docker ps -aq --filter "network=bimchain_network" 2>/dev/null || true)
    if [ -n "$CONTAINERS" ]; then
        docker rm -f $CONTAINERS 2>/dev/null || true
    fi

    # Remove chaincode containers (dev-peer*)
    CC_CONTAINERS=$(docker ps -aq --filter "name=dev-peer" 2>/dev/null || true)
    if [ -n "$CC_CONTAINERS" ]; then
        echo "Removing chaincode containers..."
        docker rm -f $CC_CONTAINERS 2>/dev/null || true
    fi

    # Remove chaincode images
    CC_IMAGES=$(docker images -q "dev-peer*" 2>/dev/null || true)
    if [ -n "$CC_IMAGES" ]; then
        echo "Removing chaincode images..."
        docker rmi -f $CC_IMAGES 2>/dev/null || true
    fi

    echo "[OK] All containers stopped and removed."
}

# ---------------------------------------------------------------------------
# Step 2: Remove Generated Crypto Material
# ---------------------------------------------------------------------------
remove_crypto_material() {
    log_info "Step 2: Removing generated crypto material"

    if [ -d "${CRYPTO_DIR}" ]; then
        rm -rf "${CRYPTO_DIR}"
        echo "[OK] Crypto material removed: ${CRYPTO_DIR}"
    else
        echo "[SKIP] Crypto material directory not found."
    fi
}

# ---------------------------------------------------------------------------
# Step 3: Remove Channel Artifacts
# ---------------------------------------------------------------------------
remove_channel_artifacts() {
    log_info "Step 3: Removing channel artifacts"

    if [ -d "${CHANNEL_ARTIFACTS_DIR}" ]; then
        rm -rf "${CHANNEL_ARTIFACTS_DIR}"
        echo "[OK] Channel artifacts removed: ${CHANNEL_ARTIFACTS_DIR}"
    else
        echo "[SKIP] Channel artifacts directory not found."
    fi
}

# ---------------------------------------------------------------------------
# Step 4: Prune Docker Volumes
# ---------------------------------------------------------------------------
prune_docker_volumes() {
    log_info "Step 4: Pruning Docker volumes"

    log_step "Removing named volumes"
    VOLUMES=(
        "orderer1.bimchain.com"
        "orderer2.bimchain.com"
        "orderer3.bimchain.com"
        "orderer4.bimchain.com"
        "orderer5.bimchain.com"
        "peer0.architect.bimchain.com"
        "peer1.architect.bimchain.com"
        "peer0.engineer.bimchain.com"
        "peer1.engineer.bimchain.com"
        "couchdb.peer0.architect"
        "couchdb.peer1.architect"
        "couchdb.peer0.engineer"
        "couchdb.peer1.engineer"
    )

    for vol in "${VOLUMES[@]}"; do
        docker volume rm "${vol}" 2>/dev/null || true
    done

    log_step "Pruning unused Docker volumes"
    docker volume prune -f 2>/dev/null || true

    log_step "Removing Docker network"
    docker network rm bimchain_network 2>/dev/null || true

    echo "[OK] Docker volumes pruned."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    log_info "BIM-Chain Network Teardown"
    echo "Network directory: ${NETWORK_DIR}"
    echo ""
    echo "WARNING: This will remove all network data including:"
    echo "  - All running containers"
    echo "  - Generated crypto material"
    echo "  - Channel artifacts"
    echo "  - Docker volumes (ledger data)"
    echo ""

    # Prompt for confirmation (skip if -f flag is passed)
    if [[ "${1:-}" != "-f" ]]; then
        read -p "Are you sure you want to proceed? (y/N): " confirm
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            echo "Teardown cancelled."
            exit 0
        fi
    fi

    stop_containers
    remove_crypto_material
    remove_channel_artifacts
    prune_docker_volumes

    log_info "BIM-Chain network teardown complete!"
    echo ""
    echo "All network resources have been removed."
    echo "To restart the network, run: ./setup.sh"
}

main "$@"
