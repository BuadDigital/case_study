import { parseFieldErrorsFromResponse } from "./field-errors";
import { getApiBase } from "./index";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

export type CaseStudyFormDto = {
  version: number;
  taskId: string;
  propertyId?: string;
  poNumber?: string;
  status: string;
  currentStep: number;
  requestNumber: string;
  requestDate: string;
  deedNumber: string;
  answers: Record<string, unknown>;
  deedRemarks: string;
  surveyRemarks: string;
  componentsRemarks: string;
  occupancyRemarks: string;
  meterType: string;
  meterNumber: string;
  hoaFee: string;
  sigDeed: string;
  sigApprover: string;
  sigDate: string;
  specialistReviewApproved?: Record<string, boolean>;
  infathLinkedAssets?: string;
  infathLinkedDeedNumbers?: string;
  infathLinkedAssetsNotes?: string;
  infathOtherNotes?: string;
  infathClosingNotes?: string;
  savedAtUtc?: string;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function getCaseStudyForm(
  config: WorkOrdersApiConfig,
  taskId: string,
): Promise<ApiOk<CaseStudyFormDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-forms/${taskId}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyFormDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveCaseStudyForm(
  config: WorkOrdersApiConfig,
  taskId: string,
  form: CaseStudyFormDto,
): Promise<ApiOk<CaseStudyFormDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-forms/${taskId}`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify({ form }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyFormDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getPartyCaseStudyForm(
  config: WorkOrdersApiConfig,
  taskId: string,
): Promise<ApiOk<CaseStudyFormDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-forms/party/${taskId}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyFormDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function savePartyCaseStudyForm(
  config: WorkOrdersApiConfig,
  taskId: string,
  form: CaseStudyFormDto,
): Promise<ApiOk<CaseStudyFormDto> | ApiErr> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/case-study-forms/party/${taskId}`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify({ form }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const errors = await parseFieldErrorsFromResponse(res);
      return { ok: false, kind: "validation", errors };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as CaseStudyFormDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}
