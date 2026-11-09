import { describe, expect, it } from "vitest";
import {
  readSource,
  relativePath,
  sourceFiles,
  workspaceSourceRoots,
} from "./support/frontend-tree";

/**
 * No re-export shims.
 *
 * What: when code moves, its importers move with it. A file left behind whose only statements are
 * `export … from "…"` (a "shim") gives the same code two import paths, and the old path keeps
 * collecting new importers. These facts fail on any such file outside the allowed list.
 *
 * How it works: each non-test source file under apps/*\/src and packages/*\/src has its comments,
 * `"use client"` directive and `export … from` statements removed; if nothing is left (and it did
 * export something) it is a re-export-only file. Package and app entry points (`src/index.ts`) are
 * always allowed — they are the public API. The few barrels kept on purpose are listed below.
 *
 * Edge cases:
 * - Fixed (2026-11-04): 27 shims/barrels were deleted and their ~200 importer files pointed at the real
 *   modules (e.g. `lib/app-data/inspector-workspace-data.ts`, `app-shared/lib/arabic-digits.ts`).
 * - A barrel that also declares something of its own is not re-export-only and is not checked.
 * - The kept list may only shrink; the last fact fails when a listed file is gone or gains code.
 */

/** Barrels kept on purpose: one stable import path over several modules, many importers each. */
const KEPT_BARRELS = [
  // Inspection-tab parts used by the tab and the field-inspection wizard (15 importers).
  "apps/mfe-case-study/src/components/po-intake/PropertyDetailInspectionParts.tsx",
  // PO intake facade over the app-shared intake modules plus local boundaries/due dates (~165 importers).
  "apps/mfe-case-study/src/lib/app-data/po-intake-data.ts",
  // Workflow-task facade over tasks-model / -reads / -commands (~120 importers).
  "apps/mfe-case-study/src/lib/app-data/tasks.ts",
  // Form UX folder barrel (~45 importers).
  "packages/app-shared/src/form-ux/index.ts",
];

const ENTRY_POINT = /^(apps|packages)\/[^/]+\/src\/index\.tsx?$/;

const REEXPORT = /export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["'][^"']+["']\s*;?/g;

function isReexportOnly(source: string): boolean {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*["']use (client|server)["'];?\s*$/m, "");
  if (!REEXPORT.test(code)) return false;
  REEXPORT.lastIndex = 0;
  return code.replace(REEXPORT, "").trim() === "";
}

describe("no re-export shims", () => {
  const reexportOnly = [...workspaceSourceRoots("apps"), ...workspaceSourceRoots("packages")]
    .flatMap((src) => sourceFiles(src, (name) => /\.(ts|tsx)$/.test(name)))
    .filter((file) => isReexportOnly(readSource(file)))
    .map(relativePath)
    .sort();

  it("finds the entry points it should allow", () => {
    expect(reexportOnly.some((file) => ENTRY_POINT.test(file))).toBe(true);
  });

  it("admits no re-export-only file outside entry points and the kept barrels", () => {
    const offenders = reexportOnly.filter(
      (file) => !ENTRY_POINT.test(file) && !KEPT_BARRELS.includes(file),
    );

    expect(
      offenders,
      "Re-export-only file(s). Point the importers (including tests and vi.mock paths) at the " +
        "module that holds the code and delete the shim.\n  ",
    ).toEqual([]);
  });

  it("keeps the kept-barrel list free of files that are gone or no longer re-export-only", () => {
    const stale = KEPT_BARRELS.filter((file) => !reexportOnly.includes(file));
    expect(stale, "Remove these from KEPT_BARRELS so the list only shrinks.\n  ").toEqual([]);
  });
});
