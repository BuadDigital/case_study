#!/usr/bin/env node
/**
 * Starts essential local infrastructure for dev / release verification.
 * Usage: node backend/scripts/dev-infra.mjs
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const composeFile = path.join(root, "infra", "docker-compose.yml");
const services = ["postgres", "rabbitmq", "redis"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, label, timeoutMs = 120_000, init = {}) {
  const started = Date.now();
  process.stdout.write(`[dev-infra] waiting for ${label}…`);
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(3_000),
      });
      if (res.ok) {
        console.log(" ready");
        return true;
      }
    } catch {
      // still starting
    }
    await sleep(1_500);
  }
  console.warn(`\n[dev-infra] timed out waiting for ${label}`);
  return false;
}

async function waitForRabbitMq(timeoutMs = 120_000) {
  const url = "http://127.0.0.1:15672/api/overview";
  const auth = Buffer.from("dev:dev").toString("base64");
  const httpReady = await waitForHttp(url, "rabbitmq management", timeoutMs, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (httpReady) return true;

  const { execSync } = await import("node:child_process");
  try {
    execSync("docker exec ree-rabbitmq rabbitmq-diagnostics -q ping", {
      cwd: root,
      stdio: "pipe",
    });
    console.log("[dev-infra] rabbitmq ready (docker healthcheck)");
    return true;
  } catch {
    return false;
  }
}

function runDockerCompose(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["compose", "-f", composeFile, ...args], {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`docker compose exited ${code}`)),
    );
  });
}

console.log("[dev-infra] starting postgres, rabbitmq, redis…");
await runDockerCompose(["up", "-d", ...services]);

await waitForRabbitMq();

const { execSync } = await import("node:child_process");
for (let i = 0; i < 20; i++) {
  try {
    const out = execSync("docker exec ree-redis redis-cli ping", {
      cwd: root,
      stdio: "pipe",
    }).toString();
    if (out.includes("PONG")) {
      console.log("[dev-infra] redis ready");
      break;
    }
  } catch {
    await sleep(1_000);
  }
}

console.log("");
console.log("[dev-infra] infrastructure ready");
console.log("  postgres  localhost:5432  (postgres / Admin / realestate_eval_dev)");
console.log("  rabbitmq  localhost:5672  (dev / dev)  management :15672");
console.log("  redis     localhost:6379");
console.log("");
console.log("Next: npm run dev:api:run   then   npm run dev");
