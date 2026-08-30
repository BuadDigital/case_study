import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { parseJson } from "./parse-json";

// سجل المستندات المرقّمة (قرار 25 + ورشة الترقيم): الخطابات LT وتقارير
// دراسة الحالة CS — التخصيص لحظة الطباعة والقيد في السجل.
export type NumberedDocumentKind = "letter" | "case-study-report";

export type NumberedDocumentDto = {
  id: string;
  kind: NumberedDocumentKind;
  referenceNumber: string;
  poNumber: string;
  propertyId?: string | null;
  title: string;
  createdAtUtc: string;
};

export type NumberedDocumentsApiConfig = {
  token: string;
  baseUrl?: string;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "auth" | "network" | "server"; message?: string };

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function allocateNumberedDocument(
  config: NumberedDocumentsApiConfig,
  input: {
    kind: NumberedDocumentKind;
    poNumber?: string;
    propertyId?: string;
    title?: string;
  },
): Promise<Result<NumberedDocumentDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/numbered-documents`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(input),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<NumberedDocumentDto>(res);
    return { ok: true, data };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listNumberedDocuments(
  config: NumberedDocumentsApiConfig,
  input?: { kind?: NumberedDocumentKind; poNumber?: string },
): Promise<Result<NumberedDocumentDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  const qs = new URLSearchParams();
  if (input?.kind) qs.set("kind", input.kind);
  if (input?.poNumber) qs.set("poNumber", input.poNumber);
  try {
    const res = await fetch(
      `${base}/api/numbered-documents${qs.size > 0 ? `?${qs}` : ""}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<NumberedDocumentDto[]>(res);
    return { ok: true, data };
  } catch {
    return { ok: false, kind: "network" };
  }
}
