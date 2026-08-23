import { describe, expect, it } from "vitest";
import { BRAND_IDENTITY_DEFAULTS } from "@platform/api-client";
import { prepareValuationReportV3Html } from "../valuation-report-v3-preview";

const SAMPLE = `<!DOCTYPE html><html><head><style>
.pg{padding:46mm 16mm 32mm 16mm;background:#fff url('assets/ejadah-letterhead.png')}
</style></head><body>
<section class="page pg">
  <div class="pg-meta">رقم التقرير: x</div>
  <section class="sec" data-sec="26">
    <h2>المشاركون</h2>
    <table class="ctr">
      <tr><td class="k">الاسم</td><td class="v">خالد التجريبي</td></tr>
      <tr><td class="k">التوقيع</td><td class="v" style="height:52px"></td></tr>
    </table>
  </section>
  <h2>إعتماد تقرير التقييم</h2>
  <table>
    <tr><td class="k">التوقيع</td><td class="v" style="height:64px"></td><td class="k">ختم المنشأة</td><td class="v"></td></tr>
  </table>
</section>
</body></html>`;

describe("valuation report v3 print branding", () => {
  it("applies letterhead margins, stamp size, and signatures from settings", () => {
    const html = prepareValuationReportV3Html(
      SAMPLE,
      {
        branding: {
          ...BRAND_IDENTITY_DEFAULTS,
          letterheadUrl: "/case-study/custom-lh.png",
          stampUrl: "/case-study/custom-stamp.svg",
          signatureUrl: "/case-study/custom-sign.png",
          letterheadHeadMm: 40,
          letterheadFootTopMm: 268,
          letterheadPadMm: 18,
          letterheadPadStartMm: 14,
          stampWidthCm: 3.5,
          stampHeightCm: 3.5,
        },
        valuers: [
          {
            id: "v1",
            nameAr: "خالد التجريبي",
            role: "valuer",
            isActive: true,
            signatureUrl: "/case-study/khalid-sign.png",
          },
        ],
      },
      "print",
    );

    expect(html).toContain("padding:40mm 14mm 29mm 18mm");
    expect(html).toMatch(/custom-lh\.png/);
    expect(html).toContain("width:14mm");
    expect(html).toContain("width:18mm");
    expect(html).toMatch(/custom-stamp\.svg/);
    expect(html).toContain("width:3.5cm!important");
    expect(html).toContain("height:3.5cm!important");
    expect(html).toContain("min-height:3.5cm");
    expect(html).toMatch(/khalid-sign\.png/);
    expect(html).toContain("@page{size:A4;margin:0}");
    expect(html).toContain("top:calc(268mm + 1px)");
    expect(html).toContain("inset-inline-start:14mm");
    expect(html).toContain("translateX(-4px)");
    expect(html).toMatch(/<base href="/);
  });

  it("puts settings stamp size and certified signature on screen and matches short names", () => {
    const html = prepareValuationReportV3Html(
      `<section class="page pg">
        <h2>إعتماد تقرير التقييم</h2>
        <table>
          <tr><td class="k">الاسم</td><td class="v">عماد رشيد الرشيد</td><td class="k">رقم العضوية</td><td class="v num">1210000003</td></tr>
          <tr><td class="k">التوقيع</td><td class="v"></td><td class="k">ختم المنشأة</td><td class="v"><img src="assets/ejadah-stamp.png" alt="ختم المنشأة"></td></tr>
        </table>
      </section>`,
      {
        branding: {
          ...BRAND_IDENTITY_DEFAULTS,
          stampUrl: "data:image/png;base64,stamp",
          stampWidthCm: 3.2,
          stampHeightCm: 2.8,
        },
        valuers: [
          {
            id: "v1",
            nameAr: "عماد رشيد صالح الرشيد",
            role: "certified",
            isActive: true,
            signatureUrl: "data:image/png;base64,emad",
          },
        ],
      },
      "screen",
    );

    expect(html).toContain("data:image/png;base64,stamp");
    expect(html).toContain("width:3.2cm!important");
    expect(html).toContain("height:2.8cm!important");
    expect(html).toContain("data:image/png;base64,emad");
    expect(html).not.toContain("assets/ejadah-stamp.png");
  });

  it("scopes screen CSS so sidebar links stay visible", () => {
    const html = prepareValuationReportV3Html(
      `<style>
doc-page:not(:defined){visibility:hidden}
body{margin:0;direction:rtl}
a{color:#102b4e}a:hover{color:#a4906f}
.pg{padding:46mm}
</style><section class="page pg"><p>x</p></section>`,
      {},
      "screen",
    );
    expect(html).toContain(".val-rpt-screen a{");
    expect(html).toContain(".val-rpt-screen .pg{");
    expect(html).not.toMatch(/(^|})\s*a\s*\{/);
    expect(html).not.toMatch(/\bbody\s*\{/);
    expect(html).not.toMatch(/:not\(:defined\)/);
  });
});
