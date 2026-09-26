import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractEvidenceExif } from "../process-evidence-photo";

// 800×600 JPEG with EXIF GPS 24.71365 N, 46.67535 E and DateTimeOriginal 2026:09:24 10:30:00.
const fixture = readFileSync(join(__dirname, "fixtures", "gps-photo.jpg"));

describe("extractEvidenceExif (spec §5.1 / §5.5)", () => {
  it("reads the GPS position as well as the capture time", async () => {
    const file = new File([fixture], "facade.jpg", { type: "image/jpeg" });

    const exif = await extractEvidenceExif(file);

    expect(exif.latitude).toBeCloseTo(24.71365, 4);
    expect(exif.longitude).toBeCloseTo(46.67535, 4);
    expect(exif.capturedAt).toBeTruthy();
  });
});
