import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Gold fixture is offline training labels only.
 * Product extract does not call external OCR APIs.
 */
describe("osoul croquis gold fixture (local training)", () => {
  const goldPath = resolve(__dirname, "fixtures/osoul-croquis-gold.json");
  const gold = JSON.parse(readFileSync(goldPath, "utf-8")) as {
    items: Array<{
      file: string;
      descN?: string;
      descS?: string;
      descE?: string;
      descW?: string;
      descCount?: number;
    }>;
  };

  it("has 12 training files with 4 labeled descriptions each", () => {
    expect(gold.items).toHaveLength(12);
    for (const item of gold.items) {
      const descs = [item.descN, item.descS, item.descE, item.descW].filter(
        Boolean,
      );
      expect(descs.length, item.file).toBe(4);
      expect(item.descCount, item.file).toBe(4);
    }
  });
});
