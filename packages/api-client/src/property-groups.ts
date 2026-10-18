import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";

/** Decision 20 — grouped-property linking (compound property). */
export type PropertyGroupMemberDto = {
  propertyId: string;
  poNumber: string;
  deedNumber: string;
  deedKind?: string | null;
  linkedByUserId: string;
  linkedAtUtc: string;
  signalLabelsAr: string[];
};

/**
 * What a link just copied between the two deeds (decision 2026-10-15: once, into empty slots
 * only, both ways). "Subject" is the deed the link was confirmed from.
 */
export type PropertyGroupLinkSyncDto = {
  subjectFieldsFilled: string[];
  targetFieldsFilled: string[];
  contactsCopiedToSubject: boolean;
  contactsCopiedToTarget: boolean;
  inspectorSlotsFilledOnSubject: number;
  inspectorSlotsFilledOnTarget: number;
};

export type PropertyGroupDto = {
  id: string;
  name?: string | null;
  createdAtUtc: string;
  members: PropertyGroupMemberDto[];
  /** Present on the reply to a link confirmation only. */
  linkSync?: PropertyGroupLinkSyncDto | null;
};

/** Stored names of the documents the screen copied onto a linked deed. */
export type FillPropertyGroupDocumentNamesRequest = {
  assignmentDocFileNames: string[];
  delegationLetterFileNames: string[];
  otherDocumentFileNames: string[];
  realEstateRegFileName: string;
  deedOwnershipFileName: string;
  bourseDeedImageFileName: string;
  boundariesExternalDocName: string;
};

export type PropertyGroupSuggestionDto = {
  propertyId: string;
  poNumber: string;
  deedNumber: string;
  ownerName?: string | null;
  planNumber?: string | null;
  plotNumber?: string | null;
  signalCodes: string[];
  signalLabelsAr: string[];
  existingGroupId?: string | null;
};

export type PropertyGroupsApiConfig = {
  baseUrl?: string;
  token: string;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "auth" | "network" | "server"; message?: string };

async function request<T>(
  config: PropertyGroupsApiConfig,
  path: string,
  init?: RequestInit,
): Promise<Result<T>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: authHeaders(config.token, { accept: true }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) {
      let message: string | undefined;
      try {
        message = ((await res.json()) as { error?: string }).error;
      } catch {
        message = undefined;
      }
      return { ok: false, kind: "server", message };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export function getPropertyGroup(
  config: PropertyGroupsApiConfig,
  propertyId: string,
): Promise<Result<PropertyGroupDto | null>> {
  return request(config, `/api/property-groups/by-property/${propertyId}`);
}

export function suggestPropertyGroupLinks(
  config: PropertyGroupsApiConfig,
  propertyId: string,
): Promise<Result<PropertyGroupSuggestionDto[]>> {
  return request(config, `/api/property-groups/by-property/${propertyId}/suggestions`);
}

export function confirmPropertyGroupLink(
  config: PropertyGroupsApiConfig,
  propertyId: string,
  targetPropertyId: string,
): Promise<Result<PropertyGroupDto>> {
  return request(config, `/api/property-groups/by-property/${propertyId}/link`, {
    method: "POST",
    body: JSON.stringify({ targetPropertyId }),
  });
}

/** What the sibling deed's inspection gave this deed's inspection draft. */
export type InspectionPrefillResultDto = {
  prefilled: boolean;
  slotsFilled: number;
  photosLinked: number;
  sourceTaskId?: string | null;
  reason?: string | null;
};

/**
 * First open of a grouped deed's inspection: start it from the sibling deed's inspection
 * (site inputs + photos, copied and editable). Harmless when there is nothing to copy.
 */
export function prefillInspectionFromGroup(
  config: PropertyGroupsApiConfig,
  taskId: string,
): Promise<Result<InspectionPrefillResultDto>> {
  return request(config, `/api/property-groups/prefill-inspection/${taskId}`, { method: "POST" });
}

/** Records copied documents' names on a deed — empty name slots only; returns the slots filled. */
export function fillPropertyGroupDocumentNames(
  config: PropertyGroupsApiConfig,
  propertyId: string,
  names: FillPropertyGroupDocumentNamesRequest,
): Promise<Result<{ filled: string[] }>> {
  return request(config, `/api/property-groups/by-property/${propertyId}/document-names`, {
    method: "POST",
    body: JSON.stringify(names),
  });
}

export function unlinkPropertyGroup(
  config: PropertyGroupsApiConfig,
  propertyId: string,
  reason: string,
): Promise<Result<PropertyGroupDto>> {
  return request(config, `/api/property-groups/by-property/${propertyId}/unlink`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
