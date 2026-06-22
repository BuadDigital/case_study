import type { FullConfig } from "@playwright/test";

const API_HOST = process.env.API_HOST ?? "127.0.0.1";
const SHELL_BASE = process.env.SHELL_BASE_URL ?? "http://127.0.0.1:3000";

export default async function globalSetup(_config: FullConfig) {
  const health = await fetch(`http://${API_HOST}:5160/health`, {
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null);
  if (!health?.ok) {
    throw new Error(
      `Gateway not reachable at http://${API_HOST}:5160 — run npm run dev:api:run first`,
    );
  }

  const shell = await fetch(`${SHELL_BASE}/login`, {
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!shell?.ok) {
    throw new Error(
      `Shell not reachable at ${SHELL_BASE}/login — run npm run dev first`,
    );
  }
}
