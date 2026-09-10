import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { parseJson } from "./parse-json";

/**
 * Report PDF links — the browser posts the print HTML it rendered (self-contained),
 * the valuation service turns it into a PDF and answers with a signed `.pdf?k=…` link
 * that opens in the browser's PDF viewer without a session.
 */

export type ValuationReportPdfApiConfig = {
  baseUrl?: string;
  token: string;
};

export type ValuationReportPdfLinkDto = {
  pdfId: string;
  valuationRequestId: string;
  reportNumber: string;
  fileName: string;
  /** Relative: `/api/valuation-reports/{fileName}?k={token}`. */
  url: string;
  expiresAtUtc: string;
  createdAtUtc: string;
  sizeBytes: number;
  sha256: string;
};

export type ValuationReportPdfError =
  | { ok: false; kind: "auth" }
  | { ok: false; kind: "forbidden" }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "invalid"; message: string }
  | { ok: false; kind: "renderer_unavailable"; message: string }
  | { ok: false; kind: "render_failed"; message: string }
  | { ok: false; kind: "too_large" }
  | { ok: false; kind: "server" }
  | { ok: false; kind: "network" };

export type ValuationReportPdfResult =
  | { ok: true; data: ValuationReportPdfLinkDto }
  | ValuationReportPdfError;

async function problemDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown; message?: unknown; title?: unknown };
    const text = [body.detail, body.message, body.title].find(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
    return text ?? "";
  } catch {
    return "";
  }
}

async function toResult(res: Response): Promise<ValuationReportPdfResult> {
  if (res.ok) return { ok: true, data: await parseJson<ValuationReportPdfLinkDto>(res) };
  if (res.status === 401) return { ok: false, kind: "auth" };
  if (res.status === 403) return { ok: false, kind: "forbidden" };
  if (res.status === 404) return { ok: false, kind: "not_found" };
  if (res.status === 413) return { ok: false, kind: "too_large" };
  if (res.status === 400) return { ok: false, kind: "invalid", message: await problemDetail(res) };
  if (res.status === 503) {
    return { ok: false, kind: "renderer_unavailable", message: await problemDetail(res) };
  }
  if (res.status === 502) return { ok: false, kind: "render_failed", message: await problemDetail(res) };
  return { ok: false, kind: "server" };
}

/** Render + store the report PDF; returns the signed link. */
export async function createValuationReportPdf(
  config: ValuationReportPdfApiConfig,
  valuationRequestId: string,
  input: { html: string; reportNumber?: string | null },
): Promise<ValuationReportPdfResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${encodeURIComponent(valuationRequestId)}/report-pdf`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({
          html: input.html,
          reportNumber: (input.reportNumber ?? "").trim() || null,
        }),
      },
    );
    return await toResult(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Signed link of the newest stored copy (404 → not_found when nothing was rendered yet). */
export async function getLatestValuationReportPdfLink(
  config: ValuationReportPdfApiConfig,
  valuationRequestId: string,
): Promise<ValuationReportPdfResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${encodeURIComponent(valuationRequestId)}/report-pdf`,
      { headers: { Accept: "application/json", Authorization: `Bearer ${config.token}` } },
    );
    return await toResult(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * Absolute, shareable form of the link. The API path is relative to the API origin
 * (same origin as the shell through the `/api` rewrite; the gateway host on LAN dev).
 */
export function valuationReportPdfAbsoluteUrl(
  link: Pick<ValuationReportPdfLinkDto, "url">,
  baseUrl?: string,
): string {
  const base = (baseUrl ?? getApiBase()).replace(/\/$/, "");
  const path = link.url.startsWith("/") ? link.url : `/${link.url}`;
  return `${base}${path}`;
}
