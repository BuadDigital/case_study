import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port: Number(port), host: "127.0.0.1" });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

function findNextBin(startDir) {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "node_modules", "next", "dist", "bin", "next");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Prefer Wi‑Fi / Ethernet (192.168.x) over WSL/Docker virtual NICs (172.x). */
function getLanIp() {
  const candidates = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const net of ifaces ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        candidates.push(net.address);
      }
    }
  }
  return (
    candidates.find((a) => a.startsWith("192.168.")) ??
    candidates.find((a) => a.startsWith("10.")) ??
    candidates.find((a) => !a.startsWith("172.")) ??
    candidates[0] ??
    null
  );
}

const shellDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(shellDir, "..");
const nextBin = findNextBin(appDir);

if (!nextBin) {
  console.error("Could not find next — run npm install from the repo root.");
  process.exit(1);
}

const lan = getLanIp();
const port = process.env.PORT ?? "3000";

console.log("");
console.log("  Ejada shell — network dev (LAN + localhost)");
console.log("");
if (lan) {
  console.log(`  Share this URL:  http://${lan}:${port}`);
  console.log(`  Login:           http://${lan}:${port}/login`);
  console.log("");
  console.log("  Demo login:      admin@local.dev  /  Admin123!");
  console.log("  (Same Wi‑Fi only — not public internet.)");
  console.log("");
  console.log(
    "  LAN login calls the API on port 5160 (not proxied). Firewall must allow 3000 + 5160:",
  );
  console.log("    apps/shell/scripts/open-firewall.ps1  (Run as Administrator, once)");
  if (!lan.startsWith("192.168.")) {
    console.log("");
    console.log(
      "  Tip: if colleagues cannot connect, set ALLOWED_DEV_ORIGINS to your Wi‑Fi IP in next.config / env.",
    );
  }
} else {
  console.log("  (No LAN IP detected — check Wi‑Fi / Ethernet.)");
}
console.log(`  On this PC only: http://localhost:${port}`);
console.log("");
console.log("  Note: http://0.0.0.0 is NOT a browser URL — use the IP above.");
console.log("");

if (await isPortInUse(port)) {
  console.error(`  Port ${port} is already in use — dev server is probably running.`);
  console.error(`  Open:  http://localhost:${port}`);
  console.error(`  Stop:  npm run dev:stop   (then run npm run dev again)`);
  console.error("");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [nextBin, "dev", "--hostname", "0.0.0.0", "-p", port],
  {
    stdio: "inherit",
    cwd: appDir,
    env: {
      ...process.env,
      ...(lan ? { ALLOWED_DEV_ORIGINS: `${lan},${lan}:${port}` } : {}),
    },
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
