import { describe, expect, it } from "vitest";
import { storedFileNameOf } from "../assignment-doc-attachments";

describe("storedFileNameOf", () => {
  it("drops leading and trailing dots like the attachments service", () => {
    expect(storedFileNameOf(".deed.pdf")).toBe("deed.pdf");
    expect(storedFileNameOf("deed.pdf.")).toBe("deed.pdf");
  });

  it("keeps ordinary names, Arabic included, untouched", () => {
    expect(storedFileNameOf("صك الملكية.pdf")).toBe("صك الملكية.pdf");
    expect(storedFileNameOf("  deed 1.pdf ")).toBe("deed 1.pdf");
  });

  it("drops directory parts and reserved characters", () => {
    expect(storedFileNameOf("C:\\scans\\deed?.pdf")).toBe("deed.pdf");
    expect(storedFileNameOf("a/b/deed*.pdf")).toBe("deed.pdf");
  });
});
