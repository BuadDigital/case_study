#!/usr/bin/env node
/**
 * Starts gateway (5160) and domain services (5161–5169) with dotnet watch.
 * Usage: node backend/scripts/dev-api.mjs
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

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
  const child = spawn(
    "dotnet",
    ["watch", "run", "--project", fullProject, "--launch-profile", "http", "--non-interactive"],
    { cwd: root, stdio: "inherit", shell: true },
  );
  child.on("exit", (code) => {
    console.error(`[${name}] exited with code ${code ?? "?"}`);
    shutdown(code ?? 1);
  });
  children.push(child);
  console.log(`[dev-api] started ${name}`);
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

for (const svc of services.slice(0, -1)) startService(svc);
setTimeout(() => startService(services[services.length - 1]), 5000);
