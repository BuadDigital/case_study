#!/usr/bin/env node
/**
 * Re-seed all demo HR staff and proc provider accounts.
 * Usage: node backend/scripts/reseed-all-users.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const toolDir = path.join(root, "backend", "scripts", "reseed-ahmed-tool");

const result = spawnSync(
  "dotnet",
  ["run", "--project", path.join(toolDir, "ReseedAhmed.csproj"), "--", "all"],
  { cwd: root, stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
