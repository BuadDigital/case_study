import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { parseJson } from "./parse-json";

// Numbered documents register (numbering workshop): LT letters and
// CS case-study reports — allocate at print time and record in the register.
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
      headers: authHeaders(config.token),
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
