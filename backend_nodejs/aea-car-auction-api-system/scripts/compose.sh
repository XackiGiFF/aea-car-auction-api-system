#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <dev|prod> <docker-compose-args...>"
  echo "Example: $0 dev up -d --build"
  echo "Example: $0 prod pull"
  exit 1
fi

MODE="$1"
shift

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_FILE="$ROOT_DIR/infra/docker/compose.base.yml"
ENV_FILE="$ROOT_DIR/infra/docker/.env"

case "$MODE" in
  dev)
    STACK_FILE="$ROOT_DIR/infra/docker/compose.aea.dev.yml"
    ;;
  prod)
    STACK_FILE="$ROOT_DIR/infra/docker/compose.aea.prod.yml"
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Allowed values: dev, prod"
    exit 1
    ;;
esac

exec docker compose \
  -f "$BASE_FILE" \
  -f "$STACK_FILE" \
  --env-file "$ENV_FILE" \
  "$@"
