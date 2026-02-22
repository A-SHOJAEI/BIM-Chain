#!/bin/bash
set -e
echo "=============================="
echo "BIM-Chain Full Test Suite"
echo "=============================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "--- Go Chaincode ---"
cd "$ROOT_DIR/packages/chaincode-go"
go test ./... -coverprofile=coverage.out -count=1
echo "Coverage:"
go tool cover -func=coverage.out | tail -1

echo ""
echo "--- Node.js Middleware ---"
cd "$ROOT_DIR/packages/middleware"
npm test -- --coverage --silent 2>&1 | tail -5

echo ""
echo "--- Next.js Frontend ---"
cd "$ROOT_DIR/packages/frontend"
npm run build --silent 2>&1 && echo "Build: PASS" || echo "Build: FAIL"

echo ""
echo "--- C# Revit Plugin ---"
cd "$ROOT_DIR/packages/revit-plugin"
dotnet test --verbosity quiet 2>&1 | tail -3

echo ""
echo "--- Contract Tests ---"
cd "$ROOT_DIR/tests/contract"
npm test -- --silent 2>&1 | tail -3

echo ""
echo "=============================="
echo "All tests complete."
echo "=============================="
