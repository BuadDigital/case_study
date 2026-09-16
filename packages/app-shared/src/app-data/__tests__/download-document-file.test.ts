import { describe, expect, it } from "vitest";
import { blobFromDataUrl } from "../download-document-file";

describe("blobFromDataUrl", () => {
  it("decodes a PDF data URL with the PDF mime type", () => {
    const blob = blobFromDataUrl("data:application/pdf;base64,JVBERi0=");
    expect(blob).not.toBeNull();
    expect(blob?.type).toBe("application/pdf");
    expect(blob?.size).toBeGreaterThan(0);
  });

  it("returns null for a non-data URL", () => {
    expect(blobFromDataUrl("https://example.test/deed.pdf")).toBeNull();
  });
});
