import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { readProblemMessage } from "./parse-json";

export type PrintPdfApiConfig = { token: string; baseUrl?: string };

export type PrintPdfResult =
  | { ok: true; data: Blob }
  | { ok: false; kind: "auth" | "forbidden" | "network" | "server"; message?: string };

/**
 * Turns a self-contained print page (images, styles and fonts embedded as data URLs) into a PDF.
 *
 * How it works: POSTs `{ html }` to `/api/print-pdf`, where the server prints it on A4 with the same
 * renderer as the final valuation report, and returns the PDF bytes. Nothing is stored on the server.
 *
 * Edge cases: a refusal keeps the server's Arabic reason (`message`) — the renderer being down answers 503
 * «خدمة إنشاء ملفات PDF غير متاحة حالياً»; 401/403 map to `auth` / `forbidden` like the other clients.
 */
export async function renderPrintPdf(config: PrintPdfApiConfig, html: string): Promise<PrintPdfResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/print-pdf`, {
      method: "POST",
      headers: authHeaders(config.token),
      body: JSON.stringify({ html }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server", message: await readProblemMessage(res) };
    return { ok: true, data: await res.blob() };
  } catch {
    return { ok: false, kind: "network" };
  }
}
