#!/usr/bin/env node
/**
 * Tier 3 release gate — verifies APIs, gateway, and RabbitMQ are reachable.
 * Prerequisites:
 *   npm run dev:infra
 *   npm run dev:api:run
 */
import process from "node:process";

const API_HOST = process.env.API_HOST ?? "127.0.0.1";

/** @type {{ name: string; url: string; optional?: boolean }[]} */
export const API_SERVICES = [
  { name: "gateway", url: `http://${API_HOST}:5160/health` },
  { name: "identity", url: `http://${API_HOST}:5161/ready` },
  { name: "case-study", url: `http://${API_HOST}:5162/ready` },
  { name: "operations", url: `http://${API_HOST}:5163/ready` },
  { name: "reporting", url: `http://${API_HOST}:5164/ready` },
  { name: "financial", url: `http://${API_HOST}:5165/ready` },
  { name: "valuation", url: `http://${API_HOST}:5166/ready` },
  { name: "failures", url: `http://${API_HOST}:5167/ready` },
  { name: "platform", url: `http://${API_HOST}:5168/ready` },
  { name: "attachments", url: `http://${API_HOST}:5169/ready` },
];

const RABBITMQ_OVERVIEW = `http://${API_HOST}:15672/api/overview`;
const RABBITMQ_AUTH = Buffer.from("dev:dev").toString("base64");

async function probe(url, timeoutMs = 5_000, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  return { ok: res.ok, status: res.status };
}

async function verifyApis() {
  const failures = [];
  for (const svc of API_SERVICES) {
    try {
      const { ok, status } = await probe(svc.url);
      if (ok) {
        console.log(`  ✓ ${svc.name} (${status})`);
      } else {
        console.error(`  ✗ ${svc.name} HTTP ${status}`);
        failures.push(svc.name);
      }
    } catch (err) {
      console.error(`  ✗ ${svc.name} unreachable — ${err instanceof Error ? err.message : err}`);
      failures.push(svc.name);
    }
  }
  return failures;
}

async function verifyRabbitMq() {
  try {
    const res = await fetch(RABBITMQ_OVERVIEW, {
      signal: AbortSignal.timeout(5_000),
      headers: { Authorization: `Basic ${RABBITMQ_AUTH}` },
    });
    if (!res.ok) {
      console.error(`  ✗ rabbitmq management HTTP ${res.status}`);
      return false;
    }
    const body = await res.json();
    const version = body?.rabbitmq_version ?? "unknown";
    console.log(`  ✓ rabbitmq (${version})`);
    return true;
  } catch (err) {
    console.error(
      `  ✗ rabbitmq unreachable — ${err instanceof Error ? err.message : err}`,
    );
    console.error("    Run: npm run dev:infra");
    return false;
  }
}

async function verifyLogin() {
  const url = `http://${API_HOST}:5160/api/auth/login-username`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "sliman" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`  ✗ login-username HTTP ${res.status}`);
      return false;
    }
    const data = await res.json();
    if (!data?.token) {
      console.error("  ✗ login-username missing token");
      return false;
    }
    console.log("  ✓ login-username (sliman)");
    return true;
  } catch (err) {
    console.error(`  ✗ login-username — ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

console.log("[release-verify] API services");
const apiFailures = await verifyApis();

console.log("[release-verify] RabbitMQ");
const rabbitOk = await verifyRabbitMq();

console.log("[release-verify] Auth");
const loginOk = await verifyLogin();

const failed = apiFailures.length > 0 || !rabbitOk || !loginOk;
if (failed) {
  console.error("");
  console.error("[release-verify] FAILED");
  if (apiFailures.length) {
    console.error(`  Unhealthy APIs: ${apiFailures.join(", ")}`);
    console.error("  Ensure: npm run dev:infra && npm run dev:api:run");
  }
  process.exit(1);
}

console.log("");
console.log("[release-verify] PASSED — stack ready for E2E");
