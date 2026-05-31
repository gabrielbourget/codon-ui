#!/usr/bin/env bash
set -euo pipefail

# --- Script Manifest ---------------------------------------------------------
# Purpose: Verify repo-wide formatting, linting, stylelint, contract checks,
# and typechecking, then smoke shared tooling config resolution.
# Main Flow:
# - Run the ordered root check.
# - Smoke shared Stylelint, TypeScript, and ESLint config resolution from
#   current consumer packages.
# Helpers:
# - This script is intentionally direct; each command is part of the main flow.

# --- Paths -------------------------------------------------------------------
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"/.. && pwd)"

# --- Main --------------------------------------------------------------------
main() {
  cd "$ROOT_DIR"

  pnpm check

  # -> Stylelint shared config resolution.
  pnpm -C apps/web exec stylelint --print-config src/app/globals.css >/dev/null
  pnpm -C packages/react exec stylelint --print-config theme.css >/dev/null

  # -> TypeScript config extends resolution.
  pnpm -C apps/web exec tsc --showConfig -p tsconfig.json >/dev/null
  pnpm -C packages/CLI exec tsc --showConfig -p tsconfig.json >/dev/null
  pnpm -C packages/react exec tsc --showConfig -p tsconfig.json >/dev/null

  # -> ESLint config resolution.
  pnpm -C apps/web exec eslint --print-config src/app/page.tsx >/dev/null
  pnpm -C packages/CLI exec eslint --print-config src/index.ts >/dev/null
  pnpm -C packages/react exec eslint --print-config src/index.ts >/dev/null
}

main "$@"
