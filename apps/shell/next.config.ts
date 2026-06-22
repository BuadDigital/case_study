import os from "node:os";
import type { NextConfig } from "next";

const apiUpstream =
  process.env.API_UPSTREAM_URL ?? "http://127.0.0.1:5160";

/** Comma-separated hosts for LAN demos, e.g. ALLOWED_DEV_ORIGINS=192.168.1.50:3000 */
function getDevAllowedOrigins(): string[] {
  const port = process.env.PORT ?? "3000";
  const origins = new Set<string>([
    "127.0.0.1",
    `127.0.0.1:${port}`,
    "localhost",
    `localhost:${port}`,
  ]);

  for (const entry of (process.env.ALLOWED_DEV_ORIGINS ?? "").split(",")) {
    const host = entry.trim();
    if (!host) continue;
    origins.add(host);
    if (!host.includes(":")) origins.add(`${host}:${port}`);
  }

  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const net of ifaces ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        origins.add(net.address);
        origins.add(`${net.address}:${port}`);
      }
    }
  }

  return [...origins];
}

const allowedDevOrigins = getDevAllowedOrigins();

const nextConfig: NextConfig = {
  /** Hide the floating "N" dev badge (bottom-left) during `npm run dev`. */
  devIndicators: false,
  /** Required when colleagues open http://YOUR_LAN_IP:3000 — otherwise login JS is blocked. */
  allowedDevOrigins,
  /** LAN guests call /api on :3000; Next proxies to the .NET API on this machine. */
  async redirects() {
    return [
      { source: "/welcome", destination: "/dashboard", permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUpstream}/api/:path*`,
      },
    ];
  },
  transpilePackages: [
    "@case-study/mfe",
    "@failures/mfe",
    "@settings/mfe",
    "@platform/app-shared",
    "@platform/api-client",
    "@platform/auth-client",
    "@platform/design-system",
    "@platform/types",
  ],
};

export default nextConfig;
