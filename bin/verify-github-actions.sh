#!/usr/bin/env bash
set -euo pipefail

# --- Script Manifest ---------------------------------------------------------
# Purpose: Verify GitHub workflow and local action formatting, YAML syntax, and
# actionlint semantics.
# Main Flow:
# - Collect workflow/action YAML files.
# - Check Prettier formatting/YAML parsing.
# - Run actionlint when available.
# Helpers:
# - collect_yaml_files appends sorted YAML paths from one directory.

# --- Paths -------------------------------------------------------------------
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"/.. && pwd)"

# --- State -------------------------------------------------------------------
github_yaml_files=()

# --- Helpers -----------------------------------------------------------------
collect_yaml_files() {
  local directory="$1"

  if [[ ! -d "$directory" ]]; then
    return
  fi

  while IFS= read -r -d "" file_path; do
    github_yaml_files+=("$file_path")
  done < <(find "$directory" -type f \( -name "*.yml" -o -name "*.yaml" \) -print0 | sort -z)
}

# --- Main --------------------------------------------------------------------
main() {
  cd "$ROOT_DIR"

  collect_yaml_files ".github/workflows"
  collect_yaml_files ".github/actions"

  if [[ "${#github_yaml_files[@]}" -eq 0 ]]; then
    echo "[github-actions] No GitHub workflow or local action YAML files found." >&2
    exit 1
  fi

  echo "[github-actions] Checking GitHub workflow and local action formatting/YAML parsing."
  pnpm exec prettier --check "${github_yaml_files[@]}"

  echo
  echo "[github-actions] Checking the private CLI release workflow contract."
  pnpm -F @codon-ui/cli release:workflow-check

  if ! command -v actionlint >/dev/null 2>&1; then
    cat >&2 <<ERROR
[github-actions] actionlint is required for semantic GitHub Actions workflow checks.
[github-actions] Install it locally with: brew install actionlint
[github-actions] CI installs pinned actionlint 1.7.12 before running this verifier.
ERROR
    exit 1
  fi

  echo
  echo "[github-actions] Running actionlint semantic workflow checks."
  actionlint

  echo
  echo "[github-actions] GitHub workflow and local action checks passed."
}

main "$@"
