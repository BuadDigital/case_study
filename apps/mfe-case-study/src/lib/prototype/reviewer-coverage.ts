import type { RoleId } from "@platform/types";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import {
  COURTS_BY_CITY,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "./po-intake-data";
import type { WorkflowTask } from "./tasks-storage";
import { partyAccountForRole } from "./distribution-parties";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";

export type ReviewerScope = {
  assigneeId: string;
  cities: string[];
  label: string;
};

export function getReviewerCityCoverage(
  assigneeId: string,
  users: StaffUser[] = [],
): string[] {
  const id = assigneeId.trim();
  if (!id) return [];
  const staff = users.find((u) => u.distributionAssigneeId?.trim() === id);
  return staff?.reviewerCityCoverage?.filter((city) => city.trim()) ?? [];
}

const courtToCity = (() => {
  const map = new Map<string, string>();
  for (const [city, courts] of Object.entries(COURTS_BY_CITY)) {
    for (const entry of courts) {
      map.set(entry.court, city);
    }
  }
  return map;
})();

export function reviewerScopeForRole(
  role: RoleId,
  users: StaffUser[] = [],
): ReviewerScope | null {
  if (isSuperAdmin(role)) return null;
  const account = partyAccountForRole(role, users);
  if (!account || role !== "government-reviewer") return null;
  return {
    assigneeId: account.assigneeId,
    cities: getReviewerCityCoverage(account.assigneeId, users),
    label: account.name,
  };
}

export function reviewerCoverageLabel(scope: ReviewerScope | null): string {
  if (!scope) return "جميع المناطق";
  if (scope.cities.length === 0) return scope.label;
  return `${scope.label} — ${scope.cities.join(" · ")}`;
}

export function propertyCourtCity(
  property: PoPropertyIntake,
  _record?: PoIntakeRecord,
): string {
  const court = property.court.trim();
  if (court) return courtToCity.get(court) ?? property.city.trim();
  return property.city.trim();
}

export function courtCityFromName(court: string): string {
  return courtToCity.get(court.trim()) ?? "";
}

/** Cities derived from property court/city fields — used when filtering PO rows. */
export function poCitiesForReviewerScope(
  record: PoIntakeRecord | undefined,
  tasks: WorkflowTask[],
): string[] {
  const cities = new Set<string>();
  const considerProperty = (property: PoPropertyIntake | undefined) => {
    if (!property) return;
    const court = property.court.trim();
    if (court) {
      const fromCourt = courtCityFromName(court);
      if (fromCourt) cities.add(fromCourt);
    }
    const city = property.city.trim();
    if (city) cities.add(city);
  };

  for (const task of tasks) {
    considerProperty(record?.properties.find((p) => p.id === task.propertyId));
  }
  if (record) {
    for (const property of record.properties) considerProperty(property);
  }
  return [...cities];
}

export function poInReviewerScope(
  courts: string[],
  scope: ReviewerScope | null,
  cities: string[] = [],
): boolean {
  if (!scope || scope.cities.length === 0) return true;

  const fromCourts = courts
    .map((court) => courtCityFromName(court))
    .filter((city): city is string => Boolean(city));
  const all = [...fromCourts, ...cities];

  // مهام مُسنَدة فعلياً — لا نخفي أمر العمل إذا لم تُسجَّل المحكمة/المدينة بعد.
  if (all.length === 0) return true;

  return all.some((city) => scope.cities.includes(city));
}
