import { listPropertyKeys, patchPropertyKey } from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";

export type PropertyKeyRow = {
  id: string;
  idProp: string;
  po: string;
  area: string;
  type: string;
  key: boolean;
  specialist: string;
  status: string;
};

export async function loadPropertyKeys(): Promise<PropertyKeyRow[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];

  const result = await listPropertyKeys(config, true);
  if (!result.ok) return [];

  return result.data.map((row) => ({
    id: row.id,
    idProp: row.idProp,
    po: row.po,
    area: row.area,
    type: row.type,
    key: row.key,
    specialist: row.specialist,
    status: row.status,
  }));
}

export async function markPropertyKeyReceived(
  id: string,
): Promise<PropertyKeyRow | null> {
  const config = prototypeModulesApiConfig();
  if (!config) return null;

  const result = await patchPropertyKey(config, id, { status: "done" });
  if (!result.ok) return null;

  return {
    id: result.data.id,
    idProp: result.data.idProp,
    po: result.data.po,
    area: result.data.area,
    type: result.data.type,
    key: result.data.key,
    specialist: result.data.specialist,
    status: result.data.status,
  };
}

export function keysApiEnabled(): boolean {
  return prototypeModulesApiConfig() !== null;
}
