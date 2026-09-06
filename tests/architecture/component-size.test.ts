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
 * Component size ratchet — the frontend twin of
 * `backend/RealEstateEval.Architecture.Tests/InfrastructureServiceSizeTests`.
 *
 * docs/architecture/solid-scorecard.md finding 4: workflow still lives in components and
 * views. The third pass got every entry file under 700 lines except the ones listed in
 * `docs/architecture/frontend-size-baseline.json`. This pair of facts freezes that list:
 * nothing new may join it, and an entry that drops below the cap must leave it, so the
 * ratchet only turns one way.
 */
describe("frontend component size ratchet", () => {
  const baseline = loadBaseline();
  const { cap, frozen } = baseline.components;

  const files = workspaceSourceRoots("apps").flatMap((src) =>
    sourceFiles(src, (name) => name.endsWith(".tsx")),
  );

  it("scans every app component", () => {
    // A guard on the scanner itself: if a refactor moves apps/*/src the ratchet would
    // silently pass on an empty set.
    expect(files.length).toBeGreaterThan(200);
  });

  it("admits no new component over the cap", () => {
    const { overCap } = ratchetOffenders(files, cap, frozen);

    expect(
      overCap,
      `These components are over ${cap} lines and are not frozen. Split the screen: move ` +
        "workflow into a use*Workflow hook, pure decisions into lib/app-data, and table or " +
        `parts collections into their own file — or record the file in ${BASELINE_PATH} ` +
        `with a reason. ${RATCHET_DOC}\n  `,
    ).toEqual([]);
  });

  it("keeps the frozen list free of entries that shrank or moved", () => {
    const { stale } = ratchetOffenders(files, cap, frozen);

    expect(
      stale,
      "These frozen entries are no longer over the cap (or no longer exist). Remove them " +
        `from ${BASELINE_PATH} so the file cannot regrow unnoticed. ${RATCHET_DOC}\n  `,
    ).toEqual([]);
  });
});
