import { describe, expect, it } from "vitest";
import {
  BASELINE_PATH,
  RATCHET_DOC,
  loadBaseline,
  ratchetOffenders,
  sourceFiles,
  workspaceSourceRoots,
} from "./support/frontend-tree";

/**
 * Hook size ratchet. Splitting a fat view usually moves the orchestration into a
 * `use*Workflow` hook, which then becomes the next thing to grow — the second pass in
 * docs/architecture/solid-scorecard.md called out two such hooks, and the third pass split
 * them into data / commands halves. This keeps that from being undone: a hook over the cap
 * must be recorded in `docs/architecture/frontend-size-baseline.json`, and an entry that
 * drops below the cap must leave the list.
 */
describe("frontend hook size ratchet", () => {
  const baseline = loadBaseline();
  const { cap, frozen } = baseline.hooks;

  const isHook = (name: string) => /^use.*\.ts$/.test(name);
  const files = [
    ...workspaceSourceRoots("apps"),
    ...workspaceSourceRoots("packages"),
  ].flatMap((src) => sourceFiles(src, isHook));

  it("scans every app and package hook module", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("admits no new hook over the cap", () => {
    const { overCap } = ratchetOffenders(files, cap, frozen);

    expect(
      overCap,
      `These hooks are over ${cap} lines and are not frozen. Split them the way ` +
        "useValuationWork* was split — a data half (queries, derived state) and a commands " +
        "half (mutations) — and keep pure decisions in lib/app-data. Otherwise record the " +
        `file in ${BASELINE_PATH}. ${RATCHET_DOC}\n  `,
    ).toEqual([]);
  });

  it("keeps the frozen list free of entries that shrank or moved", () => {
    const { stale } = ratchetOffenders(files, cap, frozen);

    expect(
      stale,
      "These frozen hooks are no longer over the cap (or no longer exist). Remove them " +
        `from ${BASELINE_PATH} so the ratchet only turns one way. ${RATCHET_DOC}\n  `,
    ).toEqual([]);
  });
});
