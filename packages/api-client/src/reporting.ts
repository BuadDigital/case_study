import { getApiBase } from "./index";
import type { PrototypeModulesApiConfig, PrototypeModulesResult } from "./prototype-modules";

export type ReportingTeamMemberDto = {
  initials: string;
  name: string;
  roleLine: string;
  teamKind: string;
  activeCount: number;
};

export type ReportingSpecialistLoadDto = {
  roleId: string;
  name: string;
  roleLabel: string;
  currentLoad: number;
  maxLoad: number;
  tone: string;
};

export type ReportingDashboardDto = {
  recentValuationRequests: {
    id: string;
    displayId: string;
    propId: string;
    area: string;
    type: string;
    appraiser: string;
    status: string;
    date: string;
  }[];
  recentGovernmentReviews: ReportingGovernmentReviewRowDto[];
  recentFailures: ReportingFailureRowDto[];
  partyFeesOverview?: ReportingPartyFeesOverviewDto;
  teamFieldMembers: ReportingTeamMemberDto[];
  specialistLoad: ReportingSpecialistLoadDto[];
  fieldInspectionProgress?: FieldInspectionWorkspaceSummaryDto;
};

export type ReportingGovernmentReviewRowDto = {
  taskId: string;
  poNumber: string;
  title: string;
  reviewerName: string;
  status: string;
};

export type ReportingFailureRowDto = {
  id: string;
  poNumber: string;
  deedNumber: string;
  title: string;
  status: string;
  severity: string;
  updatedAt: string;
};

export type ReportingPartyFeesOverviewDto = {
  pendingSupervisorReview: number;
  atFinance: number;
  disbursementRequested: number;
  netDraftSar: number;
  supReviewSar: number;
  atFinanceSar: number;
  disbReqSar: number;
  recentRows: ReportingPartyFeeRowDto[];
};

export type ReportingPartyFeeRowDto = {
  poNumber: string;
  propertyLabel: string;
  partyKindLabel: string;
  billingStatus: string;
  billingStatusLabel: string;
  netFeeSar: number;
};

export type FieldInspectionWorkspaceSummaryDto = {
  total: number;
  draft: number;
  reopened: number;
  submitted: number;
  photosPendingApproval: number;
  incompleteRequiredPhotos: number;
};

export type ReportingKpiScoreDto = {
  name: string;
  scorePercent: number;
};

export type ReportingKpiDto = {
  onTimeCompletionRate: number;
  avgPropertyDaysLabel: string;
  failureRatePercent: number;
  completedToday: number;
  specialistScores: ReportingKpiScoreDto[];
  providerScores: ReportingKpiScoreDto[];
};

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function baseUrl(config: PrototypeModulesApiConfig): string {
  return config.baseUrl ?? getApiBase();
}

export async function fetchReportingDashboard(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<ReportingDashboardDto>> {
  try {
    const res = await fetch(`${baseUrl(config)}/api/reporting/v1/dashboard`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    const progressRaw = (raw.fieldInspectionProgress ??
      raw.FieldInspectionProgress) as Record<string, unknown> | undefined;
    const data = raw as ReportingDashboardDto;
    if (progressRaw) {
      data.fieldInspectionProgress = {
        total: Number(progressRaw.total ?? progressRaw.Total ?? 0),
        draft: Number(progressRaw.draft ?? progressRaw.Draft ?? 0),
        reopened: Number(progressRaw.reopened ?? progressRaw.Reopened ?? 0),
        submitted: Number(progressRaw.submitted ?? progressRaw.Submitted ?? 0),
        photosPendingApproval: Number(
          progressRaw.photosPendingApproval ??
            progressRaw.PhotosPendingApproval ??
            0,
        ),
        incompleteRequiredPhotos: Number(
          progressRaw.incompleteRequiredPhotos ??
            progressRaw.IncompleteRequiredPhotos ??
            0,
        ),
      };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function fetchReportingKpi(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<ReportingKpiDto>> {
  try {
    const res = await fetch(`${baseUrl(config)}/api/reporting/v1/kpi`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: (await res.json()) as ReportingKpiDto };
  } catch {
    return { ok: false, kind: "network" };
  }
}
