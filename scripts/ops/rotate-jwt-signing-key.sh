#!/usr/bin/env bash
# Print the JWT signing-key rotation edits for /app/.env and GitHub.
# Does not modify the server — review and apply yourself.
#
# Usage:
#   bash scripts/ops/rotate-jwt-signing-key.sh
#   bash scripts/ops/rotate-jwt-signing-key.sh --emergency   # no previous-key window
#
# See docs/ops/jwt-signing-key-rotation.md

set -euo pipefail

EMERGENCY=0
if [[ "${1:-}" == "--emergency" ]]; then
  EMERGENCY=1
fi

NEW_KEY="$(openssl rand -base64 64 | tr -d '\n')"

if [[ ${#NEW_KEY} -lt 64 ]]; then
  echo "Generated key too short; install openssl and retry." >&2
  exit 1
fi

echo "=== New JWT_SIGNING_KEY (store securely; do not commit) ==="
echo "$NEW_KEY"
echo

if [[ "$EMERGENCY" -eq 1 ]]; then
  cat <<'EOF'
=== Emergency cutover ===
1. Set JWT_SIGNING_KEY to the value above (GitHub secret + /app/.env).
2. Clear JWT_PREVIOUS_SIGNING_KEY (empty / unset).
3. Redeploy all API containers immediately.
4. Users refresh or re-login; consider revoking RefreshTokens if theft is likely.
EOF
  exit 0
fi

cat <<EOF
=== Dual-key rotation (preferred) ===
1. Copy the CURRENT JWT_SIGNING_KEY into JWT_PREVIOUS_SIGNING_KEY
   (GitHub optional secret JWT_PREVIOUS_SIGNING_KEY, and /app/.env).
2. Set JWT_SIGNING_KEY to:

${NEW_KEY}

3. Redeploy (compose up -d / GitHub deploy workflow).
4. Wait ≥ 20 minutes (default access JWT is 15 minutes).
5. Clear JWT_PREVIOUS_SIGNING_KEY and redeploy once more.
6. Smoke: login, refresh, call /api/auth/me.

Full notes: docs/ops/jwt-signing-key-rotation.md
EOF
