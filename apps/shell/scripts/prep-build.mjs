// Stale .next/dev/types from turbopack can leave AppRoutes = never while still
// shipping a full route validator; tsconfig includes those files and build fails.
import { rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
rmSync(join(root, ".next", "dev"), { recursive: true, force: true });
