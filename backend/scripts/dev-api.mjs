#!/usr/bin/env node
/**
 * Starts gateway (5160) and domain services (5161–5169).
 * Usage:
 *   node backend/scripts/dev-api.mjs          # dotnet watch run (hot reload)
 *   node backend/scripts/dev-api.mjs --run    # dotnet run (no watch)
 *   node backend/scripts/dev-api.mjs --run --skip-build
 */
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const useWatch = !process.argv.includes("--run");
const skipBuild = process.argv.includes("--skip-build");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const stopScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "stop-api.mjs");

function stopStaleProcesses() {
  console.log("[dev-api] stopping any existing API processes on 5160–5169…");
  try {
    execSync(`node "${stopScript}"`, { cwd: root, stdio: "inherit" });
  } catch {
    // best effort
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: true });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

const services = [
  {
    name: "identity",
    readyUrl: "http://127.0.0.1:5161/ready",
    project: "backend/services/identity/RealEstateEval.Identity.Api/RealEstateEval.Identity.Api.csproj",
  },
  {
    name: "case-study",
    project: "backend/services/case-study/RealEstateEval.CaseStudy.Api/RealEstateEval.CaseStudy.Api.csproj",
  },
  {
    name: "operations",
    project: "backend/services/operations/RealEstateEval.Operations.Api/RealEstateEval.Operations.Api.csproj",
  },
  {
    name: "reporting",
    project: "backend/services/reporting/RealEstateEval.Reporting.Api/RealEstateEval.Reporting.Api.csproj",
  },
  {
    name: "financial",
    project: "backend/services/financial/RealEstateEval.Financial.Api/RealEstateEval.Financial.Api.csproj",
  },
  {
    name: "valuation",
    project: "backend/services/valuation/RealEstateEval.Valuation.Api/RealEstateEval.Valuation.Api.csproj",
  },
  {
    name: "failures",
    project: "backend/services/failures/RealEstateEval.Failures.Api/RealEstateEval.Failures.Api.csproj",
  },
  {
    name: "platform",
    project: "backend/services/platform/RealEstateEval.Platform.Api/RealEstateEval.Platform.Api.csproj",
  },
  {
    name: "attachments",
    project: "backend/services/attachments/RealEstateEval.Attachments.Api/RealEstateEval.Attachments.Api.csproj",
  },
  {
    name: "gateway",
    readyUrl: "http://127.0.0.1:5160/health",
    project: "backend/gateway/RealEstateEval.Gateway/RealEstateEval.Gateway.csproj",
  },
];

const children = [];

function startService({ name, project }) {
  const fullProject = path.join(root, project);
  const runArgs = useWatch
    ? ["watch", "run", "--project", fullProject, "--launch-profile", "http", "--non-interactive"]
    : ["run", "--project", fullProject, "--launch-profile", "http", "--no-build"];
  const child = spawn("dotnet", runArgs, { cwd: root, stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    console.error(`[${name}] exited with code ${code ?? "?"}`);
    shutdown(code ?? 1);
  });
  children.push(child);
  console.log(`[dev-api] started ${name} (${useWatch ? "watch" : "run"})`);
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReady(url, label, timeoutMs = 120_000) {
  const started = Date.now();
  process.stdout.write(`[dev-api] waiting for ${label} (${url})…`);
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) {
        console.log(" ready");
        return true;
      }
    } catch {
      // service still starting
    }
    await sleep(500);
  }
  console.warn(`\n[dev-api] timed out waiting for ${label} — continuing anyway`);
  return false;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`[dev-api] mode: ${useWatch ? "dotnet watch run" : "dotnet run"}`);

stopStaleProcesses();

// Shared backend projects must be built once before parallel `dotnet watch` instances
// compete for the same obj/bin DLLs (especially on Windows + Defender).
await run("dotnet", ["build", "backend/RealEstateEval.slnx", "-v", "q"]);

if (!useWatch && !skipBuild) {
  // `--run` uses --no-build below; solution already built above.
}

const identity = services.find((s) => s.name === "identity");
const caseStudy = services.find((s) => s.name === "case-study");
const gateway = services.find((s) => s.name === "gateway");
const others = services.filter(
  (s) => s.name !== "identity" && s.name !== "gateway" && s.name !== "case-study",
);

// case-study applies EF migrations to the shared DB; identity serves login.
// Start sequentially so watch processes do not lock the same shared assemblies.
startService(caseStudy);
await waitForReady("http://127.0.0.1:5162/ready", "case-study");

startService(identity);
await waitForReady(identity.readyUrl, "identity");

startService(gateway);
await waitForReady(gateway.readyUrl, "gateway");

// Remaining services — stagger watch starts to avoid shared-project file locks.
for (const svc of others) {
  startService(svc);
  if (useWatch) await sleep(2_000);
}

console.log("");
console.log("[dev-api] login-ready: http://127.0.0.1:5160");
console.log("[dev-api] other services still starting in the background…");
console.log("");
