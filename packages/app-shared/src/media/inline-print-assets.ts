/**
 * Make the print HTML self-contained so a server-side renderer (Gotenberg/Chromium, no network)
 * produces the same page the browser prints: every http(s) image, CSS url() and web font becomes
 * a data URL, and the <base> that resolved them is dropped.
 *
 * Shared by the valuation report (evaluator app) and the case-study report PDF (case-study app).
 */

type InlinePrintAssetsOptions = {
  /** Resolves relative URLs; defaults to the document's <base href> or the page origin. */
  baseHref?: string;
  /** Bearer token for same-API resources such as `/api/attachments/{id}`. */
  token?: string | null;
  /** API origin whose URLs get the bearer header. Defaults to the page origin. */
  apiBase?: string | null;
  /** Test seam / custom loader. Return null to leave the reference untouched. */
  fetchDataUrl?: (absoluteUrl: string) => Promise<string | null>;
  /**
   * Also embed external stylesheets (`<link rel="stylesheet">`, e.g. the Google Fonts sheet of the
   * official letters) as `<style>` with their fonts inlined. Off by default: without it such links are
   * simply dropped, which is what the valuation report has always done.
   */
  inlineStylesheets?: boolean;
  /** Test seam for stylesheet text; return null to drop the link. */
  fetchText?: (absoluteUrl: string) => Promise<string | null>;
  /** Reserved for tests — jsdom cannot parse into a detached document otherwise. */
  parser?: (html: string) => Document;
  /** Called as each image / stylesheet / inline style finishes — the caller shows «n / m». */
  onProgress?: (done: number, total: number) => void;
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

/** Stylesheet text loader (no credentials — the sheets are public, e.g. Google Fonts). Null on any failure. */
async function fetchStylesheetText(absoluteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(absoluteUrl);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
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
 *
 * How it works: parses the page, turns each `<img src>`, each `url()` in `<style>` and `[style]` into a data
 * URL (one download per distinct address), optionally replaces each external stylesheet with a `<style>` whose
 * own `url()`s are resolved against the stylesheet's address and inlined, then removes the remaining external
 * links, external scripts and `<base>`.
 *
 * Edge cases: inline scripts stay — a report's own paging script lays the sheets out and sets its ready flag,
 * which the renderer waits for. A stylesheet that cannot be read is dropped (the page falls back to the next
 * font in its list) rather than left as a link the renderer would try, and fail, to load.
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
  const loadText = options.fetchText ?? fetchStylesheetText;

  const cache = new Map<string, Promise<string | null>>();
  const toDataUrl = (raw: string, relativeTo: string = baseHref): Promise<string | null> => {
    if (isInlineAlready(raw)) return Promise.resolve(null);
    const abs = resolveUrl(raw, relativeTo);
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

  const rewriteCss = async (css: string, relativeTo: string = baseHref): Promise<string> => {
    const matches = [...css.matchAll(CSS_URL_RE)];
    if (!matches.length) return css;
    const replacements = await Promise.all(
      matches.map(async (m) => ({ full: m[0], data: await toDataUrl(m[2] ?? "", relativeTo) })),
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

  if (options.inlineStylesheets) {
    doc.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet'][href]").forEach((link) => {
      const sheetUrl = resolveUrl(link.getAttribute("href") ?? "", baseHref);
      if (!sheetUrl || !/^https?:/i.test(sheetUrl)) return;
      jobs.push(
        loadText(sheetUrl)
          .then((css) => (css == null ? null : rewriteCss(css, sheetUrl)))
          .then((css) => {
            if (css == null) return;
            const style = doc.createElement("style");
            style.textContent = css;
            link.replaceWith(style);
          }),
      );
    });
  }

  if (options.onProgress) {
    const total = jobs.length;
    let done = 0;
    options.onProgress(0, total);
    await Promise.all(
      jobs.map((job) =>
        job.finally(() => {
          done += 1;
          options.onProgress?.(done, total);
        }),
      ),
    );
  } else {
    await Promise.all(jobs);
  }

  // External stylesheets and scripts have no place in a renderer without network access. Inline scripts stay:
  // the print flow's own pagination script lays the sheets out and sets `data-rpt-ready`, which the renderer waits for.
  doc.querySelectorAll("link[rel='stylesheet'], link[rel='preconnect'], link[rel='preload'], script[src]").forEach((el) => {
    el.remove();
  });
  doc.querySelectorAll("base").forEach((el) => el.remove());

  const doctype = "<!DOCTYPE html>";
  return `${doctype}\n${doc.documentElement.outerHTML}`;
}
