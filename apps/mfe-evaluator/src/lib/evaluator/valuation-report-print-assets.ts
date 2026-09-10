/**
 * Make the print HTML self-contained so a server-side renderer (Gotenberg/Chromium, no network)
 * produces the same page the browser prints: every http(s) image, CSS url() and web font becomes
 * a data URL, and the <base> that resolved them is dropped.
 */

export type InlinePrintAssetsOptions = {
  /** Resolves relative URLs; defaults to the document's <base href> or the page origin. */
  baseHref?: string;
  /** Bearer token for same-API resources such as `/api/attachments/{id}`. */
  token?: string | null;
  /** API origin whose URLs get the bearer header. Defaults to the page origin. */
  apiBase?: string | null;
  /** Test seam / custom loader. Return null to leave the reference untouched. */
  fetchDataUrl?: (absoluteUrl: string) => Promise<string | null>;
  /** Reserved for tests — jsdom cannot parse into a detached document otherwise. */
  parser?: (html: string) => Document;
};

const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

function isInlineAlready(url: string): boolean {
  const t = url.trim().toLowerCase();
  return t.startsWith("data:") || t.startsWith("blob:") || t.startsWith("#") || t.startsWith("about:");
}

function resolveUrl(raw: string, baseHref: string): string | null {
  try {
    return new URL(raw.trim(), baseHref).toString();
  } catch {
    return null;
  }
}

function defaultBaseHref(doc: Document, override?: string): string {
  if (override) return override;
  const base = doc.querySelector("base[href]")?.getAttribute("href")?.trim();
  if (base) return base;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  return "http://localhost/";
}

/** Browser loader: same-origin credentials, bearer only for the API origin. */
export function makeDataUrlFetcher(options: {
  token?: string | null;
  apiBase?: string | null;
}): (absoluteUrl: string) => Promise<string | null> {
  const apiBase = (options.apiBase ?? (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
  return async (absoluteUrl) => {
    try {
      const headers: Record<string, string> = {};
      const isApi = apiBase.length > 0 && absoluteUrl.startsWith(`${apiBase}/api/`);
      if (isApi && options.token) headers.Authorization = `Bearer ${options.token}`;
      const res = await fetch(absoluteUrl, { headers, credentials: "same-origin" });
      if (!res.ok) return null;
      const contentType = (res.headers.get("content-type") ?? "").split(";")[0]!.trim() || "application/octet-stream";
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!bytes.length) return null;
      return `data:${contentType};base64,${bytesToBase64(bytes)}`;
    } catch {
      return null;
    }
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Inline every external image / CSS url() / font of a print HTML document.
 * Unreachable resources are left as they are (the renderer's deny list then drops them).
 */
export async function inlinePrintHtmlAssets(
  html: string,
  options: InlinePrintAssetsOptions = {},
): Promise<string> {
  const parse =
    options.parser ?? ((source: string) => new DOMParser().parseFromString(source, "text/html"));
  const doc = parse(html);
  const baseHref = defaultBaseHref(doc, options.baseHref);
  const load =
    options.fetchDataUrl ?? makeDataUrlFetcher({ token: options.token, apiBase: options.apiBase });

  const cache = new Map<string, Promise<string | null>>();
  const toDataUrl = (raw: string): Promise<string | null> => {
    if (isInlineAlready(raw)) return Promise.resolve(null);
    const abs = resolveUrl(raw, baseHref);
    if (!abs || !/^https?:/i.test(abs)) return Promise.resolve(null);
    let pending = cache.get(abs);
    if (!pending) {
      pending = load(abs);
      cache.set(abs, pending);
    }
    return pending;
  };

  const jobs: Promise<void>[] = [];

  // <img src>, <image href> (inline SVG), <source srcset> are the media the report uses.
  doc.querySelectorAll<HTMLImageElement>("img[src]").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    jobs.push(
      toDataUrl(src).then((data) => {
        if (data) img.setAttribute("src", data);
      }),
    );
    img.removeAttribute("srcset");
    img.removeAttribute("loading");
  });

  const rewriteCss = async (css: string): Promise<string> => {
    const matches = [...css.matchAll(CSS_URL_RE)];
    if (!matches.length) return css;
    const replacements = await Promise.all(
      matches.map(async (m) => ({ full: m[0], data: await toDataUrl(m[2] ?? "") })),
    );
    let out = css;
    for (const r of replacements) {
      // Single quotes survive inside double-quoted style="" attributes without &quot; escaping.
      if (r.data) out = out.split(r.full).join(`url('${r.data}')`);
    }
    return out;
  };

  doc.querySelectorAll("style").forEach((style) => {
    const css = style.textContent ?? "";
    if (!css.includes("url(")) return;
    jobs.push(
      rewriteCss(css).then((next) => {
        if (next !== css) style.textContent = next;
      }),
    );
  });

  // Plain [style] + includes(): jsdom's selector engine does not match `[style*='url(']`.
  doc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const css = el.getAttribute("style") ?? "";
    if (!css.includes("url(")) return;
    jobs.push(
      rewriteCss(css).then((next) => {
        if (next !== css) el.setAttribute("style", next);
      }),
    );
  });

  await Promise.all(jobs);

  // External stylesheets and scripts have no place in a renderer without network access.
  doc.querySelectorAll("link[rel='stylesheet'], link[rel='preconnect'], link[rel='preload'], script").forEach((el) => {
    el.remove();
  });
  doc.querySelectorAll("base").forEach((el) => el.remove());

  const doctype = "<!DOCTYPE html>";
  return `${doctype}\n${doc.documentElement.outerHTML}`;
}

/**
 * Report typeface for print copies — the shell renders with Tajawal (next/font), so the
 * print tab and the server-rendered PDF embed the same face instead of falling back to
 * whatever the OS or the render container has installed. Paths are relative to <base href>.
 */
export const PRINT_FONT_FACE_CSS = [
  ["Tajawal-Regular", 400],
  ["Tajawal-Medium", 500],
  ["Tajawal-Bold", 700],
]
  .map(([file, weight]) => {
    const arabic =
      "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC";
    const latin =
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
    return (
      `@font-face{font-family:"Tajawal";font-style:normal;font-weight:${weight};font-display:swap;` +
      `src:url("ejadah/fonts/${file}.woff2") format("woff2");unicode-range:${arabic}}` +
      `@font-face{font-family:"Tajawal";font-style:normal;font-weight:${weight};font-display:swap;` +
      `src:url("ejadah/fonts/${file}-latin.woff2") format("woff2");unicode-range:${latin}}`
    );
  })
  .join("\n");
