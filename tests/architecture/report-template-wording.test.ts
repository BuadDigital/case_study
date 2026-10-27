import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./support/frontend-tree";

/**
 * One name for the liquidation discount in every printed template — «خصم التصفية».
 * The HTML templates sit outside the approved-terms ratchet (it reads TS / C# literals only).
 */
const TEMPLATES = [
  "apps/shell/public/ejadah/report-template-approved.html",
  "apps/shell/public/ejadah/valuation-report-v3.html",
];

describe("report template wording", () => {
  it.each(TEMPLATES)("%s names the liquidation discount «خصم التصفية»", (path) => {
    const html = readFileSync(join(repoRoot(), path), "utf8");
    expect(html).not.toContain("معامل التصفية");
    expect(html).toContain("مبرر خصم التصفية");
  });
});
