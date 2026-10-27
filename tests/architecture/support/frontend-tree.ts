/**
 * Shared scanning helpers for the frontend architecture ratchets.
 *
 * Mirrors `backend/RealEstateEval.Architecture.Tests/Support/RepoPaths.cs`: the tests
 * describe the rule, this file knows how to walk the tree and where the repo root is.
 * Deliberately dependency-free (node:fs only) and AST-free — see
 * docs/architecture/solid-scorecard.md, "Frontend architecture ratchet".
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Directories that never hold reviewable source. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "__tests__",
  "__mocks__",
]);

/** Walk up from this file until the repo root (the workspace package.json + vitest config). */
export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let hop = 0; hop < 8; hop += 1) {
    if (
      existsSync(join(dir, "vitest.config.ts")) &&
      existsSync(join(dir, "package.json"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    "Could not locate the repo root from tests/architecture/support/frontend-tree.ts",
  );
}

/** Repo-relative, forward-slashed — the form the baseline JSON records. */
export function relativePath(absolute: string): string {
  return absolute
    .slice(repoRoot().length + 1)
    .replaceAll("\\", "/");
}

/** The `src` directory of every workspace under `apps` or `packages` that has one. */
export function workspaceSourceRoots(root: "apps" | "packages"): string[] {
  const base = join(repoRoot(), root);
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .map((workspace) => join(base, workspace, "src"))
    .filter((src) => existsSync(src) && statSync(src).isDirectory());
}

/** Recursive file list, skipping build output, vendored code, dot-dirs and test folders. */
export function sourceFiles(
  directory: string,
  matches: (fileName: string) => boolean,
): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    if (SKIP_DIRS.has(name) || name.startsWith(".")) return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path, matches);
    if (isTestFile(name)) return [];
    return matches(name) ? [path] : [];
  });
}

export function isTestFile(fileName: string): boolean {
  return (
    fileName.includes(".test.") ||
    fileName.includes(".spec.") ||
    fileName.endsWith(".d.ts")
  );
}

/**
 * The frozen lists the ratchets read. Edge cases: it held line caps for components (700) and
 * hooks (500) too; those size rules were removed — they counted comment lines, so documenting
 * a file pushed it over the cap — and only the storage-module list is left.
 */
export type FrontendSizeBaseline = {
  $schema?: string;
  generated: string;
  storageModules: { note: string; frozen: string[] };
};

export const BASELINE_PATH = "docs/architecture/frontend-size-baseline.json";

export function loadBaseline(): FrontendSizeBaseline {
  const file = join(repoRoot(), BASELINE_PATH);
  return JSON.parse(readFileSync(file, "utf8")) as FrontendSizeBaseline;
}

/** The single sentence every ratchet failure ends with. */
export const RATCHET_DOC =
  `See docs/architecture/solid-scorecard.md ("Frontend architecture ratchet") and ${BASELINE_PATH}.`;

/** Absolute paths of the `app-data` module folders the storage-purity rules cover. */
export function appDataRoots(): string[] {
  const roots = [
    ...workspaceSourceRoots("apps").map((src) => join(src, "lib", "app-data")),
    resolve(repoRoot(), "packages", "app-shared", "src", "app-data"),
  ];
  return roots.filter((dir) => existsSync(dir) && statSync(dir).isDirectory());
}

export function readSource(file: string): string {
  return readFileSync(file, "utf8");
}

/** Import statements as `{ typeOnly, from }`, good enough without an AST for our import style. */
export function importStatements(
  source: string,
): { typeOnly: boolean; from: string }[] {
  const statements: { typeOnly: boolean; from: string }[] = [];
  const pattern = /\bimport\s+(type\s+)?[\s\S]*?\sfrom\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    statements.push({ typeOnly: Boolean(match[1]), from: match[2] });
  }
  return statements;
}
