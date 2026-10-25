// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { ValuationReportLiveFill } from "../valuation-report-fill-model";
import { fillFinalBanner } from "../valuation-report-live-fill-dom";

function section(): Element {
  const sec = document.createElement("section");
  sec.innerHTML =
    '<div style="background:#102b4e"><div><span>القيمة</span><span></span></div><div></div></div>';
  return sec;
}

const fill = (finalValue: number | null) =>
  ({ finalDisplay: "1,240,000 ر.س.", finalWords: "فقط …", finalValue }) as ValuationReportLiveFill;

describe("fillFinalBanner", () => {
  it("stamps the exact final value the server checks before the copy freezes", () => {
    const sec = section();
    fillFinalBanner(sec, fill(1_240_000));
    const banner = sec.querySelector("div")!;
    expect(banner.getAttribute("data-final-value")).toBe("1240000");
    expect(banner.textContent).toContain("1,240,000");
  });

  it("drops a stale marker when there is no final value", () => {
    const sec = section();
    fillFinalBanner(sec, fill(1_240_000));
    fillFinalBanner(sec, fill(null));
    expect(sec.querySelector("div")!.hasAttribute("data-final-value")).toBe(false);
  });
});
