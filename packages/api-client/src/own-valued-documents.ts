import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { parseJson } from "./parse-json";
import type { PrototypeModulesApiConfig } from "./prototype-modules";

/**
 * What the uploader of a «مستند ذو قيمة» sees of it: the name it gave, its file type and the case
 * specialist's decision. The file opens through the normal attachment download.
 */
export type OwnValuedDocumentDto = {
  id: string;
  name: string;
  fileName: string;
  contentType: string;
  /** pending | approved | rejected */
  status: string;
  reviewNote?: string | null;
  createdAtUtc: string;
};

/** The caller's own valued documents of one property (`scopeKey` = «PO:propertyId»). */
export async function listOwnValuedDocuments(
  config: PrototypeModulesApiConfig,
  scopeKey: string,
): Promise<OwnValuedDocumentDto[]> {
  const base = config.baseUrl ?? getApiBase();
  const qs = new URLSearchParams({ scopeKey });
  try {
    const res = await fetch(`${base}/api/attachments/own-valued-documents?${qs}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!res.ok) return [];
    const data = await parseJson<OwnValuedDocumentDto[]>(res);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
