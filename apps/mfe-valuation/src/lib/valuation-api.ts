import { listValuationRequests } from "@platform/api-client";
import type { VrRow } from "@platform/app-shared/prototype/constants";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";

export async function loadValuationRequests(): Promise<VrRow[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];

  const result = await listValuationRequests(config);
  if (!result.ok) return [];

  return result.data.map((row) => ({
    id: row.displayId,
    propId: row.propId,
    area: row.area,
    type: row.type,
    appraiser: row.appraiser,
    status: row.status === "done" ? "done" : "progress",
    date: row.date,
  }));
}

export function valuationApiEnabled(): boolean {
  return prototypeModulesApiConfig() !== null;
}
