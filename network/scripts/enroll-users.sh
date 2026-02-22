#!/bin/bash
#
# BIM-Chain User Enrollment Script
# Enrolls admin and application users via Fabric CA
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"
CRYPTO_DIR="${NETWORK_DIR}/crypto-config"

ARCHITECT_CA_PORT="${ARCHITECT_CA_PORT:-7054}"
ENGINEER_CA_PORT="${ENGINEER_CA_PORT:-8054}"

FABRIC_CA_CLIENT_HOME="${CRYPTO_DIR}/fabric-ca-client"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

enroll_admin() {
  local org_name="$1"
  local ca_port="$2"
  local msp_dir="$3"

  log "Enrolling admin for ${org_name}..."

  export FABRIC_CA_CLIENT_HOME="${msp_dir}/admin"
  mkdir -p "${FABRIC_CA_CLIENT_HOME}"

  fabric-ca-client enroll \
    -u "https://admin:adminpw@localhost:${ca_port}" \
    --caname "ca-${org_name}" \
    --tls.certfiles "${CRYPTO_DIR}/fabric-ca/${org_name}/tls-cert.pem" \
    -M "${FABRIC_CA_CLIENT_HOME}/msp"

  log "Admin enrolled for ${org_name}"
}

register_user() {
  local org_name="$1"
  local ca_port="$2"
  local msp_dir="$3"
  local username="$4"
  local user_type="${5:-client}"

  log "Registering user ${username} for ${org_name}..."

  export FABRIC_CA_CLIENT_HOME="${msp_dir}/admin"

  fabric-ca-client register \
    --caname "ca-${org_name}" \
    --id.name "${username}" \
    --id.secret "${username}pw" \
    --id.type "${user_type}" \
    --tls.certfiles "${CRYPTO_DIR}/fabric-ca/${org_name}/tls-cert.pem"

  log "Enrolling user ${username}..."

  export FABRIC_CA_CLIENT_HOME="${msp_dir}/users/${username}"
  mkdir -p "${FABRIC_CA_CLIENT_HOME}"

  fabric-ca-client enroll \
    -u "https://${username}:${username}pw@localhost:${ca_port}" \
    --caname "ca-${org_name}" \
    --tls.certfiles "${CRYPTO_DIR}/fabric-ca/${org_name}/tls-cert.pem" \
    -M "${FABRIC_CA_CLIENT_HOME}/msp"

  log "User ${username} enrolled for ${org_name}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  log "=== BIM-Chain User Enrollment ==="

  # Enroll ArchitectOrg
  ARCHITECT_MSP="${CRYPTO_DIR}/peerOrganizations/architect.bimchain.com"
  enroll_admin "architect" "${ARCHITECT_CA_PORT}" "${ARCHITECT_MSP}"
  register_user "architect" "${ARCHITECT_CA_PORT}" "${ARCHITECT_MSP}" "architect-user1"
  register_user "architect" "${ARCHITECT_CA_PORT}" "${ARCHITECT_MSP}" "architect-user2"

  # Enroll EngineerOrg
  ENGINEER_MSP="${CRYPTO_DIR}/peerOrganizations/engineer.bimchain.com"
  enroll_admin "engineer" "${ENGINEER_CA_PORT}" "${ENGINEER_MSP}"
  register_user "engineer" "${ENGINEER_CA_PORT}" "${ENGINEER_MSP}" "engineer-user1"
  register_user "engineer" "${ENGINEER_CA_PORT}" "${ENGINEER_MSP}" "engineer-user2"

  log "=== User enrollment complete ==="
}

main "$@"
