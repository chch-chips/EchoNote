#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/echonote-container}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_ROOT/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-/etc/echonote/echonote.env}"
LOG_FILE="${LOG_FILE:-$APP_ROOT/deploy.log}"
IMAGE="${1:-${ECHONOTE_IMAGE:-}}"

if [ -z "$IMAGE" ]; then
  echo "[deploy] image argument or ECHONOTE_IMAGE is required"
  exit 1
fi

mkdir -p "$APP_ROOT"
touch "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[deploy] $(date -Is) deploying EchoNote container image $IMAGE"
echo "[deploy] load: $(uptime)"
echo "[deploy] memory: $(free -h | sed -n '2p')"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "[deploy] missing compose file: $COMPOSE_FILE"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[deploy] missing environment file: $ENV_FILE"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[deploy] docker is not installed"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[deploy] docker compose plugin is not available"
  exit 1
fi

stop_legacy_systemd_service() {
  local service="$1"
  if systemctl list-unit-files "$service.service" >/dev/null 2>&1; then
    if systemctl is-active --quiet "$service"; then
      echo "[deploy] stopping legacy systemd service $service"
      systemctl stop "$service"
    fi
    if systemctl is-enabled --quiet "$service" 2>/dev/null; then
      echo "[deploy] disabling legacy systemd service $service"
      systemctl disable "$service"
    fi
  fi
}

export ECHONOTE_IMAGE="$IMAGE"
export ENV_FILE

cd "$APP_ROOT"

stop_legacy_systemd_service echonote-web
stop_legacy_systemd_service echonote-worker

echo "[deploy] pulling image"
docker compose -f "$COMPOSE_FILE" pull

echo "[deploy] applying database migrations"
docker compose -f "$COMPOSE_FILE" run --rm migrate

echo "[deploy] starting containers"
docker compose -f "$COMPOSE_FILE" up -d web worker

echo "[deploy] checking container status"
docker compose -f "$COMPOSE_FILE" ps

echo "[deploy] checking HTTP health"
curl -fsS -I --connect-timeout 10 http://127.0.0.1:8081/login >/dev/null

echo "[deploy] $(date -Is) deployed EchoNote container image $IMAGE"
