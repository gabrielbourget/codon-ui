#!/usr/bin/env bash
set -euo pipefail

# --- Script Manifest ---------------------------------------------------------
# Purpose: Verify the currently supported local build surfaces.
# Main Flow:
# - Build the React source receiver package.
# - Build the CLI package.
# - Build the Next web app directly without reopening registry artifact policy.
# Helpers:
# - This script is intentionally direct; each command is part of the main flow.

# --- Paths -------------------------------------------------------------------
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"/.. && pwd)"

# --- Main --------------------------------------------------------------------
main() {
  cd "$ROOT_DIR"

  pnpm build:react
  pnpm build:cli
  pnpm build:web
}

main "$@"
