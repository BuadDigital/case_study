import { describe, expect, it, vi } from "vitest";
import { inlinePrintHtmlAssets } from "../inline-print-assets";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

const page = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic"/>
</head><body><p>نص</p></body></html>`;

describe("inlinePrintHtmlAssets — external stylesheets", () => {
  it("drops external stylesheets unless asked to inline them", async () => {
    const fetchText = vi.fn(async () => "p{color:red}");
    const out = await inlinePrintHtmlAssets(page, { parser: parse, fetchDataUrl: async () => null, fetchText });
    expect(out).not.toContain("<link");
    expect(fetchText).not.toHaveBeenCalled();
  });

  it("embeds the sheet and resolves its fonts against the sheet's own address", async () => {
    const seen: string[] = [];
    const out = await inlinePrintHtmlAssets(page, {
      parser: parse,
      inlineStylesheets: true,
      fetchText: async () => '@font-face{font-family:"IBM Plex Sans Arabic";src:url(/s/plex/arabic.woff2) format("woff2")}',
      fetchDataUrl: async (url) => {
        seen.push(url);
        return "data:font/woff2;base64,Rk9OVA==";
      },
    });
    expect(out).not.toContain("<link");
    expect(out).toContain("<style>@font-face");
    expect(out).toContain("url('data:font/woff2;base64,Rk9OVA==')");
    expect(seen).toEqual(["https://fonts.googleapis.com/s/plex/arabic.woff2"]);
  });

  it("drops a sheet that cannot be read instead of leaving a link the renderer cannot load", async () => {
    const out = await inlinePrintHtmlAssets(page, {
      parser: parse,
      inlineStylesheets: true,
      fetchText: async () => null,
      fetchDataUrl: async () => null,
    });
    expect(out).not.toContain("<link");
    expect(out).not.toContain("@font-face");
  });
});
