import { describe, expect, it } from "vitest";
import {
  BASELINE_PATH,
  RATCHET_DOC,
  appDataRoots,
  importStatements,
  loadBaseline,
  readSource,
  relativePath,
  sourceFiles,
  workspaceSourceRoots,
} from "./support/frontend-tree";

/**
 * Storage module purity — the shape the prototype facades were split into.
 *
 * docs/architecture/solid-scorecard.md finding 4: the old `lib/prototype/*-storage.ts`
 * facades blurred reads, writes and workflow decisions. Slice 4 of the first pass split
 * them into `-model` / `-reads` / `-commands` triples under `lib/app-data`. These facts
 * keep the split honest: reads stay read-only, commands stay out of the query layer, and
 * no new `*-storage.ts` facade appears.
 */

/** A write literal anywhere in a reads module. */
const MUTATING_METHOD_LITERAL = /method:\s*["'`](POST|PUT|PATCH|DELETE)["'`]/;

/** `repositoryFetch(..., { method })` — catches a verb held in a variable, which the literal misses. */
const REPOSITORY_FETCH_WITH_METHOD = /repositoryFetch\s*\([^)]*\bmethod\b/;

/** TanStack query hooks: a commands module must not own the read side. */
const QUERY_HOOK = /\buse(Suspense|Infinite)?Query\s*[(<]/;

function appDataFiles(suffix: string): string[] {
  return appDataRoots().flatMap((root) =>
    sourceFiles(root, (name) => name.endsWith(suffix)),
  );
}

describe("app-data reads modules stay read-only", () => {
  const reads = appDataFiles("-reads.ts");

  it("finds the reads modules to check", () => {
    expect(reads.length).toBeGreaterThan(0);
  });

  it("contains no HTTP write verbs", () => {
    const offenders = reads
      .filter((file) => {
        const source = readSource(file);
        return (
          MUTATING_METHOD_LITERAL.test(source) ||
          REPOSITORY_FETCH_WITH_METHOD.test(source)
        );
      })
      .map(relativePath)
      .sort();

    expect(
      offenders,
      "A *-reads module issued an HTTP write. Move the call to the sibling *-commands " +
        `module so the read side stays free of side effects. ${RATCHET_DOC}\n  `,
    ).toEqual([]);
  });

  it("imports from a sibling commands module only for types", () => {
    const offenders = reads
      .flatMap((file) =>
        importStatements(readSource(file))
          .filter(
            (statement) =>
              /-commands(\.[jt]s)?$/.test(statement.from) && !statement.typeOnly,
          )
          .map((statement) => `${relativePath(file)} -> ${statement.from}`),
      )
      .sort();

    expect(
      offenders,
      "A *-reads module imports runtime code from a *-commands module, which puts the " +
        "write path back inside the read path. Use `import type` if only the type is " +
        `needed, otherwise invert the dependency. ${RATCHET_DOC}\n  `,
    ).toEqual([]);
  });
});

describe("app-data commands modules stay out of the query layer", () => {
  const commands = appDataFiles("-commands.ts");

  it("finds the commands modules to check", () => {
    expect(commands.length).toBeGreaterThan(0);
  });

  it("exports no TanStack query hooks", () => {
    const offenders = commands
      .filter((file) => QUERY_HOOK.test(readSource(file)))
      .map(relativePath)
      .sort();

    expect(
      offenders,
      "A *-commands module owns a TanStack query. Reads belong in the sibling *-reads " +
        `module; commands own mutations and cache invalidation only. ${RATCHET_DOC}\n  `,
    ).toEqual([]);
  });
});

describe("no new storage facades", () => {
  const baseline = loadBaseline();
  const frozen = baseline.storageModules.frozen;

  const found = [
    ...workspaceSourceRoots("apps"),
    ...workspaceSourceRoots("packages"),
  ]
    .flatMap((src) => sourceFiles(src, (name) => name.endsWith("-storage.ts")))
    .map(relativePath)
    .sort();

  it("admits no *-storage.ts module beyond the frozen three", () => {
    const offenders = found.filter((file) => !frozen.includes(file));

    expect(
      offenders,
      "New *-storage.ts facade(s). The facades were split into -model / -reads / -commands " +
        `triples under lib/app-data; follow that shape instead. ${RATCHET_DOC}\n  `,
    ).toEqual([]);
  });

  it("keeps the frozen list free of facades that were removed", () => {
    const stale = frozen.filter((file) => !found.includes(file));

    expect(
      stale,
      `These frozen facades no longer exist. Remove them from ${BASELINE_PATH} so the list ` +
        `only shrinks. ${RATCHET_DOC}\n  `,
    ).toEqual([]);
  });
});
