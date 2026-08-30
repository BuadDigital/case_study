/** Private LAN host (Wi‑Fi demo) — not localhost and not a public DNS name. */
export function isPrivateLanHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("10.")) return true;
  return /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

/**
 * API base URL.
 * - localhost dev: NEXT_PUBLIC_API_URL or same origin (Next.js rewrites /api/* → :5160).
 * - LAN IP dev (e.g. 192.168.x.x:3000): gateway on :5160 on the same host (CORS allows :3000).
 *   Ignores NEXT_PUBLIC_API_URL when it points at localhost — that breaks LAN teammates.
 */
export function getApiBase(): string {
  const apiPort = process.env.NEXT_PUBLIC_API_PORT ?? "5160";
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const { hostname, origin, protocol } = window.location;
    if (
      process.env.NODE_ENV === "development" &&
      isPrivateLanHost(hostname)
    ) {
      return `${protocol}//${hostname}:${apiPort}`;
    }
    if (fromEnv) return fromEnv;
    return origin;
  }

  if (fromEnv) return fromEnv;
  return `http://127.0.0.1:${apiPort}`;
}
