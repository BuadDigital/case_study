import { getApiBase } from "./index";
import { repositoryFetch as fetch } from "./write-repository";

export type AttachmentPrintTypeDto = {
  id: string;
  key: string;
  labelAr: string;
  propertyTypeKeys: string[];
  isRequired: boolean;
  isSystemDefault: boolean;
  sortOrder: number;
  isActive: boolean;
};

export type AttachmentPrintDictionaryDto = {
  types: AttachmentPrintTypeDto[];
  updatedAtUtc: string;
};

export type AttachmentPrintDictionaryApiConfig = {
  baseUrl?: string;
  token: string;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "auth" | "network" | "server"; message?: string };

function headers(token: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function getAttachmentPrintDictionary(
  config: AttachmentPrintDictionaryApiConfig,
): Promise<Result<AttachmentPrintDictionaryDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/attachment-print-dictionary`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<AttachmentPrintDictionaryDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveAttachmentPrintDictionary(
  config: AttachmentPrintDictionaryApiConfig,
  body: { types: AttachmentPrintTypeDto[] },
): Promise<Result<AttachmentPrintDictionaryDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/attachment-print-dictionary`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<AttachmentPrintDictionaryDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
