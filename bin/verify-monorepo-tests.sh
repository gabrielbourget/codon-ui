#!/usr/bin/env bash
set -euo pipefail

# --- Script Manifest ---------------------------------------------------------
# Purpose: Run package test scripts as they are introduced.
# Main Flow:
# - Run each workspace package's test script when present.
# Helpers:
# - Packages without tests should omit a test script or keep a passing no-op
#   until a real test suite is added.

# --- Paths -------------------------------------------------------------------
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"/.. && pwd)"

# --- Main --------------------------------------------------------------------
main() {
  cd "$ROOT_DIR"

  pnpm -r --if-present test
}

main "$@"
