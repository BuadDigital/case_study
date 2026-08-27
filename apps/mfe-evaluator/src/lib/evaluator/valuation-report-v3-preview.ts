import {
  BRAND_IDENTITY_DEFAULTS,
  type OrganizationBrandingSettings,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import {
  applyValuationReportLiveFill,
  type ValuationReportLiveFill,
} from "./valuation-report-live-fill";

const V3_TEMPLATE_URL = "/ejadah/valuation-report-v3.html";

export function escHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ValuationReportV3Meta = {
  reportNo?: string;
  reportDate?: string;
  depositCode?: string;
  branding?: OrganizationBrandingSettings | null;
  valuers?: OrganizationValuerRosterEntry[] | null;
  live?: ValuationReportLiveFill | null;
};

function pageOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin || "";
}

function assetUrl(path: string, origin = ""): string {
  const t = path.trim();
  if (!t) return t;
  if (t.startsWith("data:") || t.startsWith("blob:") || /^https?:/i.test(t)) {
    return t;
  }
  const clean = t.replace(/["'\\)]/g, "");
  if (origin && clean.startsWith("/")) {
    return `${origin.replace(/\/$/, "")}${clean}`;
  }
  return clean;
}

function slashDate(iso: string | undefined): string {
  const t = (iso ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : t;
}

function applyMeta(dom: Document, meta: ValuationReportV3Meta) {
  const reportNo = (meta.reportNo ?? "").trim();
  const date = slashDate(meta.reportDate) || "—";
  const deposit = (meta.depositCode ?? "").trim() || "";
  // تُكتب الترويسة دائماً — «—» عند الفراغ حتى لا تتسرب أرقام العيّنة من القالب.
  const html = `رقم التقرير: ${escHtml(reportNo || "—")}<br>التاريخ: ${escHtml(date)}<br>رمز إيداع التقرير: ${escHtml(deposit)}`;
  dom.querySelectorAll(".pg-meta").forEach((el) => {
    el.innerHTML = html;
  });
}

/** ترقيم الصفحات من الواقع — القالب يثبّت «صفحة N من 20» يدوياً. */
function renumberPages(dom: Document) {
  const pages = [...dom.querySelectorAll("section.page.pg")];
  const total = pages.length;
  pages.forEach((page, i) => {
    const num = page.querySelector(".pg-num");
    if (num) num.textContent = `صفحة ${i + 1} من ${total}`;
  });
}

function replaceImageSlots(dom: Document) {
  dom.querySelectorAll("image-slot").forEach((slot) => {
    const div = dom.createElement("div");
    div.className = "image-ph";
    const id = slot.getAttribute("id");
    if (id) {
      div.id = id;
      div.setAttribute("data-slot-id", id);
    }
    const style = slot.getAttribute("style");
    if (style) div.setAttribute("style", style);
    div.textContent = slot.getAttribute("placeholder") || "";
    slot.replaceWith(div);
  });
}

function unwrapScIf(dom: Document) {
  dom.querySelectorAll("sc-if").forEach((el) => {
    const parent = el.parentNode;
    if (!parent) {
      el.remove();
      return;
    }
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
  });
}

function mm(value: number | null | undefined, fallback: number): number {
  return value != null && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function nameTokens(value: string): string[] {
  return normName(value)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .split(/\s+/)
    .map((t) => t.replace(/^ال/, ""))
    .filter((t) => t.length >= 2);
}

function namesMatch(a: string, b: string): boolean {
  const left = nameTokens(a);
  const right = nameTokens(b);
  if (!left.length || !right.length) return false;
  if (left.join(" ") === right.join(" ")) return true;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  return short.every((t) => long.includes(t));
}

function valueCellsAfterLabel(row: Element, label: string): Element[] {
  const cells = [...row.children];
  const out: Element[] = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (
      cell.classList.contains("k") &&
      normName(cell.textContent ?? "") === label
    ) {
      for (let j = i + 1; j < cells.length && cells[j].classList.contains("v"); j++) {
        out.push(cells[j]);
      }
      break;
    }
  }
  return out;
}

function fillCellImage(
  cell: Element,
  src: string,
  alt: string,
  widthCm?: number,
  heightCm?: number,
) {
  const img = cell.ownerDocument.createElement("img");
  img.src = src;
  img.alt = alt;
  img.classList.add("org-signature");
  img.style.objectFit = "contain";
  img.style.maxWidth = "100%";
  if (widthCm && heightCm) {
    img.style.width = `${widthCm}cm`;
    img.style.height = `${heightCm}cm`;
  } else {
    img.style.height = "40px";
  }
  cell.replaceChildren(img);
}

/** Missing prototype asset — never paint it (shows as a broken image icon). */
function isUsableSignatureUrl(url: string | null | undefined): boolean {
  const t = (url ?? "").trim();
  if (!t) return false;
  return !t.endsWith("ejadah-signature.png");
}

function resolveSignatureUrl(raw: string | null | undefined, origin = ""): string {
  const t = (raw ?? "").trim();
  if (!isUsableSignatureUrl(t)) return "";
  return assetUrl(t, origin);
}

function applySignatures(
  dom: Document,
  branding: OrganizationBrandingSettings,
  valuers: OrganizationValuerRosterEntry[],
  origin = "",
) {
  const roster = valuers.filter((v) => v.isActive !== false);
  const brandSig = resolveSignatureUrl(branding.signatureUrl, origin);
  const certified = roster.find((v) => v.role === "certified");
  const fallbackSig =
    resolveSignatureUrl(certified?.signatureUrl, origin) || brandSig;
  const sigW = mm(
    branding.signatureWidthCm,
    BRAND_IDENTITY_DEFAULTS.signatureWidthCm!,
  );
  const sigH = mm(
    branding.signatureHeightCm,
    BRAND_IDENTITY_DEFAULTS.signatureHeightCm!,
  );

  const findSig = (name: string): string | null => {
    const n = normName(name);
    if (!n) return null;
    const hit = roster.find(
      (v) =>
        isUsableSignatureUrl(v.signatureUrl) && namesMatch(v.nameAr, n),
    );
    return resolveSignatureUrl(hit?.signatureUrl, origin) || null;
  };

  const paint = (cell: Element, url: string) =>
    fillCellImage(cell, url, "التوقيع", sigW, sigH);

  for (const table of dom.querySelectorAll("table")) {
    const rows = [...table.querySelectorAll("tr")];
    const nameRow = rows.find((r) =>
      [...r.querySelectorAll("td.k")].some(
        (td) => normName(td.textContent ?? "") === "الاسم",
      ),
    );
    const sigRow = rows.find((r) =>
      [...r.querySelectorAll("td.k")].some(
        (td) => normName(td.textContent ?? "") === "التوقيع",
      ),
    );
    if (!nameRow || !sigRow) continue;
    const names = valueCellsAfterLabel(nameRow, "الاسم");
    const sigCells = valueCellsAfterLabel(sigRow, "التوقيع");
    names.forEach((nameCell, i) => {
      const cell = sigCells[i];
      if (!cell) return;
      const url = findSig(nameCell.textContent ?? "");
      if (url) paint(cell, url);
    });
  }

  const approve = [...dom.querySelectorAll("h2")].find((h) =>
    (h.textContent ?? "").includes("إعتماد"),
  );
  const approveTable = approve?.nextElementSibling;
  if (approveTable?.tagName === "TABLE") {
    const rows = [...approveTable.querySelectorAll("tr")];
    const nameRow = rows.find((r) =>
      [...r.querySelectorAll("td.k")].some(
        (td) => normName(td.textContent ?? "") === "الاسم",
      ),
    );
    const sigRow = rows.find((r) =>
      [...r.querySelectorAll("td.k")].some(
        (td) => normName(td.textContent ?? "") === "التوقيع",
      ),
    );
    const cell = valueCellsAfterLabel(sigRow ?? approveTable, "التوقيع")[0];
    if (cell) {
      const existing = cell.querySelector("img");
      const existingSrc = existing?.getAttribute("src") ?? "";
      if (!existing || !isUsableSignatureUrl(existingSrc)) {
        const byName = nameRow
          ? findSig(
              valueCellsAfterLabel(nameRow, "الاسم")[0]?.textContent ?? "",
            )
          : null;
        const src = byName || fallbackSig;
        if (src) paint(cell, src);
        else cell.replaceChildren();
      } else if (existing instanceof HTMLImageElement) {
        existing.classList.add("org-signature");
        existing.style.width = `${sigW}cm`;
        existing.style.height = `${sigH}cm`;
        existing.style.maxWidth = "100%";
        existing.style.objectFit = "contain";
      }
    }
  }
}

function stampBoxCss(prefix: string, widthCm: number, heightCm: number): string {
  return (
    `${prefix} img.org-stamp,${prefix} img[alt="ختم المنشأة"]{` +
    `width:${widthCm}cm!important;height:${heightCm}cm!important;` +
    `max-width:none!important;max-height:none!important;object-fit:contain}` +
    `${prefix} tr:has(img.org-stamp) td.v{height:auto!important;min-height:${heightCm}cm}`
  );
}

function signatureBoxCss(prefix: string, widthCm: number, heightCm: number): string {
  return (
    `${prefix} img.org-signature,${prefix} img[alt="التوقيع"]{` +
    `width:${widthCm}cm!important;height:${heightCm}cm!important;` +
    `max-width:100%!important;max-height:none!important;object-fit:contain}` +
    `${prefix} tr:has(img.org-signature) td.v{height:auto!important;min-height:${heightCm}cm}`
  );
}

function applyStampAndSignatures(
  dom: Document,
  branding: OrganizationBrandingSettings,
  valuers: OrganizationValuerRosterEntry[],
  origin = "",
) {
  const stamp = assetUrl(
    (branding.stampUrl ?? "").trim() || BRAND_IDENTITY_DEFAULTS.stampUrl,
    origin,
  );
  const stampW = mm(branding.stampWidthCm, BRAND_IDENTITY_DEFAULTS.stampWidthCm!);
  const stampH = mm(branding.stampHeightCm, BRAND_IDENTITY_DEFAULTS.stampHeightCm!);

  applySignatures(dom, branding, valuers, origin);

  let stampImg = [...dom.querySelectorAll("img")].find((img) =>
    /ختم|stamp/i.test(`${img.getAttribute("alt") ?? ""} ${img.getAttribute("src") ?? ""}`),
  );
  if (!stampImg) {
    const cell = [...dom.querySelectorAll("td.k")].find(
      (td) => normName(td.textContent ?? "") === "ختم المنشأة",
    )?.nextElementSibling;
    if (cell) {
      stampImg = dom.createElement("img");
      stampImg.alt = "ختم المنشأة";
      cell.replaceChildren(stampImg);
    }
  }
  if (stampImg) {
    stampImg.classList.add("org-stamp");
    stampImg.alt = "ختم المنشأة";
    stampImg.setAttribute("src", stamp);
    stampImg.style.setProperty("width", `${stampW}cm`, "important");
    stampImg.style.setProperty("height", `${stampH}cm`, "important");
    stampImg.style.setProperty("max-width", "none", "important");
    stampImg.style.setProperty("max-height", "none", "important");
    stampImg.style.objectFit = "contain";
    const cell = stampImg.closest("td");
    if (cell instanceof HTMLElement) {
      const row = cell.parentElement;
      row?.querySelectorAll("td.v").forEach((td) => {
        if (!(td instanceof HTMLElement)) return;
        td.style.height = "auto";
        td.style.minHeight = `${stampH}cm`;
      });
    }
  }
}

function applyBrandIdentity(
  dom: Document,
  branding: OrganizationBrandingSettings,
  valuers: OrganizationValuerRosterEntry[],
  origin = "",
): string {
  const letterhead = assetUrl(
    (branding.letterheadUrl ?? "").trim() ||
      BRAND_IDENTITY_DEFAULTS.letterheadUrl ||
      "/case-study/ejadah-letterhead.png",
    origin,
  );
  const head = mm(branding.letterheadHeadMm, BRAND_IDENTITY_DEFAULTS.letterheadHeadMm!);
  const footTop = mm(
    branding.letterheadFootTopMm,
    BRAND_IDENTITY_DEFAULTS.letterheadFootTopMm!,
  );
  const footH = Math.max(0, 297 - footTop);
  const padStart = mm(
    branding.letterheadPadStartMm,
    BRAND_IDENTITY_DEFAULTS.letterheadPadStartMm!,
  );
  const padEnd = mm(branding.letterheadPadMm, BRAND_IDENTITY_DEFAULTS.letterheadPadMm!);

  applyStampAndSignatures(dom, branding, valuers, origin);

  dom.querySelectorAll<HTMLElement>("section.page.pg").forEach((sheet) => {
    for (const cls of ["lh-head", "lh-foot", "lh-start", "lh-end"]) {
      const slice = dom.createElement("div");
      slice.className = `lh-slice ${cls}`;
      sheet.insertBefore(slice, sheet.firstChild);
    }
  });

  /* هوامش الهوية البصرية: أعلى / أسفل / يمين (padStart) / يسار (pad). */
  return (
    `.page.pg{position:relative;background:#fff!important;` +
    `padding:${head}mm ${padStart}mm ${footH}mm ${padEnd}mm!important;` +
    `box-sizing:border-box}` +
    `.lh-slice{position:absolute;pointer-events:none;z-index:0;background-image:url("${letterhead}")}` +
    `.lh-head{top:0;left:0;right:0;height:${head}mm;background-size:210mm 297mm;background-position:top center;background-repeat:no-repeat}` +
    `.lh-foot{bottom:0;left:0;right:0;height:${footH}mm;background-size:210mm 297mm;background-position:bottom center;background-repeat:no-repeat}` +
    `.lh-start{top:${head}mm;bottom:${footH}mm;inset-inline-start:0;width:${padStart}mm;background-size:210mm 297mm;background-position:top right;background-repeat:no-repeat}` +
    `.lh-end{top:${head}mm;bottom:${footH}mm;inset-inline-end:0;width:${padEnd}mm;background-size:210mm 297mm;background-position:top left;background-repeat:no-repeat}` +
    `.page.pg > *:not(.lh-slice):not(.pg-num):not(.pg-meta){position:relative;z-index:1}` +
    `.val-rpt-v3 .pg-meta{position:absolute;top:8mm;inset-inline-start:${Math.max(6, padStart + 4)}mm;inset-inline-end:auto;right:auto;z-index:2}` +
    `.val-rpt-v3 .pg-num{position:absolute!important;top:calc(${footTop}mm + 1px)!important;bottom:auto!important;left:auto!important;right:auto!important;inset-inline-start:${padStart}mm!important;inset-inline-end:auto!important;z-index:2;text-align:start;transform:translateX(-4px)}` +
    stampBoxCss(".val-rpt-v3", mm(branding.stampWidthCm, BRAND_IDENTITY_DEFAULTS.stampWidthCm!), mm(branding.stampHeightCm, BRAND_IDENTITY_DEFAULTS.stampHeightCm!)) +
    signatureBoxCss(
      ".val-rpt-v3",
      mm(branding.signatureWidthCm, BRAND_IDENTITY_DEFAULTS.signatureWidthCm!),
      mm(branding.signatureHeightCm, BRAND_IDENTITY_DEFAULTS.signatureHeightCm!),
    )
  );
}

export type ValuationReportV3Mode = "screen" | "print";

const TOKEN_ROOT = `:root{--ink:#102b4e;--gold:#a4906f;--gold-d:#8c7857;--bg:#f5f3ee;--surface:#fff;--surface-2:#faf8f3;--border:#ece8df;--border-md:#ddd8cc;--text-1:#3a3f4d;--heading:#102b4e}`;

const PRINT_CHROME = `
${TOKEN_ROOT}
html,body{margin:0;direction:rtl}
.val-rpt-v3{
  background:var(--bg);
  padding:20px 8px 28px;
  direction:rtl;
  color:#15150f;
  font-family:"IBM Plex Sans Arabic","IBM Plex Sans",Tajawal,system-ui,sans-serif;
}
.val-rpt-v3 .page.pg{
  width:210mm;height:297mm;overflow:hidden;margin:0 auto 16px;
  box-shadow:0 2px 10px rgba(0,0,0,.25);border-radius:7px;box-sizing:border-box;
  print-color-adjust:exact;-webkit-print-color-adjust:exact;
}
.val-rpt-v3 .image-ph{
  display:grid;place-items:center;border:1px dashed var(--border-md);background:var(--surface-2);
  color:#6b6b66;font-size:11px;text-align:center;box-sizing:border-box;
}
@page{size:A4;margin:0}
@media print{
  html,body{margin:0;padding:0;background:#fff}
  .val-rpt-v3{background:#fff;padding:0}
  .val-rpt-v3 .page.pg{box-shadow:none;border-radius:0;margin:0;page-break-after:always}
}
`;

const SCREEN_CHROME = `
.val-rpt-screen{
  direction:rtl;
  color:var(--text-1,#3a3f4d);
  font-size:13px;
}
.val-rpt-screen .pg-meta,
.val-rpt-screen .pg-num,
.val-rpt-screen .lh-slice{display:none!important}
.val-rpt-screen .page.pg{
  width:100%;
  height:auto!important;
  min-height:0;
  overflow:visible;
  margin:0 0 16px;
  padding:22px 24px;
  background:var(--surface,#fff)!important;
  border:1px solid var(--border,#ece8df);
  border-radius:10px;
  box-shadow:none;
  box-sizing:border-box;
}
.val-rpt-screen .image-ph{
  display:grid;place-items:center;border:1px dashed var(--border-md,#ddd8cc);background:var(--surface-2,#faf8f3);
  color:#6b6b66;font-size:11px;text-align:center;box-sizing:border-box;
}
.val-rpt-screen img[alt="التوقيع"]{object-fit:contain;max-width:100%}
`;

function scopeCss(css: string, scope: string): string {
  const stripped = css
    .replace(/doc-page:not\(:defined\)\s*\{[^}]*\}/g, "")
    .replace(/(?:html\s*,\s*)?body\s*\{[^}]*\}/g, "")
    .replace(/doc-page/g, scope);

  return stripped.replace(/([^{}@]+)\{/g, (full, selectors: string) => {
    const trimmed = selectors.trim();
    if (!trimmed || trimmed.startsWith("@")) return full;
    const scoped = trimmed
      .split(",")
      .map((part) => {
        const sel = part.trim();
        if (!sel || sel.startsWith(scope) || sel.startsWith("@")) return sel;
        return `${scope} ${sel}`;
      })
      .join(",");
    return `${scoped}{`;
  });
}

function parseTemplate(raw: string) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(raw, "text/html");
  const authored = [...dom.querySelectorAll("style")]
    .map((s) => s.textContent ?? "")
    .join("\n")
    .replace(/url\(['"]?assets\/ejadah-letterhead\.png['"]?\)/g, "none")
    .replace(/assets\/ejadah-stamp\.png/g, BRAND_IDENTITY_DEFAULTS.stampUrl);
  replaceImageSlots(dom);
  unwrapScIf(dom);
  dom.querySelectorAll("img").forEach((img) => {
    const src = (img.getAttribute("src") ?? "").trim();
    if (!src || src.startsWith("/") || /^https?:/i.test(src) || src.startsWith("data:")) {
      return;
    }
    if (/stamp/i.test(src) || /ختم/.test(img.getAttribute("alt") ?? "")) {
      img.setAttribute("src", BRAND_IDENTITY_DEFAULTS.stampUrl);
      return;
    }
    if (/letterhead/i.test(src)) {
      img.setAttribute(
        "src",
        BRAND_IDENTITY_DEFAULTS.letterheadUrl ?? "/case-study/ejadah-letterhead.png",
      );
    }
  });
  return { dom, authored };
}

export function prepareValuationReportV3Html(
  raw: string,
  meta: ValuationReportV3Meta = {},
  mode: ValuationReportV3Mode = "print",
): string {
  const { dom, authored } = parseTemplate(raw);
  applyMeta(dom, meta);
  if (meta.live) {
    applyValuationReportLiveFill(dom, meta.live, {
      valuers: meta.valuers,
    });
  }
  renumberPages(dom);
  const branding = meta.branding ?? BRAND_IDENTITY_DEFAULTS;
  const valuers = meta.valuers ?? [];

  const origin = pageOrigin();

  if (mode === "screen") {
    applyStampAndSignatures(dom, branding, valuers, origin);
    const stampW = mm(branding.stampWidthCm, BRAND_IDENTITY_DEFAULTS.stampWidthCm!);
    const stampH = mm(branding.stampHeightCm, BRAND_IDENTITY_DEFAULTS.stampHeightCm!);
    const sigW = mm(
      branding.signatureWidthCm,
      BRAND_IDENTITY_DEFAULTS.signatureWidthCm!,
    );
    const sigH = mm(
      branding.signatureHeightCm,
      BRAND_IDENTITY_DEFAULTS.signatureHeightCm!,
    );
    const screenCss = scopeCss(authored, ".val-rpt-screen");
    const pages = [...dom.querySelectorAll("section.page.pg")]
      .map((p) => p.outerHTML)
      .join("\n");
    return `<style>${screenCss}\n${SCREEN_CHROME}\n${stampBoxCss(".val-rpt-screen", stampW, stampH)}\n${signatureBoxCss(".val-rpt-screen", sigW, sigH)}</style><div class="val-rpt-screen" dir="rtl">${pages}</div>`;
  }

  const brandCss = applyBrandIdentity(dom, branding, valuers, origin);
  const printCss = authored.replace(/doc-page/g, ".val-rpt-v3");
  const pages = [...dom.querySelectorAll("section.page.pg")]
    .map((p) => p.outerHTML)
    .join("\n");
  const base = origin ? `<base href="${escHtml(`${origin.replace(/\/$/, "")}/`)}"/>` : "";

  // No fonts.googleapis.com — LAN/HTTP print tabs often hang Chrome's
  // "Loading preview…" waiting on blocked or slow webfonts.
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
${base}
<title>تقرير التقييم</title>
<style>${printCss}\n${brandCss}\n${PRINT_CHROME}</style></head>
<body class="val-rpt-v3">${pages}</body></html>`;
}

export async function fetchValuationReportV3Html(
  meta: ValuationReportV3Meta = {},
  mode: ValuationReportV3Mode = "print",
): Promise<string> {
  const res = await fetch(V3_TEMPLATE_URL, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`تعذّر تحميل نموذج تقرير التقييم (${res.status})`);
  }
  return prepareValuationReportV3Html(await res.text(), meta, mode);
}
