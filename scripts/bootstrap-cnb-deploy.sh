#!/usr/bin/env bash
set -Eeuo pipefail

umask 027

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run this bootstrap as root." >&2
  exit 1
fi

IMAGE_REPOSITORY="${1:-}"
PUBLIC_KEY_FILE="${2:-}"
DEPLOY_USER="echonote-deploy"
APP_ROOT="/opt/echonote-runtime"

if [[ ! "$IMAGE_REPOSITORY" =~ ^ccr\.ccs\.tencentyun\.com/[a-z0-9._/-]+$ ]]; then
  echo "Expected a TCR repository such as ccr.ccs.tencentyun.com/namespace/echonote." >&2
  exit 1
fi

if [ ! -f "$PUBLIC_KEY_FILE" ]; then
  echo "Public key file does not exist: $PUBLIC_KEY_FILE" >&2
  exit 1
fi

PUBLIC_KEY="$(tr -d '\r\n' <"$PUBLIC_KEY_FILE")"
if [[ ! "$PUBLIC_KEY" =~ ^(ssh-ed25519|ssh-rsa)[[:space:]] ]]; then
  echo "The public key must be an OpenSSH ed25519 or RSA public key." >&2
  exit 1
fi

command -v visudo >/dev/null 2>&1 || {
  echo "visudo is required." >&2
  exit 1
}

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
  passwd --lock "$DEPLOY_USER"
fi

install -d -o root -g root -m 0755 "$APP_ROOT"
install -d -o root -g root -m 0755 /etc/echonote
install -d -o root -g root -m 0755 /var/lib/echonote-deploy

install -o root -g root -m 0755 scripts/deploy-cnb.sh /usr/local/sbin/echonote-deploy
install -o root -g root -m 0644 docker-compose.prod.yml "$APP_ROOT/docker-compose.prod.yml"

cat > /etc/echonote/deploy.conf <<EOF
ALLOWED_IMAGE_REPOSITORY=$IMAGE_REPOSITORY
EOF
chown root:root /etc/echonote/deploy.conf
chmod 0644 /etc/echonote/deploy.conf

DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0700 "$DEPLOY_HOME/.ssh"
printf 'restrict %s\n' "$PUBLIC_KEY" >"$DEPLOY_HOME/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh/authorized_keys"
chmod 0600 "$DEPLOY_HOME/.ssh/authorized_keys"

cat > /etc/sudoers.d/echonote-deploy <<'EOF'
echonote-deploy ALL=(root) NOPASSWD: /usr/local/sbin/echonote-deploy *
EOF
chown root:root /etc/sudoers.d/echonote-deploy
chmod 0440 /etc/sudoers.d/echonote-deploy
visudo -cf /etc/sudoers.d/echonote-deploy

echo "CNB deploy bootstrap installed without changing the running EchoNote services."
echo "Next: log in to TCR as root, then run the deployment script only after a build-only POC succeeds."
