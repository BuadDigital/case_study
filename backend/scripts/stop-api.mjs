#!/usr/bin/env node
/**
 * Stops local RealEstateEval API processes (gateway + services on 5160–5169).
 * Usage: node backend/scripts/stop-api.mjs
 */
import { execSync } from "node:child_process";

const PORTS = Array.from({ length: 10 }, (_, i) => 5160 + i);

const PROCESS_NAMES = [
  "RealEstateEval.Gateway",
  "RealEstateEval.Identity.Api",
  "RealEstateEval.CaseStudy.Api",
  "RealEstateEval.Operations.Api",
  "RealEstateEval.Reporting.Api",
  "RealEstateEval.Financial.Api",
  "RealEstateEval.Valuation.Api",
  "RealEstateEval.Failures.Api",
  "RealEstateEval.Platform.Api",
  "RealEstateEval.Attachments.Api",
];

function stopOnWindows() {
  for (const name of PROCESS_NAMES) {
    try {
      execSync(`taskkill /F /IM ${name}.exe`, { stdio: "ignore" });
      console.log(`[stop-api] stopped ${name}`);
    } catch {
      // not running
    }
  }

  const ports = PORTS.join(",");
  const ps = `
    $ports = @(${PORTS.join(",")})
    foreach ($port in $ports) {
      Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    }
  `;
  try {
    execSync(`powershell -NoProfile -Command "${ps.replace(/\n/g, " ")}"`, { stdio: "ignore" });
  } catch {
    // ignore
  }
}

function stopOnUnix() {
  for (const port of PORTS) {
    try {
      const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
      if (!pids) continue;
      for (const pid of pids.split(/\s+/)) {
        if (pid) {
          execSync(`kill -9 ${pid}`, { stdio: "ignore" });
          console.log(`[stop-api] killed pid ${pid} on :${port}`);
        }
      }
    } catch {
      // nothing listening
    }
  }
}

if (process.platform === "win32") {
  stopOnWindows();
} else {
  stopOnUnix();
}

console.log("[stop-api] done");
