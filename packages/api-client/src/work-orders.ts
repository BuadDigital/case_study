import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./index";
import { fetchAllListPages } from "./pagination";

export type WorkOrdersApiConfig = {
  baseUrl?: string;
  token: string;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type PropertyContactDto = {
  name: string;
  role: string;
  phone: string;
};

export type WorkOrderPropertyDto = {
  id?: string;
  identifierType: string;
  deedNumber: string;
  requestNumber?: string;
  assignmentMandateNumber?: string;
  assignmentMandateDate?: string;
  deedDate?: string;
  ownerName?: string;
  restrictionsPresent?: string;
  boundariesAvailability?: string;
  boundariesExternalDocName?: string;
  northBoundary?: string;
  northBoundaryLengthM?: string;
  southBoundary?: string;
  southBoundaryLengthM?: string;
  eastBoundary?: string;
  eastBoundaryLengthM?: string;
  westBoundary?: string;
  westBoundaryLengthM?: string;
  city?: string;
  district?: string;
  deedStatus?: string;
  area?: string;
  court?: string;
  circuit?: string;
  classification?: string;
  propertyType?: string;
  assignmentDocFileName?: string;
  delegationLetterFileName?: string;
  otherDocumentFileNames?: string[];
  realEstateRegFileName?: string;
  bourseDataCompleted?: boolean;
  planNumber?: string;
  plotNumber?: string;
  locationMapUrl?: string;
  contacts: PropertyContactDto[];
};

export type WorkOrderDto = {
  id: string;
  poNumber: string;
  assignmentType: string;
  promulgationDate: string;
  receivedFromEnfathAt: string;
  receivedFromEnfathTime?: string;
  assignmentSpecialist?: string;
  assignmentSpecialistEmail?: string;
  expectedPropertyCount: number;
  dueDateAt: string;
  createdAtUtc: string;
  propertiesRegion?: string;
  workOrderDescription?: string;
  properties: WorkOrderPropertyDto[];
};

export type WorkOrderListItemDto = {
  poNumber: string;
  assignmentType: string;
  propertyCount: number;
  expectedPropertyCount: number;
  completedCount: number;
  status: string;
  promulgationDate: string;
  receivedFromEnfathAt: string;
  dueDateAt: string;
  assignmentSpecialist?: string;
  workOrderDescription?: string;
  propertiesRegion?: string;
  createdAtUtc?: string;
};

export type CreateWorkOrderRequest = {
  poNumber: string;
  assignmentType: string;
  promulgationDate: string;
  receivedFromEnfathTime?: string;
  assignmentSpecialist?: string;
  assignmentSpecialistEmail?: string;
  expectedPropertyCount: number;
  propertiesRegion?: string;
  workOrderDescription?: string;
  properties?: WorkOrderPropertyDto[];
};

export type UpdateWorkOrderHeaderRequest = {
  assignmentType: string;
  promulgationDate: string;
  receivedFromEnfathTime?: string;
  assignmentSpecialist?: string;
  assignmentSpecialistEmail?: string;
  expectedPropertyCount: number;
  propertiesRegion?: string;
  workOrderDescription?: string;
};

export type UpdatePropertyBourseRequest = {
  city: string;
  district: string;
  classification: string;
  propertyType: string;
  area?: string;
  deedStatus?: string;
  restrictionsPresent?: string;
  boundariesAvailability?: string;
  boundariesExternalDocName?: string;
  northBoundary?: string;
  northBoundaryLengthM?: string;
  southBoundary?: string;
  southBoundaryLengthM?: string;
  eastBoundary?: string;
  eastBoundaryLengthM?: string;
  westBoundary?: string;
  westBoundaryLengthM?: string;
};

export type PriorDeedRegistrationDto = {
  poNumber: string;
  deedDate?: string;
  ownerName?: string;
  contacts?: PropertyContactDto[];
  city?: string;
  district?: string;
  classification?: string;
  propertyType?: string;
  area?: string;
  deedStatus?: string;
  restrictionsPresent?: string;
  boundariesAvailability?: string;
  boundariesExternalDocName?: string;
  northBoundary?: string;
  northBoundaryLengthM?: string;
  southBoundary?: string;
  southBoundaryLengthM?: string;
  eastBoundary?: string;
  eastBoundaryLengthM?: string;
  westBoundary?: string;
  westBoundaryLengthM?: string;
  planNumber?: string;
  plotNumber?: string;
  locationMapUrl?: string;
};

export type PropertyTimelineEventDto = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  tone: string;
};

export type PendingBoursePropertyDto = {
  poNumber: string;
  propertyId: string;
  identifierType?: string;
  deedNumber: string;
  deedDate?: string;
  ownerName?: string;
  requestNumber?: string;
  assignmentType: string;
  receivedFromEnfathAt: string;
  dueDateAt: string;
  /** PO creation time (ISO) — newest-first queue order. */
  createdAtUtc?: string;
};

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  kind: "auth" | "network" | "validation" | "server" | "not_found";
  message?: string;
  errors?: Record<string, string>;
};

async function parseFieldErrors(res: Response): Promise<Record<string, string>> {
  return parseFieldErrorsFromResponse(res);
}

export async function listWorkOrders(
  config: WorkOrdersApiConfig,
): Promise<ApiOk<WorkOrderListItemDto[]> | ApiErr> {
  return fetchAllListPages<WorkOrderListItemDto>(
    { ...config, baseUrl: config.baseUrl ?? getApiBase() },
    "/api/work-orders",
  );
}

/** Full work orders with properties — one round-trip (replaces N+1 getWorkOrder calls). */
export async function listWorkOrdersWithDetails(
  config: WorkOrdersApiConfig,
): Promise<ApiOk<WorkOrderDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/work-orders/details`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = (await res.json()) as WorkOrderDto[];
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type PropertyListRowDto = {
  id: string;
  po: string;
  area: string;
  type: string;
  key: boolean;
  survey: string;
  val: string;
  study: string;
  status: string;
  specialist: string;
};

export type PropertyListItemDto = {
  row: PropertyListRowDto;
  poNumber: string;
  propertyId: string;
};

/** Flat property rows for dashboard tables — avoids the full work-order details payload. */
export async function listPropertyListItems(
  config: WorkOrdersApiConfig,
): Promise<ApiOk<PropertyListItemDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/work-orders/property-rows`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = (await res.json()) as PropertyListItemDto[];
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listPendingBourseProperties(
  config: WorkOrdersApiConfig,
): Promise<ApiOk<PendingBoursePropertyDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/work-orders/properties/pending-bourse`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = (await res.json()) as PendingBoursePropertyDto[];
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getWorkOrder(
  config: WorkOrdersApiConfig,
  poNumber: string,
): Promise<ApiOk<WorkOrderDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const encoded = encodeURIComponent(poNumber.trim());
  try {
    const res = await fetch(`${base}/api/work-orders/${encoded}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as WorkOrderDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getPropertyTimeline(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
): Promise<ApiOk<PropertyTimelineEventDto[]> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const po = encodeURIComponent(poNumber.trim());
  const prop = encodeURIComponent(propertyId.trim());
  try {
    const res = await fetch(
      `${base}/api/work-orders/${po}/properties/${prop}/timeline`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = (await res.json()) as PropertyTimelineEventDto[];
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function workOrderExists(
  config: WorkOrdersApiConfig,
  poNumber: string,
): Promise<ApiOk<boolean> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/work-orders/exists?poNumber=${encodeURIComponent(poNumber.trim())}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as boolean };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function findPriorDeed(
  config: WorkOrdersApiConfig,
  deedNumber: string,
  excludePo?: string,
): Promise<ApiOk<PriorDeedRegistrationDto | null> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const params = new URLSearchParams({ deedNumber: deedNumber.trim() });
  if (excludePo?.trim()) params.set("excludePo", excludePo.trim());
  try {
    const res = await fetch(`${base}/api/work-orders/deeds/prior?${params}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: true, data: null };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as PriorDeedRegistrationDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createWorkOrder(
  config: WorkOrdersApiConfig,
  body: CreateWorkOrderRequest,
): Promise<ApiOk<WorkOrderDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const payload: CreateWorkOrderRequest = {
    ...body,
    properties: body.properties?.map(({ id: _draftId, ...prop }) => prop),
  };
  try {
    const res = await fetch(`${base}/api/work-orders`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(payload),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        errors: await parseFieldErrors(res),
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as WorkOrderDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function updateWorkOrderHeader(
  config: WorkOrdersApiConfig,
  poNumber: string,
  body: UpdateWorkOrderHeaderRequest,
): Promise<ApiOk<WorkOrderDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/work-orders/${encodeURIComponent(poNumber.trim())}`,
      {
        method: "PUT",
        headers: headers(config.token),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        errors: await parseFieldErrors(res),
      };
    }
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as WorkOrderDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deleteWorkOrder(
  config: WorkOrdersApiConfig,
  poNumber: string,
): Promise<ApiOk<void> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/work-orders/${encodeURIComponent(poNumber.trim())}`,
      { method: "DELETE", headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) {
      const message =
        res.status === 400
          ? ((await res.json()) as { message?: string }).message
          : undefined;
      return { ok: false, kind: "server", message };
    }
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, kind: "network" };
  }
}

async function postWorkOrderLifecycleAction(
  config: WorkOrdersApiConfig,
  poNumber: string,
  action: "cancel" | "stop",
): Promise<ApiOk<void> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/work-orders/${encodeURIComponent(poNumber.trim())}/${action}`,
      { method: "POST", headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) {
      const message =
        res.status === 400
          ? ((await res.json()) as { message?: string }).message
          : undefined;
      return { ok: false, kind: "server", message };
    }
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function cancelWorkOrder(
  config: WorkOrdersApiConfig,
  poNumber: string,
): Promise<ApiOk<void> | ApiErr> {
  return postWorkOrderLifecycleAction(config, poNumber, "cancel");
}

export async function stopWorkOrder(
  config: WorkOrdersApiConfig,
  poNumber: string,
): Promise<ApiOk<void> | ApiErr> {
  return postWorkOrderLifecycleAction(config, poNumber, "stop");
}

export async function addWorkOrderProperty(
  config: WorkOrdersApiConfig,
  poNumber: string,
  property: WorkOrderPropertyDto,
): Promise<ApiOk<WorkOrderPropertyDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  const { id: _draftId, ...body } = property;
  try {
    const res = await fetch(
      `${base}/api/work-orders/${encodeURIComponent(poNumber.trim())}/properties`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        errors: await parseFieldErrors(res),
      };
    }
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as WorkOrderPropertyDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function updateWorkOrderProperty(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
  property: WorkOrderPropertyDto,
): Promise<ApiOk<WorkOrderPropertyDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/work-orders/${encodeURIComponent(poNumber.trim())}/properties/${propertyId}`,
      {
        method: "PUT",
        headers: headers(config.token),
        body: JSON.stringify(property),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        errors: await parseFieldErrors(res),
      };
    }
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as WorkOrderPropertyDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Narrow patch for informal unlock — allowed for inspector without manage-work-orders. */
export async function updateWorkOrderPropertyLocationMapUrl(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
  locationMapUrl: string,
): Promise<ApiOk<WorkOrderPropertyDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/work-orders/${encodeURIComponent(poNumber.trim())}/properties/${propertyId}/location-map-url`,
      {
        method: "PUT",
        headers: headers(config.token),
        body: JSON.stringify({ locationMapUrl }),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        errors: await parseFieldErrors(res),
      };
    }
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as WorkOrderPropertyDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function completePropertyBourseData(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
  body: UpdatePropertyBourseRequest,
): Promise<ApiOk<WorkOrderPropertyDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/work-orders/${encodeURIComponent(poNumber.trim())}/properties/${propertyId}/bourse`,
      {
        method: "PUT",
        headers: headers(config.token),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      return {
        ok: false,
        kind: "validation",
        errors: await parseFieldErrors(res),
      };
    }
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as WorkOrderPropertyDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deleteWorkOrderProperty(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
): Promise<ApiOk<void> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/work-orders/${encodeURIComponent(poNumber.trim())}/properties/${propertyId}`,
      { method: "DELETE", headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) {
      const message =
        res.status === 400
          ? ((await res.json()) as { message?: string }).message
          : undefined;
      return { ok: false, kind: "server", message };
    }
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, kind: "network" };
  }
}
