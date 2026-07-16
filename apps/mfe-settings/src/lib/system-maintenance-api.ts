import { getApiBase } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";

export type SystemResetResult = {
  workOrdersDeleted: number;
  workflowTasksDeleted: number;
  caseStudyFormsDeleted: number;
  registeredUsersDeleted: number;
};

type ApiResult =
  | { ok: true; result: SystemResetResult }
  | { ok: false; kind: "auth" | "network" | "forbidden" | "not_found" | "server" };

function mapResetResult(raw: Record<string, unknown>): SystemResetResult {
  const n = (key: string) => Number(raw[key] ?? raw[key[0].toUpperCase() + key.slice(1)] ?? 0);
  return {
    workOrdersDeleted: n("workOrdersDeleted"),
    workflowTasksDeleted: n("workflowTasksDeleted"),
    caseStudyFormsDeleted: n("caseStudyFormsDeleted"),
    registeredUsersDeleted: n("registeredUsersDeleted"),
  };
}

export async function resetAllOperationalData(): Promise<ApiResult> {
  const session = getAuthSession();
  if (!session?.token) return { ok: false, kind: "auth" };

  try {
    const res = await fetch(`${getApiBase()}/api/system/data`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, result: mapResetResult(raw) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
