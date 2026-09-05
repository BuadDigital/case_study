/**
 * Shared journey fixture: builds a real, disposable transaction through the API.
 *
 * Every write journey creates its own PO (`E2E-<timestamp>`), so the specs are
 * independent and re-runnable and never depend on hand-seeded demo rows.
 *
 * The API recipe mirrors what the UI does, in the same order:
 *   POST /api/work-orders                              (intake — header + optional property)
 *   POST /api/work-orders/{po}/properties               (property added after a UI-only intake)
 *   POST /api/workflow-tasks/sync                       (materialise the case-study slots)
 *   POST /api/workflow-tasks/{id}/advance-after-enfath  (binds the property to the slot)
 *   PUT  /api/work-orders/{po}/properties/{id}/bourse   (bourse-stage fields)
 *   POST /api/workflow-tasks/{id}/advance-after-bourse
 *   POST /api/workflow-tasks/{id}/confirm-distribution  (spawns the three party children)
 */
import { API_BASE, RELEASE_USER_EMAILS, RELEASE_USER_PHONES } from "./auth";

export type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  json: T;
};

/** Distribution assignee slugs — seeded in backend/tools/DevSeed/DataSeeder.cs. */
export const ASSIGNEE_IDS = {
  fieldInspector: "fi-ahmed",
  appraiser: "val-abdullah",
  engineeringOffice: "eo-jeddah",
  caseSpecialist: "cs-osama",
} as const;

/** Display names the distribution writes onto the child tasks / parties panel. */
export const ASSIGNEE_NAMES = {
  fieldInspector: "أحمد سعيد",
  appraiser: "عبدالله الكثيري",
  engineeringOffice: "مكتب جدة للمساحة",
  caseSpecialist: "أسامة الصالحي",
} as const;

/** Infath — the seeded default client every PO is opened against. */
export const INFATH_CLIENT_ID = "a1000001-0000-4000-8000-000000000001";
const RIYADH_REGION_ID = "000000b1-0000-4000-8000-000000000001";
const RIYADH_CITY_ID = "000000b2-0000-4000-8000-000000000001";

/**
 * Passwordless demo login for API-driven fixture setup.
 * `/api/auth/login` is the target shape; a gateway that has not picked up the
 * passwordless AuthController yet still rejects it for a missing password, so
 * fall back to `/api/auth/login-username`, which has always been passwordless.
 */
export async function apiLogin(username: string): Promise<string> {
  const phone = RELEASE_USER_PHONES[username];
  if (!phone) throw new Error(`No demo phone mapped for "${username}"`);
  const failures: string[] = [];
  for (const path of ["/api/auth/login", "/api/auth/login-username"]) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: phone }),
    });
    if (!res.ok) {
      failures.push(`${path} -> HTTP ${res.status}`);
      continue;
    }
    const body = (await res.json()) as { token?: string };
    if (body.token) return body.token;
    failures.push(`${path} -> 200 without a token`);
  }
  throw new Error(`API login failed for "${username}": ${failures.join(" | ")}`);
}

export async function api<T = unknown>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* keep the raw text — it is what the failure message needs */
  }
  return { ok: res.ok, status: res.status, json: json as T };
}

/** Throws with the server's Arabic problem detail instead of a bare status code. */
export async function apiOk<T = unknown>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await api<T>(token, method, path, body);
  if (!res.ok) {
    throw new Error(
      `${method} ${path} failed (HTTP ${res.status}): ${JSON.stringify(res.json)}`,
    );
  }
  return res.json;
}

let poCounter = 0;

/** Unique per run AND per call, so a spec may open more than one PO. */
export function uniquePoNumber(): string {
  poCounter += 1;
  return `E2E-${Date.now()}-${poCounter}`;
}

/** Deed numbers must normalise to exactly 12 digits. */
export function uniqueDeedNumber(): string {
  const digits = `${Date.now()}${Math.floor(Math.random() * 100)}`.slice(-12);
  return digits.padStart(12, "9");
}

/** 1×1 PNG — smallest thing the attachment MIME sniffer accepts as an image. */
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function tinyPngBuffer(): Buffer {
  return Buffer.from(TINY_PNG_BASE64, "base64");
}

/** Minimal but structurally valid PDF — the upload gate sniffs the %PDF- header. */
export function tinyPdfBuffer(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n" +
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
      "trailer<</Root 1 0 R>>\n%%EOF\n",
    "utf8",
  );
}

export const TINY_PDF_BASE64 = tinyPdfBuffer().toString("base64");

/**
 * The intake modal autosaves a per-user draft on every keystroke and only clears
 * it after a successful save — an aborted run pre-fills the next run's modal.
 */
export async function clearPoIntakeDraft(token: string): Promise<void> {
  const res = await api(token, "DELETE", "/api/po-intake-draft/mine");
  if (!res.ok && res.status !== 404) {
    throw new Error(`Could not clear the PO intake draft (HTTP ${res.status})`);
  }
}

export type PropertySeed = {
  deedNumber: string;
  ownerName: string;
  court: string;
  circuit: string;
};

function propertyPayload(deedNumber: string, today: string) {
  return {
    identifierType: "deed",
    deedNumber,
    hasRequestNumber: false,
    assignmentMandateNumber: `TKF-${deedNumber.slice(-5)}`,
    assignmentMandateDate: today,
    ownerName: "مالك اختبار آلي",
    court: "محكمة التنفيذ بالرياض",
    circuit: "1",
    delegationLetterFileNames: ["delegation.pdf"],
    assignmentDocFileNames: ["assignment.pdf"],
    contacts: [{ name: "ضابط اتصال آلي", role: "مالك", phone: "0555000111" }],
    // Plan + plot make the engineering-office "site validity letter" optional
    // (PartyTaskSubmissionPayloadRules.RequireSiteLetterUnlessPlatted).
    planNumber: "1234",
    plotNumber: "77",
    area: "500",
  };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Header-only PO — the shape the UI intake modal itself posts (properties: []). */
export async function createWorkOrderHeader(
  token: string,
  poNumber: string,
): Promise<void> {
  await apiOk(token, "POST", "/api/work-orders", {
    poNumber,
    assignmentType: "تنفيذ",
    promulgationDate: today(),
    assignmentSpecialist: ASSIGNEE_NAMES.caseSpecialist,
    assignmentSpecialistEmail: RELEASE_USER_EMAILS.osama,
    expectedPropertyCount: 1,
    clientId: INFATH_CLIENT_ID,
    properties: [],
  });
}

export async function addProperty(
  token: string,
  poNumber: string,
  deedNumber: string,
): Promise<string> {
  const created = await apiOk<{ id: string }>(
    token,
    "POST",
    `/api/work-orders/${encodeURIComponent(poNumber)}/properties`,
    propertyPayload(deedNumber, today()),
  );
  return created.id;
}

export type WorkflowTask = {
  id: string;
  kind: string;
  poNumber: string;
  propertyId: string | null;
  phase: string;
  status: string;
  assigneeId: string | null;
  propertyOrdinal: number;
};

export async function listTasksForPo(
  token: string,
  poNumber: string,
): Promise<WorkflowTask[]> {
  return apiOk<WorkflowTask[]>(
    token,
    "GET",
    `/api/workflow-tasks?poNumber=${encodeURIComponent(poNumber)}`,
  );
}

/** POST /api/workflow-tasks/sync — what the UI calls after a successful intake. */
export async function syncTaskSlots(token: string): Promise<void> {
  await apiOk(token, "POST", "/api/workflow-tasks/sync");
}

export async function completeBourseData(
  token: string,
  poNumber: string,
  propertyId: string,
): Promise<void> {
  await apiOk(
    token,
    "PUT",
    `/api/work-orders/${encodeURIComponent(poNumber)}/properties/${propertyId}/bourse`,
    {
      city: "الرياض",
      region: "منطقة الرياض",
      regionId: RIYADH_REGION_ID,
      cityId: RIYADH_CITY_ID,
      district: "النرجس",
      classification: "سكني",
      // A built property (not "ارض") is what makes the inspector wizard render
      // the الواجهة / حالة البناء proof-photo cells — vacant land hides them
      // (FieldInspectionSubmissionValidator.LandHiddenFeatureKeys).
      propertyType: "فيلا",
      area: "500",
      deedStatus: "سليم",
      bourseDeedImageFileName: "bourse-deed.png",
    },
  );
}

/**
 * Walks the parent task enfath → bourse → distribution and confirms the three
 * parties. `advance-after-bourse` silently no-ops unless the bourse data is
 * already completed, hence the order.
 */
export async function distributeParties(
  token: string,
  poNumber: string,
  propertyId: string,
  deedNumber: string,
): Promise<PartyTasks> {
  await syncTaskSlots(token);
  const tasks = await listTasksForPo(token, poNumber);
  const parent =
    tasks.find((t) => t.kind === "case-study-property" && t.propertyId === propertyId) ??
    tasks
      .filter((t) => t.kind === "case-study-property" && !t.propertyId)
      .sort((a, b) => a.propertyOrdinal - b.propertyOrdinal)[0];
  if (!parent) throw new Error(`No case-study slot found for ${poNumber}`);

  await apiOk(token, "POST", `/api/workflow-tasks/${parent.id}/advance-after-enfath`, {
    propertyId,
    identifierType: "deed",
    bourseDataCompleted: false,
    deedNumber,
  });
  await completeBourseData(token, poNumber, propertyId);
  await apiOk(token, "POST", `/api/workflow-tasks/${parent.id}/advance-after-bourse`, {
    deedNumber,
  });
  await apiOk(token, "POST", `/api/workflow-tasks/${parent.id}/confirm-distribution`, {
    deedNumber,
    distribution: {
      governmentAuditor: false,
      governmentAuditorId: "",
      valuationDepartment: true,
      operationsCoordinatorId: "",
      inspectorId: ASSIGNEE_IDS.fieldInspector,
      valuatorId: ASSIGNEE_IDS.appraiser,
      engineeringOffice: true,
      engineeringOfficeId: ASSIGNEE_IDS.engineeringOffice,
      caseSpecialist: true,
      caseSpecialistId: ASSIGNEE_IDS.caseSpecialist,
    },
    assigneeNames: {
      "field-inspection": ASSIGNEE_NAMES.fieldInspector,
      "engineering-survey": ASSIGNEE_NAMES.engineeringOffice,
      "property-appraisal": ASSIGNEE_NAMES.appraiser,
    },
  });

  return readPartyTasks(token, poNumber);
}

export type PartyTasks = {
  parent: WorkflowTask;
  fieldInspection: WorkflowTask;
  engineeringSurvey: WorkflowTask;
  propertyAppraisal: WorkflowTask;
};

export async function readPartyTasks(
  token: string,
  poNumber: string,
): Promise<PartyTasks> {
  const tasks = await listTasksForPo(token, poNumber);
  const pick = (kind: string) => {
    const found = tasks.find((t) => t.kind === kind);
    if (!found) {
      throw new Error(
        `No "${kind}" task for ${poNumber} — got ${tasks.map((t) => t.kind).join(", ")}`,
      );
    }
    return found;
  };
  return {
    parent: pick("case-study-property"),
    fieldInspection: pick("field-inspection"),
    engineeringSurvey: pick("engineering-survey"),
    propertyAppraisal: pick("property-appraisal"),
  };
}

export type Transaction = PartyTasks & {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
};

/**
 * One distributed transaction, built end-to-end through the API.
 * Use it for every journey whose subject is NOT the intake screen itself.
 */
export async function createDistributedTransaction(
  token: string,
): Promise<Transaction> {
  const poNumber = uniquePoNumber();
  const deedNumber = uniqueDeedNumber();
  await apiOk(token, "POST", "/api/work-orders", {
    poNumber,
    assignmentType: "تنفيذ",
    promulgationDate: today(),
    assignmentSpecialist: ASSIGNEE_NAMES.caseSpecialist,
    assignmentSpecialistEmail: RELEASE_USER_EMAILS.osama,
    expectedPropertyCount: 1,
    clientId: INFATH_CLIENT_ID,
    properties: [propertyPayload(deedNumber, today())],
  });
  const order = await apiOk<{ properties: { id: string }[] }>(
    token,
    "GET",
    `/api/work-orders/${encodeURIComponent(poNumber)}`,
  );
  const propertyId = order.properties[0].id;
  const parties = await distributeParties(token, poNumber, propertyId, deedNumber);
  return { poNumber, propertyId, deedNumber, ...parties };
}

export async function uploadAttachment(
  token: string,
  input: {
    scope: string;
    scopeKey: string;
    fileName: string;
    contentType: string;
    contentBase64: string;
  },
): Promise<{ id: string; fileName: string }> {
  return apiOk<{ id: string; fileName: string }>(
    token,
    "POST",
    "/api/attachments",
    input,
  );
}

/**
 * Field-inspection package, driven through the API.
 * Only used where the UI cannot reach it — see the note in
 * inspector-submit-and-accept.spec.ts.
 */
export async function submitFieldInspection(
  inspectorToken: string,
  taskId: string,
): Promise<void> {
  const featureKeys = ["facade", "buildState", "carEntrance", "kitchen"] as const;
  const featurePhotoAttachments: Record<
    string,
    { attachmentId: string; fileName: string }
  > = {};
  for (const key of featureKeys) {
    const meta = await uploadAttachment(inspectorToken, {
      scope: "field-inspection-photo",
      scopeKey: `${taskId}:feature:${key}`,
      fileName: `${key}.png`,
      contentType: "image/png",
      contentBase64: TINY_PNG_BASE64,
    });
    featurePhotoAttachments[key] = {
      attachmentId: meta.id,
      fileName: meta.fileName,
    };
  }

  await apiOk(inspectorToken, "PUT", `/api/party-task-submissions/${taskId}`, {
    payload: {
      inspectionDate: today(),
      inspectionTime: "10:30",
      mapLatitude: "24.7136",
      mapLongitude: "46.6753",
      accessContactName: "ضابط اتصال آلي",
      accessContactPhone: "0555000111",
      accessContactRole: "مالك",
      accessRouteDescription: "طريق مباشر من الشارع الرئيسي",
      inspectionConfirmed: true,
      featureValues: {
        assetSubject: "فيلا",
        facade: "شمالية",
        buildState: "جيد",
        carEntrance: "نعم",
        kitchen: "نعم",
      },
      featurePhotoAttachments,
      observations: [],
      services: [],
      amenities: [],
      definedPhotos: {},
      freePhotos: [],
    },
  });
  await apiOk(inspectorToken, "POST", `/api/party-task-submissions/${taskId}/submit`);
}

/** Best-effort teardown so repeated local runs do not pile up POs. */
export async function deleteWorkOrder(
  token: string,
  poNumber: string,
): Promise<void> {
  await api(
    token,
    "DELETE",
    `/api/workflow-tasks/by-po/${encodeURIComponent(poNumber)}`,
  );
  await api(token, "DELETE", `/api/work-orders/${encodeURIComponent(poNumber)}`);
}
