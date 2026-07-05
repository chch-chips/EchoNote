#!/usr/bin/env bash
set -euo pipefail

RELEASE_ID="${1:?release id is required}"
APP_ROOT="${APP_ROOT:-/opt/echonote}"
RELEASES_DIR="$APP_ROOT/releases"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
CURRENT_LINK="$APP_ROOT/current"
ENV_FILE="${ENV_FILE:-/etc/echonote/echonote.env}"
LOG_FILE="${LOG_FILE:-$APP_ROOT/deploy.log}"
LOCK_FILE="${LOCK_FILE:-/tmp/echonote-deploy.lock}"
BUILD_TIMEOUT="${BUILD_TIMEOUT:-420}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

case "$RELEASE_ID" in
  ""|*/*|*..*)
    echo "[deploy] invalid release id: $RELEASE_ID"
    exit 1
    ;;
esac

mkdir -p "$RELEASES_DIR" "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if command -v flock >/dev/null 2>&1; then
  if ! flock -n 9; then
    echo "[deploy] another deployment is already running; exiting"
    exit 75
  fi
fi

touch "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

run_timed_low_priority() {
  if command -v ionice >/dev/null 2>&1; then
    timeout "$BUILD_TIMEOUT" ionice -c2 -n7 nice -n 10 "$@"
  else
    timeout "$BUILD_TIMEOUT" nice -n 10 "$@"
  fi
}

install_systemd_units() {
  cat >/etc/systemd/system/echonote-web.service <<'UNIT'
[Unit]
Description=EchoNote Web
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/echonote/current
EnvironmentFile=/etc/echonote/echonote.env
ExecStart=/usr/bin/node /opt/echonote/current/.next/standalone/server.js
Restart=always
RestartSec=5
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
UNIT

  cat >/etc/systemd/system/echonote-worker.service <<'UNIT'
[Unit]
Description=EchoNote AI Worker
After=network.target docker.service echonote-web.service
Wants=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/echonote/current
EnvironmentFile=/etc/echonote/echonote.env
ExecStart=/usr/bin/npm run worker:ai
Restart=always
RestartSec=10
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
}

if [ ! -d "$RELEASE_DIR" ]; then
  echo "[deploy] release directory does not exist: $RELEASE_DIR"
  exit 1
fi

echo "[deploy] $(date -Is) installing EchoNote release $RELEASE_ID"
echo "[deploy] load: $(uptime)"
echo "[deploy] memory: $(free -h | sed -n '2p')"

cd "$RELEASE_DIR"
ln -sfn "$ENV_FILE" .env

if [ ! -f .next/standalone/server.js ]; then
  echo "[deploy] missing standalone server output"
  exit 1
fi

echo "[deploy] installing runtime dependencies"
run_timed_low_priority npm ci --include=dev

echo "[deploy] generating Prisma client"
run_timed_low_priority npm run db:generate

echo "[deploy] deploying database migrations"
run_timed_low_priority npm run db:deploy

echo "[deploy] preparing standalone static assets"
mkdir -p .next/standalone/.next
if [ -d public ]; then
  rm -rf .next/standalone/public
  cp -a public .next/standalone/
fi
rm -rf .next/standalone/.next/static
cp -a .next/static .next/standalone/.next/

echo "[deploy] installing systemd units"
install_systemd_units

echo "[deploy] activating release $RELEASE_ID"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK.next"
mv -Tf "$CURRENT_LINK.next" "$CURRENT_LINK"

echo "[deploy] restarting EchoNote services"
systemctl restart echonote-web echonote-worker

echo "[deploy] checking service states"
systemctl is-active --quiet echonote-web
systemctl is-active --quiet echonote-worker
curl -fsS -I --connect-timeout 5 http://127.0.0.1:8081/login >/dev/null

echo "[deploy] pruning old releases"
ls -1dt "$RELEASES_DIR"/* 2>/dev/null | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old_release; do
  if [ "$old_release" != "$RELEASE_DIR" ]; then
    rm -rf "$old_release"
  fi
done

echo "[deploy] $(date -Is) release $RELEASE_ID deployed"
