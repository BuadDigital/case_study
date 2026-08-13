#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu server for the Real Estate Eval stack.
#
#   ./setup-hetzner-server.sh app.example.com you@example.com
#
# Installs Docker, locks the firewall down to SSH/HTTP/HTTPS, issues a Let's Encrypt
# certificate, generates /app/.env, and prints the values to paste into GitHub secrets.
# Safe to re-run: nothing already provisioned is recreated or overwritten.

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
APP_DIR=/app
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "usage: $0 <domain> <email>" >&2
  echo "example: $0 app.example.com ops@example.com" >&2
  exit 2
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "error: run as root (sudo $0 ...)" >&2
  exit 1
fi

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33mwarning: %s\033[0m\n' "$1" >&2; }

# ── Resource check ─────────────────────────────────────────────────────────────
step "Checking resources"
ram_mb=$(awk '/MemTotal/ {printf "%d", $2 / 1024}' /proc/meminfo)
cpus=$(nproc)
echo "RAM: ${ram_mb} MB, vCPU: ${cpus}"
if [ "$ram_mb" -lt 7500 ]; then
  warn "The full stack (9 .NET services + Postgres + RabbitMQ + Redis + Elasticsearch +
         Prometheus + Grafana + Jaeger) needs about 8 GB. With ${ram_mb} MB containers
         will be OOM-killed. Resize the server, or drop the observability services from
         docker-compose.prod.yml before deploying."
fi

# ── Docker ─────────────────────────────────────────────────────────────────────
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  step "Docker already installed ($(docker --version))"
else
  step "Installing Docker"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg

  install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
      gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi

  # Docker publishes per-release repositories. A very new Ubuntu (or a non-LTS) may not
  # have one yet, so fall back to the newest LTS repository, which is ABI-compatible.
  codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
  if ! curl -fsI "https://download.docker.com/linux/ubuntu/dists/$codename/Release" >/dev/null 2>&1; then
    warn "no Docker repository for '$codename'; falling back to 'noble' (24.04 LTS)"
    codename=noble
  fi

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $codename stable" > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

# ── Firewall ───────────────────────────────────────────────────────────────────
step "Configuring firewall"
apt-get install -y ufw >/dev/null
# Allow SSH before enabling, otherwise this command ends the session it runs in.
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
ufw status verbose

# ── Deploy directory ───────────────────────────────────────────────────────────
step "Creating $APP_DIR"
mkdir -p "$APP_DIR/infra"

# ── TLS certificate ────────────────────────────────────────────────────────────
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
if [ -f "$CERT_DIR/fullchain.pem" ]; then
  step "Certificate for $DOMAIN already present"
  openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -subject -enddate
else
  step "Issuing certificate for $DOMAIN"

  resolved=$(getent hosts "$DOMAIN" | awk '{print $1; exit}' || true)
  public_ip=$(curl -fsS --max-time 10 https://api.ipify.org || echo "")
  if [ -n "$resolved" ] && [ -n "$public_ip" ] && [ "$resolved" != "$public_ip" ]; then
    warn "$DOMAIN resolves to $resolved but this server is $public_ip — Let's Encrypt will fail"
  elif [ -z "$resolved" ]; then
    warn "$DOMAIN does not resolve yet; add the A record and re-run"
  fi

  apt-get install -y certbot

  # certbot --standalone binds port 80, so the ingress must be down for the challenge.
  if [ -f "$COMPOSE_FILE" ]; then
    docker compose -f "$COMPOSE_FILE" stop nginx 2>/dev/null || true
  fi

  certbot certonly --standalone -d "$DOMAIN" \
    --agree-tos -m "$EMAIL" --no-eff-email --non-interactive

  if [ -f "$COMPOSE_FILE" ]; then
    docker compose -f "$COMPOSE_FILE" start nginx 2>/dev/null || true
  fi
fi

# ── Renewal hooks ──────────────────────────────────────────────────────────────
step "Installing renewal hooks"
mkdir -p /etc/letsencrypt/renewal-hooks/pre /etc/letsencrypt/renewal-hooks/post

cat > /etc/letsencrypt/renewal-hooks/pre/stop-ree-nginx.sh <<EOF
#!/bin/sh
# Free port 80 for the standalone challenge.
[ -f "$COMPOSE_FILE" ] && docker compose -f "$COMPOSE_FILE" stop nginx || true
EOF

cat > /etc/letsencrypt/renewal-hooks/post/start-ree-nginx.sh <<EOF
#!/bin/sh
# Restart so nginx reads the renewed certificate files.
[ -f "$COMPOSE_FILE" ] && docker compose -f "$COMPOSE_FILE" start nginx || true
EOF

chmod +x /etc/letsencrypt/renewal-hooks/pre/stop-ree-nginx.sh \
         /etc/letsencrypt/renewal-hooks/post/start-ree-nginx.sh

# ── Runtime secrets ────────────────────────────────────────────────────────────
if [ -f "$APP_DIR/.env" ]; then
  step "$APP_DIR/.env already exists — leaving it untouched"
else
  step "Generating $APP_DIR/.env"
  umask 077
  cat > "$APP_DIR/.env" <<EOF
POSTGRES_PASSWORD=$(openssl rand -base64 36 | tr -d '\n/+=')
RABBITMQ_USER=ree-service
RABBITMQ_PASSWORD=$(openssl rand -base64 36 | tr -d '\n/+=')
JWT_SIGNING_KEY=$(openssl rand -base64 72 | tr -d '\n')
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '\n/+=')
TLS_CERTIFICATE_PATH=$CERT_DIR/fullchain.pem
TLS_PRIVATE_KEY_PATH=$CERT_DIR/privkey.pem
PUBLIC_APP_URL=https://$DOMAIN
EOF
  chmod 600 "$APP_DIR/.env"
  echo "written (0600). Back it up somewhere safe — the database password is in it."
fi

# ── Summary ────────────────────────────────────────────────────────────────────
step "Server is ready"
cat <<EOF

Add these repository secrets at
https://github.com/BuadDigital/case_study/settings/secrets/actions

  HETZNER_SSH_HOST      $(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo '<this server IP>')
  HETZNER_SSH_USER      $(whoami)
  HETZNER_SSH_PORT      22
  HETZNER_SSH_KEY       <private key of the CI deploy keypair>
  TLS_CERTIFICATE_PATH  $CERT_DIR/fullchain.pem
  TLS_PRIVATE_KEY_PATH  $CERT_DIR/privkey.pem
  PUBLIC_APP_URL        https://$DOMAIN
  GHCR_PAT              <token with read:packages>
  GHCR_USER             <GitHub username owning that token>

Create the deploy keypair on your own machine, not here:

  ssh-keygen -t ed25519 -f ~/.ssh/hetzner_deploy -C github-actions-deploy -N ""
  ssh-copy-id -i ~/.ssh/hetzner_deploy.pub $(whoami)@$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo '<server-ip>')

Then run the pipeline: Actions -> CI/CD Pipeline -> Run workflow.
EOF
