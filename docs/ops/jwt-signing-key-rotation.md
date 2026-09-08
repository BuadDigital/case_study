# JWT signing-key rotation

Access JWTs are HMAC-SHA256 with `Jwt:SigningKey` / `JWT_SIGNING_KEY` (default lifetime **15 minutes**). Refresh tokens are **opaque DB rows** (`identity.RefreshTokens`) with their own rotation in `AuthSessionService` — they are **not** signed with the JWT key, so a signing-key change does not invalidate refresh sessions.

## Goals

- Replace a leaked or aged signing key without forcing every user to re-enter a password.
- Keep in-flight access tokens valid for one access-token lifetime after cutover.

## Mechanism

| Setting | Env | Role |
|--------|-----|------|
| `Jwt:SigningKey` | `JWT_SIGNING_KEY` | **Sign** new access tokens; also validate |
| `Jwt:PreviousSigningKey` | `JWT_PREVIOUS_SIGNING_KEY` | **Validate only** (optional dual-key window) |

Implemented in `AddRealEstateEvalJwt` (`IssuerSigningKeys` = current + previous).

## Production procedure (dual-key)

1. Generate a new key (≥64 chars, no `CHANGE_ME` / `DEV_ONLY`):
   ```bash
   openssl rand -base64 64
   ```
2. On the host `/app/.env` **and** GitHub Actions secret `JWT_SIGNING_KEY`:
   - `JWT_PREVIOUS_SIGNING_KEY` = current (old) value of `JWT_SIGNING_KEY`
   - `JWT_SIGNING_KEY` = the new value
3. Redeploy / recreate API containers so every service reloads env (`docker compose … up -d` or the deploy workflow).
4. Wait **at least** `Jwt:AccessTokenMinutes` (default 15) plus a small buffer (~20 minutes).
5. Clear `JWT_PREVIOUS_SIGNING_KEY` (empty) in `/app/.env` and remove/clear the GitHub secret if you set one; redeploy once more.
6. Smoke: login, refresh (`POST /api/auth/refresh`), hit a protected route.

Helper: `scripts/ops/rotate-jwt-signing-key.sh` (prints the env edits; does not SSH for you).

## Emergency (compromise)

If the old key is compromised and you cannot keep validating it:

1. Set only the new `JWT_SIGNING_KEY` (leave `JWT_PREVIOUS_SIGNING_KEY` empty).
2. Redeploy immediately — all outstanding access JWTs fail until refresh/login.
3. Optionally revoke refresh sessions in DB if the attacker may also hold refresh tokens:
   ```sql
   UPDATE identity."RefreshTokens"
   SET "RevokedAtUtc" = now() AT TIME ZONE 'utc',
       "RevokedReason" = 'signing-key-compromise'
   WHERE "RevokedAtUtc" IS NULL;
   ```

## Practice checklist (staging or local compose)

- [ ] Generate two keys; configure current + previous; confirm login works
- [ ] Issue a token under the old key (or keep previous set); confirm APIs accept it
- [ ] Clear previous; confirm only new-key tokens work
- [ ] Confirm refresh still issues a new access token after cutover

## Related

- Refresh-token rotation / reuse detection: `AuthSessionService` (`RotatedReason`, `RotationGrace`)
- Prod key rejection: `JwtConfigurationValidationTests`
- Deploy secret gate: `.github/workflows/deploy.yml` (`JWT_SIGNING_KEY` length ≥ 64)
