import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");

describe("round 2 wording", () => {
  it("«إضافة مقارن» carries its hamza on the bank button", () => {
    const source = read("ComparablesBankTable.tsx");
    expect(source).not.toContain("اضافة مقارن");
    expect(source).toContain("إضافة مقارن");
  });
});
