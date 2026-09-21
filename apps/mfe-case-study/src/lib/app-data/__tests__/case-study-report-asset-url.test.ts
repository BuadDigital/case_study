import { describe, expect, it } from "vitest";
import { caseStudyReportAssetUrl } from "../case-study-report-render";

const ORIGIN = "http://192.168.1.125:3000";

describe("caseStudyReportAssetUrl", () => {
  it("prefixes a site-relative path with the origin", () => {
    expect(caseStudyReportAssetUrl("/case-study/emad-signature.png", ORIGIN)).toBe(
      `${ORIGIN}/case-study/emad-signature.png`,
    );
  });

  it("leaves an uploaded data: signature untouched", () => {
    const data = "data:image/png;base64,iVBORw0KGgo=";
    expect(caseStudyReportAssetUrl(data, ORIGIN)).toBe(data);
  });

  it("leaves an absolute URL untouched", () => {
    const url = "https://cdn.example.com/sig.png";
    expect(caseStudyReportAssetUrl(url, ORIGIN)).toBe(url);
  });

  it("returns the path as is without an origin", () => {
    expect(caseStudyReportAssetUrl("/case-study/a.png")).toBe("/case-study/a.png");
  });
});
