import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  readSource,
  relativePath,
  repoRoot,
  sourceFiles,
  workspaceSourceRoots,
} from "./support/frontend-tree";

/**
 * One registry for browser event names.
 *
 * What: every app-wide `window` event name lives in `packages/app-shared/src/events/app-events.ts`.
 * These facts fail when a name from the registry is typed by hand again somewhere else, or when a
 * new `*_EVENT = "..."` constant is defined outside the registry.
 *
 * How it works: the registry's `export const X_EVENT = "value"` lines are read as data; every
 * non-test source file under apps/*\/src and packages/*\/src is scanned for those values as quoted
 * literals, and for `X_EVENT = "<literal>"` definitions. No AST — the repo's style is regular enough.
 *
 * Edge cases:
 * - `@platform/auth-client` and `@platform/offline-client` sit below app-shared (app-shared depends
 *   on them), so they cannot import the registry. Their own definition files are the second and
 *   third allowed homes, and their names get the same "no hand-typed copy" rule.
 * - Fixed (2026-11-04): "field-inspection-submission-changed" was typed in five files,
 *   "evaluator-submission-changed" in three, and three one-line files existed only to share a name.
 */

const REGISTRY = "packages/app-shared/src/events/app-events.ts";

/** Packages below app-shared that keep their own event names (they cannot import the registry). */
const LOWER_PACKAGE_EVENT_HOMES = [
  "packages/auth-client/src/session.ts",
  "packages/offline-client/src/types.ts",
];

const ALLOWED_DEFINITION_HOMES = new Set([REGISTRY, ...LOWER_PACKAGE_EVENT_HOMES]);

/** `X_EVENT = "value"` (optionally `export`, optionally typed, value on the next line). */
const EVENT_DEFINITION = /\b([A-Z][A-Z0-9_]*_EVENT)\s*(?::\s*[\w<>|\s"']+)?=\s*["'`]([^"'`\n]+)["'`]/g;

function eventDefinitions(file: string, source = readSource(join(repoRoot(), file))): { name: string; value: string }[] {
  return [...source.matchAll(EVENT_DEFINITION)].map((match) => ({
    name: match[1],
    value: match[2],
  }));
}

function allSourceFiles(): string[] {
  return [...workspaceSourceRoots("apps"), ...workspaceSourceRoots("packages")].flatMap((src) =>
    sourceFiles(src, (name) => /\.(ts|tsx)$/.test(name)),
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("app event registry", () => {
  const registry = eventDefinitions(REGISTRY);
  const lower = LOWER_PACKAGE_EVENT_HOMES.flatMap((file) =>
    eventDefinitions(file).map((entry) => ({ ...entry, home: file })),
  );
  // Every source read once: the scans below ran past vitest's 5 s budget on a busy machine when
  // each test read ~1,800 files again (seen in the full run, 2026-11-04).
  const sources = allSourceFiles().map((absolute) => ({
    file: relativePath(absolute),
    source: readSource(absolute),
  }));

  it("finds the registry and its names", () => {
    expect(registry.length).toBeGreaterThan(20);
    expect(lower.length).toBeGreaterThan(0);
  });

  it("gives every event a distinct wire name", () => {
    const values = [...registry, ...lower].map((entry) => entry.value);
    const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
    expect(duplicates, "Two event constants share one wire name.").toEqual([]);
  });

  it("never types a registered event name by hand outside its home", () => {
    const homes = new Map<string, string>([
      ...registry.map((entry) => [entry.value, REGISTRY] as const),
      ...lower.map((entry) => [entry.value, entry.home] as const),
    ]);
    const literals = new RegExp(
      `["'\`](${[...homes.keys()].map(escapeRegExp).join("|")})["'\`]`,
      "g",
    );
    const offenders = sources.flatMap(({ file, source }) =>
      [...new Set([...source.matchAll(literals)].map((match) => match[1]))]
        .filter((value) => homes.get(value) !== file)
        .map((value) => `${file}: "${value}"`),
    );

    expect(
      offenders.sort(),
      `An event name is typed as a string literal. Import its constant from ${REGISTRY} ` +
        "(or from auth-client / offline-client for their own names) instead.\n  ",
    ).toEqual([]);
  });

  it("defines no *_EVENT string constant outside the registry", () => {
    const offenders = sources
      .filter(({ file }) => !ALLOWED_DEFINITION_HOMES.has(file))
      .flatMap(({ file, source }) =>
        eventDefinitions(file, source).map((entry) => `${file}: ${entry.name} = "${entry.value}"`),
      );

    expect(
      offenders.sort(),
      `New window event constant(s) outside the registry. Add the name to ${REGISTRY} and ` +
        "import it from there.\n  ",
    ).toEqual([]);
  });
});
