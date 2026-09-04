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
 * Lines of text — equal to `wc -l` for a newline-terminated file, so a baseline figure can
 * be spot-checked from a shell, and one higher for a file with no final newline.
 */
export function lineCount(file: string): number {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.length;
}

export type FrozenEntry = { path: string; lines: number };

export type SizeSection = {
  cap: number;
  note: string;
  frozen: FrozenEntry[];
};

export type FrontendSizeBaseline = {
  $schema?: string;
  generated: string;
  components: SizeSection;
  hooks: SizeSection;
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

/**
 * The two halves of a size ratchet, shared by the component and hook suites.
 * `overCap` = files that grew past the cap and are not frozen (the list may not grow).
 * `stale` = frozen entries that shrank below the cap or moved (the list must shrink).
 */
export function ratchetOffenders(
  files: string[],
  cap: number,
  frozen: FrozenEntry[],
): { overCap: string[]; stale: string[] } {
  const frozenPaths = new Set(frozen.map((entry) => entry.path));
  const overCap = files
    .map((file) => ({ path: relativePath(file), lines: lineCount(file) }))
    .filter((entry) => entry.lines > cap && !frozenPaths.has(entry.path))
    .map((entry) => `${entry.path} (${entry.lines} lines)`)
    .sort();

  const stale = frozen
    .filter((entry) => {
      const absolute = join(repoRoot(), entry.path);
      return !existsSync(absolute) || lineCount(absolute) <= cap;
    })
    .map((entry) =>
      existsSync(join(repoRoot(), entry.path))
        ? `${entry.path} (now ${lineCount(join(repoRoot(), entry.path))} lines, cap ${cap})`
        : `${entry.path} (moved or deleted)`,
    )
    .sort();

  return { overCap, stale };
}

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
