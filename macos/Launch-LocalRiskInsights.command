#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
ENV_EXAMPLE="$REPO_ROOT/.env.example"
APP_URL="http://127.0.0.1:8000"
HEALTH_URL="$APP_URL/api/health"

section() {
  printf "\n== %s ==\n" "$1"
}

pause_and_exit() {
  local message="$1"
  printf "\n%s\n\n" "$message"
  read -r -p "Press Enter to close..." _
  exit 1
}

ensure_command() {
  local command_name="$1"
  local install_hint="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    pause_and_exit "$install_hint"
  fi
}

ensure_docker_running() {
  section "Checking Docker Desktop"

  if docker info >/dev/null 2>&1; then
    echo "Docker Desktop is ready."
    return
  fi

  if [ -d "/Applications/Docker.app" ]; then
    echo "Opening Docker Desktop..."
    open -a Docker || true
  fi

  for _ in $(seq 1 24); do
    if docker info >/dev/null 2>&1; then
      echo "Docker Desktop is ready."
      return
    fi
    sleep 5
  done

  pause_and_exit "Docker Desktop did not become ready in time. Start Docker Desktop fully, then run this launcher again."
}

ensure_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "Created .env from .env.example"
  fi

  if grep -Eq '^OPENROUTER_API_KEY=.+' "$ENV_FILE"; then
    return
  fi

  section "OpenRouter API key"
  read -r -s -p "Paste your OPENROUTER_API_KEY: " api_key
  printf "\n"

  if [ -z "${api_key}" ]; then
    pause_and_exit "An OpenRouter API key is required before launch."
  fi

  local temp_file
  temp_file="$(mktemp)"
  local replaced=0

  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" == OPENROUTER_API_KEY=* ]]; then
      printf 'OPENROUTER_API_KEY=%s\n' "$api_key" >>"$temp_file"
      replaced=1
    else
      printf '%s\n' "$line" >>"$temp_file"
    fi
  done <"$ENV_FILE"

  if [ "$replaced" -eq 0 ]; then
    printf 'OPENROUTER_API_KEY=%s\n' "$api_key" >>"$temp_file"
  fi

  mv "$temp_file" "$ENV_FILE"
}

start_app() {
  section "Starting LocalRiskInsights"
  cd "$REPO_ROOT"

  docker compose up --build -d

  for _ in $(seq 1 60); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      echo "LocalRiskInsights is ready at $APP_URL"
      open "$APP_URL"
      printf "\nYou can close this window. The app will keep running until you use Stop-LocalRiskInsights.command.\n\n"
      read -r -p "Press Enter to close..." _
      exit 0
    fi
    sleep 2
  done

  pause_and_exit "The app did not become healthy in time. Open Terminal and run 'docker compose logs' in the repo if you want to inspect the startup logs."
}

ensure_command "docker" "Docker Desktop is required. Install it first, then run this launcher again."
ensure_command "curl" "curl is required to verify the app startup."
ensure_docker_running
ensure_env_file
start_app

