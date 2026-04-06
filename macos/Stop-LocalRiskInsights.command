#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

printf "\n== Stopping LocalRiskInsights ==\n"
cd "$REPO_ROOT"
docker compose down

printf "\nLocalRiskInsights has stopped.\n\n"
read -r -p "Press Enter to close..." _

