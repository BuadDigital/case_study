#!/usr/bin/env node
/**
 * Starts gateway (5160) and domain services (5161–5169).
 * Usage:
 *   node backend/scripts/dev-api.mjs          # dotnet watch run (hot reload)
 *   node backend/scripts/dev-api.mjs --run    # dotnet run (no watch)
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

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`[dev-api] mode: ${useWatch ? "dotnet watch run" : "dotnet run"}`);

stopStaleProcesses();

if (!useWatch && !skipBuild) {
  await run("dotnet", ["build", "backend/RealEstateEval.slnx"]);
}

for (const svc of services.slice(0, -1)) startService(svc);
setTimeout(() => startService(services[services.length - 1]), 5000);
