import {
  listCourts,
  listPropertyKeys,
  listUsers,
  listWorkflowTasks,
  patchPropertyKey,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import { workOrdersApiConfig } from "@platform/app-shared/prototype/work-orders-api-config";
import type { PropertyKeyRow, PropertyKeysPageData } from "./keys-types";

function courtLabel(
  area: string,
  courts: { city: string; court: string }[],
): string {
  const normalized = area.trim();
  if (!normalized) return "—";

  const exact = courts.find((c) => c.city === normalized);
  if (exact) return exact.court;

  const partial = courts.find(
    (c) => normalized.includes(c.city) || c.city.includes(normalized),
  );
  return partial?.court ?? "—";
}

function reviewerForProperty(
  tasks: { kind: string; propertyId?: string; poNumber: string; assigneeName: string }[],
  propertyId: string,
  po: string,
): string {
  const task = tasks.find(
    (t) =>
      t.kind === "government-review" &&
      t.propertyId === propertyId &&
      t.poNumber === po,
  );
  return task?.assigneeName?.trim() ?? "";
}

function loadCourtDelegates(
  users: { displayName: string; status: string; jobTitle: string; systemRoles?: string[] }[],
): string[] {
  return users
    .filter(
      (u) =>
        u.status === "Active" &&
        (u.systemRoles?.includes("government-reviewer") ||
          u.jobTitle.includes("مراجع حكومي")),
    )
    .map((u) => u.displayName.trim())
    .filter(Boolean);
}

export async function loadPropertyKeysPage(): Promise<PropertyKeysPageData> {
  const modulesConfig = prototypeModulesApiConfig();
  if (!modulesConfig) return { keys: [], courtDelegates: [] };

  const workConfig = workOrdersApiConfig();

  const [keysResult, courtsResult, tasksResult, usersResult] = await Promise.all([
    listPropertyKeys(modulesConfig, true),
    listCourts(modulesConfig),
    workConfig ? listWorkflowTasks(workConfig) : Promise.resolve({ ok: false as const, kind: "auth" as const }),
    listUsers(modulesConfig),
  ]);

  if (!keysResult.ok) return { keys: [], courtDelegates: [] };

  const courts = courtsResult.ok ? courtsResult.entries : [];
  const tasks = tasksResult.ok ? tasksResult.data : [];
  const courtDelegates = usersResult.ok
    ? loadCourtDelegates(usersResult.users)
    : [];

  const keys: PropertyKeyRow[] = keysResult.data.map((row) => {
    const reviewer = reviewerForProperty(tasks, row.idProp, row.po);
    return {
      id: row.id,
      idProp: row.idProp,
      po: row.po,
      area: row.area,
      type: row.type,
      key: row.key,
      specialist: row.specialist,
      status: row.status,
      court: courtLabel(row.area, courts),
      delegate: reviewer || row.specialist.trim() || "—",
    };
  });

  return { keys, courtDelegates };
}

export async function markPropertyKeyReceived(
  id: string,
): Promise<PropertyKeyRow | null> {
  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const result = await patchPropertyKey(config, id, { status: "done" });
  if (!result.ok) return null;

  const page = await loadPropertyKeysPage();
  return page.keys.find((row) => row.id === id) ?? null;
}

export function keysApiEnabled(): boolean {
  return prototypeModulesApiConfig() !== null;
}
