"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getPropertyKeyGate,
  type PropertyKeyGateDto,
} from "@platform/api-client";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";

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
      ...prototypeKeys.all,
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
  if (value === "received") return "مستلَمة";
  if (value === "not_required") return "غير مطلوبة";
  if (value === "pending") return "بانتظار";
  if (value === "blocked") return "متعذّر";
  return value?.trim() || "لم تُحدَّد بعد";
}

export function keyHandedLabelAr(value: string): string {
  if (value === "yes") return "تم التسليم";
  if (value === "no") return "لم يُسلَّم";
  if (value === "not_required") return "غير مطلوب";
  return value?.trim() || "لم تُحدَّد بعد";
}

export function keyGateSourceLabelAr(source: string): string {
  if (source === "envelope") return "ظرف مفاتيح";
  if (source === "court_access") return "تمكين / محظر محكمة";
  if (source === "legacy") return "سجل قديم";
  if (source === "none" || !source.trim()) return "لا يوجد مصدر";
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
