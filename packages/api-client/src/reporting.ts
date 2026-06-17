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
  teamFieldMembers: ReportingTeamMemberDto[];
  specialistLoad: ReportingSpecialistLoadDto[];
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
    return { ok: true, data: (await res.json()) as ReportingDashboardDto };
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
