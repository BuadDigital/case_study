/**
 * Server-backed specialist valuation extras (ESG, finishing notes in JSON bag,
 * search scope, print keys, Infath deposit). IndexedDB remains an offline cache.
 */

import { updateSpecialistReportExtras } from "@platform/api-client";
import {
  loadDomainJsonSync,
  saveDomainJsonSync,
} from "./browser-domain-store";
import { workOrdersApiConfig } from "../app-data/work-orders-api-config";

export type SpecialistReportExtrasBag = {
  esg?: unknown;
  finishing?: string;
  searchScopeNotes?: string;
  printKeys?: string[];
  infathDeposit?: {
    depositCode?: string;
    depositCertificateName?: string;
  };
};

const CACHE_PREFIX = "ejadah.specialist-report-extras.v1:";
const poByProperty = new Map<string, string>();

function cacheKey(propertyId: string): string {
  return `${CACHE_PREFIX}${propertyId.trim()}`;
}

export function rememberPropertyPoNumber(
  propertyId: string,
  poNumber: string,
): void {
  const id = propertyId.trim();
  const po = poNumber.trim();
  if (!id || !po) return;
  poByProperty.set(id, po);
}

export function loadSpecialistReportExtrasBag(
  propertyId: string | null | undefined,
): SpecialistReportExtrasBag {
  const id = (propertyId ?? "").trim();
  if (!id) return {};
  return loadDomainJsonSync<SpecialistReportExtrasBag>(cacheKey(id), {});
}

/** Hydrate from work-order property DTO (API is source of truth). */
export function hydrateSpecialistReportExtrasFromApi(
  propertyId: string,
  poNumber: string,
  specialistReportExtrasJson: string | null | undefined,
): void {
  rememberPropertyPoNumber(propertyId, poNumber);
  const id = propertyId.trim();
  if (!id) return;
  if (!specialistReportExtrasJson?.trim()) return;
  try {
    const parsed = JSON.parse(specialistReportExtrasJson) as unknown;
    if (!parsed || typeof parsed !== "object") return;
    saveDomainJsonSync(cacheKey(id), parsed as SpecialistReportExtrasBag);
  } catch {
    /* ignore bad server JSON */
  }
}

function mergeAndPersistLocal(
  propertyId: string,
  patch: SpecialistReportExtrasBag,
): SpecialistReportExtrasBag {
  const id = propertyId.trim();
  const next = {
    ...loadSpecialistReportExtrasBag(id),
    ...patch,
  };
  saveDomainJsonSync(cacheKey(id), next);
  return next;
}

/** Merge a patch into the bag, cache locally, and push to API when online. */
export function patchSpecialistReportExtras(
  propertyId: string,
  patch: SpecialistReportExtrasBag,
): SpecialistReportExtrasBag {
  const id = propertyId.trim();
  if (!id || typeof window === "undefined") return {};
  const next = mergeAndPersistLocal(id, patch);
  const po = poByProperty.get(id);
  const config = workOrdersApiConfig();
  if (po && config) {
    void updateSpecialistReportExtras(config, po, id, {
      specialistReportExtrasJson: JSON.stringify(next),
    }).catch(() => {
      /* keep IndexedDB cache; retry on next edit */
    });
  }
  return next;
}
