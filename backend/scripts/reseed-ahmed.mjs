#!/usr/bin/env node
/**
 * Re-seed demo HR user ahmed (معاين ميداني — أحمد سعيد).
 * Usage: node backend/scripts/reseed-ahmed.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const toolDir = path.join(root, "backend", "scripts", "reseed-ahmed-tool");

const result = spawnSync(
  "dotnet",
  ["run", "--project", path.join(toolDir, "ReseedAhmed.csproj"), "--", "ahmed"],
  { cwd: root, stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
