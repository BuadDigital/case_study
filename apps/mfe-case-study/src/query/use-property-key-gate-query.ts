"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getPropertyKeyGate,
  PropertyKeyGateSources,
  PropertyKeyHandedValues,
  PropertyKeysStatuses,
  type PropertyKeyGateDto,
} from "@platform/api-client";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";

export function usePropertyKeyGateQuery(params: {
  propertyId?: string | null;
  poNumber?: string | null;
  deedNumber?: string | null;
  requestNumber?: string | null;
  enabled?: boolean;
}) {
  const enabled = params.enabled ?? true;
  return useQuery({
    queryKey: [
      ...appDataKeys.all,
      "property-key-gate",
      params.propertyId ?? "",
      params.poNumber ?? "",
      params.deedNumber ?? "",
      params.requestNumber ?? "",
    ],
    queryFn: async (): Promise<PropertyKeyGateDto | null> => {
      const config = prototypeModulesApiConfig();
      if (!config) return null;
      const result = await getPropertyKeyGate(config, {
        propertyId: params.propertyId,
        poNumber: params.poNumber,
        deedNumber: params.deedNumber,
        requestNumber: params.requestNumber,
      });
      if (!result.ok) return null;
      return result.data;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function keysStatusLabelAr(value: string): string {
  if (value === PropertyKeysStatuses.Received) return "مستلَمة";
  if (value === PropertyKeysStatuses.NotRequired) return "غير مطلوبة";
  if (value === PropertyKeysStatuses.Pending) return "بانتظار";
  if (value === PropertyKeysStatuses.Blocked) return "متعذّر";
  return value?.trim() || "لم تُحدَّد بعد";
}

export function keyHandedLabelAr(value: string): string {
  if (value === PropertyKeyHandedValues.Yes) return "تم التسليم";
  if (value === PropertyKeyHandedValues.No) return "لم يُسلَّم";
  if (value === PropertyKeysStatuses.NotRequired) return "غير مطلوب";
  return value?.trim() || "لم تُحدَّد بعد";
}

export function keyGateSourceLabelAr(source: string): string {
  if (source === PropertyKeyGateSources.Envelope) return "ظرف مفاتيح";
  if (source === PropertyKeyGateSources.CourtAccess) return "تمكين / محظر محكمة";
  if (source === PropertyKeyGateSources.Legacy) return "سجل قديم";
  if (source === PropertyKeyGateSources.None || !source.trim()) return "لا يوجد مصدر";
  return source;
}

/** Prefer gate envelope; fall back to ops court-visit linkedEnvelopeId. */
export function resolveEnvelopeIdFromSources(
  gate: PropertyKeyGateDto | null | undefined,
  courtVisitLinkedEnvelopeId?: string | null,
): string | null {
  const fromGate = gate?.envelopeId?.trim();
  if (fromGate) return fromGate;
  const fromOps = courtVisitLinkedEnvelopeId?.trim();
  return fromOps || null;
}
