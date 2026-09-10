import { describe, expect, it, vi } from "vitest";
import {
  PRINT_FONT_FACE_CSS,
  bytesToBase64,
  inlinePrintHtmlAssets,
  makeDataUrlFetcher,
} from "../valuation-report-print-assets";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("inlinePrintHtmlAssets", () => {
  it("inlines images, CSS url() and fonts, then drops <base>, links and scripts", async () => {
    const seen: string[] = [];
    const fetchDataUrl = vi.fn(async (url: string) => {
      seen.push(url);
      if (url.endsWith("/ejadah/fonts/Tajawal-Regular.woff2")) return "data:font/woff2;base64,Rk9OVA==";
      if (url.endsWith("/case-study/ejadah-letterhead.png")) return "data:image/png;base64,TEg=";
      if (url.includes("/api/attachments/")) return "data:image/jpeg;base64,SlBH";
      return null;
    });

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<base href="http://localhost:3000/"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X"/>
<style>@font-face{font-family:"Tajawal";src:url("ejadah/fonts/Tajawal-Regular.woff2") format("woff2")}
.lh-slice{background-image:url("http://localhost:3000/case-study/ejadah-letterhead.png")}</style>
<script src="/ejadah/image-slot.js"></script></head>
<body><section class="page pg" style="background:url('case-study/ejadah-letterhead.png') no-repeat">
<img src="/api/attachments/abc" alt="photo" loading="lazy"/>
<img src="data:image/svg+xml;charset=utf-8,%3Csvg%3E" alt="map"/>
<img src="https://maps.googleapis.com/unreachable.png" alt="ext"/>
</section></body></html>`;

    const out = await inlinePrintHtmlAssets(html, { fetchDataUrl, parser: parse });

    expect(out.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(out).not.toContain("<base");
    expect(out).not.toContain("<link");
    expect(out).not.toContain("<script");
    expect(out).toContain('src="data:image/jpeg;base64,SlBH"');
    expect(out).toContain("data:image/svg+xml;charset=utf-8,%3Csvg%3E");
    expect(out).toContain("url('data:font/woff2;base64,Rk9OVA==')");
    expect(out).toContain("url('data:image/png;base64,TEg=')");
    // Inline style attribute rewritten too (single quotes survive the attribute serializer).
    expect(out).toMatch(/style="background:\s*url\('data:image\/png;base64,TEg='\)/);
    // Unreachable resource stays as it was (renderer deny list drops it).
    expect(out).toContain('src="https://maps.googleapis.com/unreachable.png"');
    expect(out).not.toContain('loading="lazy"');
    // Same URL fetched once even when referenced twice (style + inline attribute).
    const letterheadFetches = seen.filter((u) => u.endsWith("/case-study/ejadah-letterhead.png"));
    expect(letterheadFetches).toHaveLength(1);
    // Relative URLs resolved against <base>.
    expect(seen).toContain("http://localhost:3000/ejadah/fonts/Tajawal-Regular.woff2");
    expect(seen).toContain("http://localhost:3000/api/attachments/abc");
  });

  it("leaves a document without external references untouched apart from normalisation", async () => {
    const fetchDataUrl = vi.fn(async () => null);
    const out = await inlinePrintHtmlAssets(
      `<!DOCTYPE html><html><body><p>نص</p><img src="data:image/png;base64,AA=="/></body></html>`,
      { fetchDataUrl, parser: parse },
    );
    expect(fetchDataUrl).not.toHaveBeenCalled();
    expect(out).toContain("<p>نص</p>");
    expect(out).toContain('src="data:image/png;base64,AA=="');
  });
});

describe("makeDataUrlFetcher", () => {
  it("sends the bearer only to the API origin and encodes the body", async () => {
    const calls: Array<{ url: string; auth: string | undefined }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, auth: (init?.headers as Record<string, string> | undefined)?.Authorization });
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/png; charset=binary" },
        });
      }),
    );
    try {
      const load = makeDataUrlFetcher({ token: "tok", apiBase: "http://localhost:3000" });
      expect(await load("http://localhost:3000/api/attachments/x")).toBe("data:image/png;base64,AQID");
      expect(await load("http://localhost:3000/ejadah/fonts/a.woff2")).toBe("data:image/png;base64,AQID");
      expect(calls[0]?.auth).toBe("Bearer tok");
      expect(calls[1]?.auth).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns null on HTTP errors and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 403 })));
    try {
      expect(await makeDataUrlFetcher({})("http://localhost:3000/x.png")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    try {
      expect(await makeDataUrlFetcher({})("http://localhost:3000/x.png")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("print font faces", () => {
  it("declares Tajawal 400/500/700 with Arabic and Latin subsets relative to <base>", () => {
    expect(PRINT_FONT_FACE_CSS.match(/@font-face/g)).toHaveLength(6);
    for (const weight of [400, 500, 700]) {
      expect(PRINT_FONT_FACE_CSS).toContain(`font-weight:${weight}`);
    }
    expect(PRINT_FONT_FACE_CSS).toContain('url("ejadah/fonts/Tajawal-Regular.woff2")');
    expect(PRINT_FONT_FACE_CSS).toContain('url("ejadah/fonts/Tajawal-Bold-latin.woff2")');
    expect(PRINT_FONT_FACE_CSS).toContain("unicode-range:U+0600-06FF");
    expect(PRINT_FONT_FACE_CSS).not.toContain("fonts.googleapis.com");
  });

  it("base64 helper handles chunk boundaries", () => {
    const bytes = new Uint8Array(0x8000 + 5).map((_, i) => i % 251);
    const expected = Buffer.from(bytes).toString("base64");
    expect(bytesToBase64(bytes)).toBe(expected);
  });
});
