import { getApiBase } from "./index";

export type PrototypeModulesApiConfig = {
  baseUrl?: string;
  token: string;
};

export type PrototypeModulesResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "auth" | "forbidden" | "network" | "server" | "not_found" };

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
