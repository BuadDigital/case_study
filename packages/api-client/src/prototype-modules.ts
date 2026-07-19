import { getApiBase } from "./index";

export type PrototypeModulesApiConfig = {
  baseUrl?: string;
  token: string;
};

export type PrototypeModulesResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "auth" | "forbidden" | "network" | "server" | "not_found" | "validation";
      message?: string;
    };

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

// --- Field dictionary ---

export type FieldDictionaryAssignmentDto = {
  role: string;
  screens: string[];
  mode: string;
  required: boolean;
  final: boolean;
};

export type FieldDictionaryFieldDto = {
  id: string;
  ref: string;
  key: string;
  name: string;
  type: string;
  tags: string[];
  source?: string | null;
  parent?: string | null;
  child?: string | null;
  persisted: boolean;
  assignments: FieldDictionaryAssignmentDto[];
};

export type FieldDictionaryStateDto = {
  fields: FieldDictionaryFieldDto[];
  tags: string[];
  updatedAtUtc: string;
};

export async function getFieldDictionary(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<FieldDictionaryStateDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/field-dictionary`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<FieldDictionaryStateDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveFieldDictionary(
  config: PrototypeModulesApiConfig,
  body: Pick<FieldDictionaryStateDto, "fields" | "tags">,
): Promise<PrototypeModulesResult<FieldDictionaryStateDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/field-dictionary`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<FieldDictionaryStateDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

// --- Failure types catalog ---

export type FailureTypeCategoryDto = {
  id: string;
  label: string;
  order: number;
};

export type FailureProblemTypeDto = {
  id: string;
  categoryId: string;
  label: string;
  description?: string | null;
  order: number;
};

export type FailureTypesCatalogDto = {
  categories: FailureTypeCategoryDto[];
  problemTypes: FailureProblemTypeDto[];
  updatedAtUtc: string;
};

export async function getFailureTypesCatalog(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<FailureTypesCatalogDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/failure-types-catalog`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<FailureTypesCatalogDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveFailureTypesCatalog(
  config: PrototypeModulesApiConfig,
  body: Pick<FailureTypesCatalogDto, "categories" | "problemTypes">,
): Promise<PrototypeModulesResult<FailureTypesCatalogDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/failure-types-catalog`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<FailureTypesCatalogDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

// --- Survey offices ---

export type SurveyOfficeDto = {
  id: string;
  name: string;
  active: number;
  doneMonth: number;
  avgDays: string;
  contract: string;
  statusBusy: boolean;
  sortOrder: number;
};

export type SaveSurveyOfficeRequest = {
  name: string;
  active: number;
  doneMonth: number;
  avgDays: string;
  contract: string;
  statusBusy: boolean;
  sortOrder?: number;
};

export async function listSurveyOffices(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<SurveyOfficeDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/survey-offices`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<SurveyOfficeDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

// --- Valuation requests ---

export type ValuationRequestDto = {
  id: string;
  displayId: string;
  propId: string;
  area: string;
  type: string;
  appraiser: string;
  status: string;
  date: string;
};

export async function listValuationRequests(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<ValuationRequestDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/valuation-requests`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<ValuationRequestDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function submitValuationReport(
  config: PrototypeModulesApiConfig,
  id: string,
): Promise<PrototypeModulesResult<ValuationRequestDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/valuation-requests/${id}/submit-report`, {
      method: "POST",
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<ValuationRequestDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function submitValuationImpediment(
  config: PrototypeModulesApiConfig,
  id: string,
  reason: string,
): Promise<PrototypeModulesResult<ValuationRequestDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/valuation-requests/${id}/impediment`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify({ reason }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<ValuationRequestDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

// --- Property keys ---

export type PropertyKeyRecordDto = {
  id: string;
  idProp: string;
  po: string;
  area: string;
  type: string;
  key: boolean;
  specialist: string;
  status: string;
  deedStatus?: string;
};

export type UpdatePropertyKeyRequest = {
  key?: boolean;
  status?: string;
};

export async function listPropertyKeys(
  config: PrototypeModulesApiConfig,
  hasKey?: boolean,
): Promise<PrototypeModulesResult<PropertyKeyRecordDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  const qs =
    hasKey === undefined ? "" : `?hasKey=${hasKey ? "true" : "false"}`;
  try {
    const res = await fetch(`${base}/api/property-keys${qs}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<PropertyKeyRecordDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function patchPropertyKey(
  config: PrototypeModulesApiConfig,
  id: string,
  body: UpdatePropertyKeyRequest,
): Promise<PrototypeModulesResult<PropertyKeyRecordDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/property-keys/${id}`, {
      method: "PATCH",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<PropertyKeyRecordDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

// --- Key envelopes ---

export type KeyEnvelopeLinkedPropertyDto = {
  propertyId: string;
  poNumber: string;
  deedNumber: string;
  ownerName: string;
  city: string;
  court: string;
  circuit: string;
  requestNumber: string;
};

export type KeyEnvelopeAssignmentDto = {
  id: string;
  deedNumber: string;
  propertyId?: string | null;
  status: string;
  notes?: string | null;
  confirmedByName?: string | null;
  confirmedAtUtc?: string | null;
};

export type KeyEnvelopeHandoffDto = {
  id: string;
  kind: string;
  fromParty: string;
  toParty: string;
  toUserId?: string | null;
  letterNumber?: string | null;
  letterAttachmentId?: string | null;
  notes?: string | null;
  status: string;
  confirmedByName?: string | null;
  confirmedAtUtc?: string | null;
  createdByName: string;
  createdAtUtc: string;
};

export type KeyEnvelopeTimelineEntryDto = {
  id: string;
  eventType: string;
  summary: string;
  actorName: string;
  createdAtUtc: string;
};

export type KeyEnvelopeDto = {
  id: string;
  requestNumber: string;
  court: string;
  circuit: string;
  keysCountLabeled: number;
  keysCountActual: number;
  countMismatch: boolean;
  receiptAttachmentId?: string | null;
  photoAttachmentId?: string | null;
  thirdPartyLetterAttachmentId?: string | null;
  contactPhones?: string | null;
  notes?: string | null;
  receiveScenario: string;
  status: string;
  feeGenerated: boolean;
  feeAmountSar?: number | null;
  createdByUserId: string;
  createdByName: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  assignments: KeyEnvelopeAssignmentDto[];
  handoffs: KeyEnvelopeHandoffDto[];
  timeline: KeyEnvelopeTimelineEntryDto[];
  linkedProperties: KeyEnvelopeLinkedPropertyDto[];
};

export type KeyEnvelopeFeeReportRowDto = {
  envelopeId: string;
  requestNumber: string;
  court: string;
  circuit: string;
  photoAttachmentId?: string | null;
  receiptAttachmentId?: string | null;
  feeAmountSar: number;
  collectionStatus?: string;
  invoiceReference?: string | null;
  collectedAtUtc?: string | null;
  createdByName: string;
  createdAtUtc: string;
};

export type PropertyKeyGateDto = {
  propertyId?: string | null;
  poNumber: string;
  deedNumber: string;
  requestNumber: string;
  keysStatus: string;
  keyHandedToInspector: string;
  keyAvailable: boolean;
  source: string;
  envelopeId?: string | null;
  assignmentId?: string | null;
  assignmentStatus?: string | null;
  pendingHandoffId?: string | null;
  studyHoldStatus: string;
  envelopeMissingWarning: boolean;
};

export type PropertyCourtAccessDto = {
  id: string;
  propertyId: string;
  poNumber: string;
  deedNumber: string;
  requestNumber: string;
  hasEnablingLetter: boolean;
  enablingLetterAttachmentId?: string | null;
  hasEvictionNotice: boolean;
  evictionNoticeAttachmentId?: string | null;
  studyHoldStatus: string;
  contactPhones?: string | null;
  notes?: string | null;
  updatedByName: string;
  updatedAtUtc: string;
};

export type KeyEnvelopeAssignmentInput = {
  deedNumber: string;
  propertyId?: string | null;
  notes?: string | null;
};

export type CreateKeyEnvelopeRequest = {
  requestNumber: string;
  court: string;
  circuit: string;
  keysCountLabeled: number;
  keysCountActual: number;
  receiveScenario?: string;
  receiptAttachmentId?: string | null;
  photoAttachmentId?: string | null;
  thirdPartyLetterAttachmentId?: string | null;
  contactPhones?: string | null;
  notes?: string | null;
  assignments?: KeyEnvelopeAssignmentInput[];
};

export type AddKeyEnvelopeAssignmentRequest = {
  deedNumber: string;
  propertyId?: string | null;
  notes?: string | null;
};

export type ConfirmKeyAssignmentRequest = {
  status: "matched" | "unmatched" | string;
  notes?: string | null;
};

export type CreateKeyEnvelopeHandoffRequest = {
  kind: string;
  fromParty: string;
  toParty: string;
  toUserId?: string | null;
  letterNumber?: string | null;
  letterAttachmentId?: string | null;
  notes?: string | null;
};

export type UpsertPropertyCourtAccessRequest = {
  propertyId: string;
  hasEnablingLetter: boolean;
  enablingLetterAttachmentId?: string | null;
  hasEvictionNotice: boolean;
  evictionNoticeAttachmentId?: string | null;
  contactPhones?: string | null;
  notes?: string | null;
};

async function readPrototypeErrorMessage(
  res: Response,
): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { message?: string };
    const msg = body.message?.trim();
    return msg || undefined;
  } catch {
    return undefined;
  }
}

async function keyEnvelopeMutation(
  config: PrototypeModulesApiConfig,
  path: string,
  init?: RequestInit,
): Promise<PrototypeModulesResult<KeyEnvelopeDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...headers(config.token), ...init?.headers },
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (res.status === 404) {
      return {
        ok: false,
        kind: "not_found",
        message: await readPrototypeErrorMessage(res),
      };
    }
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        message: await readPrototypeErrorMessage(res),
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<KeyEnvelopeDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listKeyEnvelopes(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<KeyEnvelopeDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/key-envelopes`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<KeyEnvelopeDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getKeyEnvelope(
  config: PrototypeModulesApiConfig,
  id: string,
): Promise<PrototypeModulesResult<KeyEnvelopeDto>> {
  return keyEnvelopeMutation(config, `/api/key-envelopes/${id}`);
}

export async function listKeyEnvelopeLinkedProperties(
  config: PrototypeModulesApiConfig,
  requestNumber: string,
): Promise<PrototypeModulesResult<KeyEnvelopeLinkedPropertyDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  const qs = new URLSearchParams({ requestNumber });
  try {
    const res = await fetch(
      `${base}/api/key-envelopes/linked-properties?${qs}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        message: await readPrototypeErrorMessage(res),
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<KeyEnvelopeLinkedPropertyDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listKeyEnvelopeFeeReport(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<KeyEnvelopeFeeReportRowDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/key-envelopes/fee-report`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<KeyEnvelopeFeeReportRowDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getPropertyKeyGate(
  config: PrototypeModulesApiConfig,
  params: {
    propertyId?: string | null;
    poNumber?: string | null;
    deedNumber?: string | null;
    requestNumber?: string | null;
  },
): Promise<PrototypeModulesResult<PropertyKeyGateDto>> {
  const base = config.baseUrl ?? getApiBase();
  const qs = new URLSearchParams();
  if (params.propertyId) qs.set("propertyId", params.propertyId);
  if (params.poNumber) qs.set("poNumber", params.poNumber);
  if (params.deedNumber) qs.set("deedNumber", params.deedNumber);
  if (params.requestNumber) qs.set("requestNumber", params.requestNumber);
  try {
    const res = await fetch(`${base}/api/key-envelopes/gate?${qs}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<PropertyKeyGateDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function markKeyReceiptFeeCollected(
  config: PrototypeModulesApiConfig,
  envelopeId: string,
  body?: { invoiceReference?: string | null },
): Promise<PrototypeModulesResult<KeyEnvelopeFeeReportRowDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/key-envelopes/${envelopeId}/fee-collected`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify(body ?? {}),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (res.status === 404) {
      return {
        ok: false,
        kind: "not_found",
        message: await readPrototypeErrorMessage(res),
      };
    }
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        message: await readPrototypeErrorMessage(res),
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<KeyEnvelopeFeeReportRowDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listPropertyCourtAccess(
  config: PrototypeModulesApiConfig,
  requestNumber?: string,
): Promise<PrototypeModulesResult<PropertyCourtAccessDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  const qs = requestNumber
    ? `?${new URLSearchParams({ requestNumber })}`
    : "";
  try {
    const res = await fetch(`${base}/api/key-envelopes/court-access${qs}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<PropertyCourtAccessDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createKeyEnvelope(
  config: PrototypeModulesApiConfig,
  body: CreateKeyEnvelopeRequest,
): Promise<PrototypeModulesResult<KeyEnvelopeDto>> {
  return keyEnvelopeMutation(config, "/api/key-envelopes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function addKeyEnvelopeAssignment(
  config: PrototypeModulesApiConfig,
  envelopeId: string,
  body: AddKeyEnvelopeAssignmentRequest,
): Promise<PrototypeModulesResult<KeyEnvelopeDto>> {
  return keyEnvelopeMutation(
    config,
    `/api/key-envelopes/${envelopeId}/assignments`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function confirmKeyEnvelopeAssignment(
  config: PrototypeModulesApiConfig,
  envelopeId: string,
  assignmentId: string,
  body: ConfirmKeyAssignmentRequest,
): Promise<PrototypeModulesResult<KeyEnvelopeDto>> {
  return keyEnvelopeMutation(
    config,
    `/api/key-envelopes/${envelopeId}/assignments/${assignmentId}/confirm`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function createKeyEnvelopeHandoff(
  config: PrototypeModulesApiConfig,
  envelopeId: string,
  body: CreateKeyEnvelopeHandoffRequest,
): Promise<PrototypeModulesResult<KeyEnvelopeDto>> {
  return keyEnvelopeMutation(
    config,
    `/api/key-envelopes/${envelopeId}/handoffs`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function confirmKeyEnvelopeHandoff(
  config: PrototypeModulesApiConfig,
  envelopeId: string,
  handoffId: string,
): Promise<PrototypeModulesResult<KeyEnvelopeDto>> {
  return keyEnvelopeMutation(
    config,
    `/api/key-envelopes/${envelopeId}/handoffs/${handoffId}/confirm`,
    { method: "POST" },
  );
}

export async function upsertPropertyCourtAccess(
  config: PrototypeModulesApiConfig,
  body: UpsertPropertyCourtAccessRequest,
): Promise<PrototypeModulesResult<PropertyCourtAccessDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/key-envelopes/court-access`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (res.status === 404) {
      return {
        ok: false,
        kind: "not_found",
        message: await readPrototypeErrorMessage(res),
      };
    }
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        message: await readPrototypeErrorMessage(res),
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<PropertyCourtAccessDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

// --- Attachments ---

export type FileAttachmentMetaDto = {
  id: string;
  scope: string;
  scopeKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAtUtc: string;
};

export type UploadAttachmentRequest = {
  scope: string;
  scopeKey: string;
  fileName: string;
  contentType?: string;
  contentBase64: string;
};

export async function listAttachments(
  config: PrototypeModulesApiConfig,
  scope: string,
  scopeKey: string,
): Promise<PrototypeModulesResult<FileAttachmentMetaDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  const qs = new URLSearchParams({ scope, scopeKey });
  try {
    const res = await fetch(`${base}/api/attachments?${qs}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<FileAttachmentMetaDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function uploadAttachment(
  config: PrototypeModulesApiConfig,
  body: UploadAttachmentRequest,
): Promise<PrototypeModulesResult<FileAttachmentMetaDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/attachments`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<FileAttachmentMetaDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deleteAttachment(
  config: PrototypeModulesApiConfig,
  id: string,
): Promise<PrototypeModulesResult<null>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/attachments/${id}`, {
      method: "DELETE",
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: null };
  } catch {
    return { ok: false, kind: "network" };
  }
}

// --- Suspended transactions ---

export type SuspendedTransactionDto = {
  id: string;
  poNumber: string;
  propertyId: string;
  failureId: string;
  deedNumber: string;
  title: string;
  internalNote: string;
  raisedByRole: string;
  specialist: string;
  supervisorNote: string;
  suspendedAt: string;
  suspendedBy: string;
};

export async function listSuspendedTransactions(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<SuspendedTransactionDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/suspended-transactions`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<SuspendedTransactionDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function downloadAttachmentBlob(
  config: PrototypeModulesApiConfig,
  id: string,
): Promise<PrototypeModulesResult<Blob>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/attachments/${id}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await res.blob() };
  } catch {
    return { ok: false, kind: "network" };
  }
}

// --- Internal delegation letters ---

export type DelegationLetterPropertyDto = {
  propertyId: string;
  workOrder: string;
  deedNo: string;
  owner: string;
  requestNo: string;
};

export type DelegationLetterAgentDto = {
  name: string;
  nationality: string;
  nationalId: string;
  mobile: string;
};

export type InternalDelegationLetterDto = {
  id: string;
  city: string;
  court: string;
  circuit: string;
  selectedProperties: DelegationLetterPropertyDto[];
  reference?: string | null;
  dateHijri?: string | null;
  dateGreg?: string | null;
  issuedAt?: string | null;
  agent?: DelegationLetterAgentDto | null;
  issuedProperties?: DelegationLetterPropertyDto[] | null;
  createdAt: string;
};

export async function getInternalDelegationLetters(
  config: PrototypeModulesApiConfig,
  scopeKey: string,
): Promise<PrototypeModulesResult<InternalDelegationLetterDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  const qs = new URLSearchParams({ scopeKey });
  try {
    const res = await fetch(`${base}/api/internal-delegation-letters?${qs}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<InternalDelegationLetterDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveInternalDelegationLetters(
  config: PrototypeModulesApiConfig,
  scopeKey: string,
  letters: InternalDelegationLetterDto[],
): Promise<PrototypeModulesResult<InternalDelegationLetterDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/internal-delegation-letters`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify({ scopeKey, letters }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<InternalDelegationLetterDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function issueInternalDelegationLetter(
  config: PrototypeModulesApiConfig,
  body: {
    scopeKey: string;
    letterId: string;
    selectedProperties: DelegationLetterPropertyDto[];
    agent?: DelegationLetterAgentDto;
    city?: string;
    court?: string;
    circuit?: string;
  },
): Promise<PrototypeModulesResult<InternalDelegationLetterDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/internal-delegation-letters/issue`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<InternalDelegationLetterDto>(res);
    if (!data) return { ok: false, kind: "server" };
    return { ok: true, data };
  } catch {
    return { ok: false, kind: "network" };
  }
}

// --- Evaluator recalls ---

export type EvaluatorRecallDto = {
  id: string;
  taskId: string;
  poNumber: string;
  propertyId: string;
  status: string;
  reason: string;
  specialistNote: string;
  requestedAtUtc: string;
  resolvedAtUtc: string | null;
};

export async function listEvaluatorRecallsApi(
  config: PrototypeModulesApiConfig,
  status?: string,
): Promise<PrototypeModulesResult<EvaluatorRecallDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  try {
    const res = await fetch(`${base}/api/evaluator-recalls${qs}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<EvaluatorRecallDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getEvaluatorRecallApi(
  config: PrototypeModulesApiConfig,
  taskId: string,
): Promise<PrototypeModulesResult<EvaluatorRecallDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/evaluator-recalls/${taskId}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<EvaluatorRecallDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function requestEvaluatorRecallApi(
  config: PrototypeModulesApiConfig,
  body: {
    taskId: string;
    poNumber: string;
    propertyId: string;
    reason?: string;
  },
): Promise<PrototypeModulesResult<EvaluatorRecallDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/evaluator-recalls`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<EvaluatorRecallDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function approveEvaluatorRecallApi(
  config: PrototypeModulesApiConfig,
  taskId: string,
): Promise<PrototypeModulesResult<EvaluatorRecallDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/evaluator-recalls/${taskId}/approve`, {
      method: "PATCH",
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<EvaluatorRecallDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function rejectEvaluatorRecallApi(
  config: PrototypeModulesApiConfig,
  taskId: string,
  specialistNote?: string,
): Promise<PrototypeModulesResult<EvaluatorRecallDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/evaluator-recalls/${taskId}/reject`, {
      method: "PATCH",
      headers: headers(config.token),
      body: JSON.stringify({ specialistNote: specialistNote ?? "" }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<EvaluatorRecallDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
