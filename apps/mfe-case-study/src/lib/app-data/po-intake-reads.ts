import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-data";
import type {
  PendingBoursePropertyDto,
  PriorDeedRegistrationDto,
} from "@platform/api-client";
import {
  findPriorDeed,
  getPoIntakeDraft,
  getWorkOrder,
  listPendingBourseProperties,
  listPriorDeeds,
  workOrderExists,
} from "@platform/api-client";
import { isBrowserOffline } from "@platform/app-shared/offline/offline-write";
import {
  readPrefetchedPoRecord,
  readPrefetchedPoRecords,
} from "@platform/app-shared/offline/prefetch-read";
import { normalizeDeedNumber } from "./deed-number";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import {
  loadPoListRows,
  loadPropertyListItems,
  loadWorkOrderDtos,
  type PropertyListItem,
} from "@platform/app-shared/app-data/work-orders-read";
export { loadPoListRows, loadPropertyListItems, type PropertyListItem };
import {
  dtoToDraft,
  dtoToRecord,
  isGuidPropertyId,
  mapWorkOrderDtosToPoRecords,
  poIntakeDraftCache,
  type PoIntakeDraftPayload,
} from "./po-intake-model";
import {
  resolveApiError,
  workOrdersApiConfig,
} from "../work-orders-api-config";

export async function loadPoRecords(): Promise<PoIntakeRecord[]> {
  if (isBrowserOffline()) {
    return readPrefetchedPoRecords<PoIntakeRecord>();
  }
  try {
    const dtos = await loadWorkOrderDtos();
    return mapWorkOrderDtosToPoRecords(dtos);
  } catch {
    const cached = await readPrefetchedPoRecords<PoIntakeRecord>();
    if (cached.length) return cached;
    throw new Error("تعذّر تحميل أوامر العمل");
  }
}

export async function poRecordExists(poNumber: string): Promise<boolean> {
  const config = workOrdersApiConfig();
  if (!config) return false;
  const result = await workOrderExists(config, poNumber);
  return result.ok ? result.data : false;
}

export async function findPriorDeedFull(
  deedNumber: string,
  excludePo?: string,
  excludePropertyId?: string,
): Promise<PriorDeedRegistrationDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const deed = normalizeDeedNumber(deedNumber) || deedNumber.trim();
  if (!deed) return null;
  // Only forward real GUIDs — bad excludePropertyId causes 400 on the API.
  const safeExcludePropertyId = isGuidPropertyId(excludePropertyId)
    ? excludePropertyId.trim()
    : undefined;
  const result = await findPriorDeed(
    config,
    deedNumber.trim() || deed,
    excludePo,
    safeExcludePropertyId,
  );
  if (!result.ok) {
    if (result.kind === "auth") {
      throw new Error("يجب تسجيل الدخول للبحث عن المعاملة السابقة");
    }
    if (result.kind === "forbidden") {
      throw new Error("غير مصرح لك بالبحث عن تسجيل سابق لنفس الصك");
    }
    if (result.kind === "network") {
      throw new Error("تعذّر الاتصال — تحقق من تشغيل الـ API");
    }
    throw new Error("تعذّر البحث عن المعاملة السابقة لنفس رقم الصك");
  }
  return result.data;
}

/** Full prior-study history for a deed (newest first). */
export async function listPriorDeedsFull(
  deedNumber: string,
  excludePo?: string,
  excludePropertyId?: string,
  take = 20,
): Promise<PriorDeedRegistrationDto[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const deed = deedNumber.trim();
  if (!deed) return [];
  const safeExcludePropertyId = isGuidPropertyId(excludePropertyId)
    ? excludePropertyId.trim()
    : undefined;
  const result = await listPriorDeeds(
    config,
    deed,
    excludePo,
    safeExcludePropertyId,
    take,
  );
  if (!result.ok) {
    if (result.kind === "auth") {
      throw new Error("يجب تسجيل الدخول للبحث عن المعاملة السابقة");
    }
    if (result.kind === "forbidden") {
      throw new Error("غير مصرح لك بالبحث عن تسجيل سابق لنفس الصك");
    }
    if (result.kind === "network") {
      throw new Error("تعذّر الاتصال — تحقق من تشغيل الـ API");
    }
    throw new Error("تعذّر تحميل سجل الدراسات السابقة لنفس رقم الصك");
  }
  return result.data;
}

export async function loadPendingBourseItems(): Promise<
  PendingBoursePropertyDto[]
> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listPendingBourseProperties(config);
  return result.ok ? result.data : [];
}

export async function getPoRecord(
  poNumber: string,
): Promise<PoIntakeRecord | null> {
  const n = poNumber.trim();
  if (!n) return null;

  if (isBrowserOffline()) {
    return readPrefetchedPoRecord<PoIntakeRecord>(n);
  }

  const config = workOrdersApiConfig();
  if (!config) {
    return readPrefetchedPoRecord<PoIntakeRecord>(n);
  }

  try {
    const result = await getWorkOrder(config, n);
    if (!result.ok) {
      if (result.kind === "not_found") return null;
      const cached = await readPrefetchedPoRecord<PoIntakeRecord>(n);
      if (cached) return cached;
      throw new Error(
        resolveApiError(result.kind, result.errors, "تعذّر تحميل أمر العمل"),
      );
    }
    return dtoToRecord(result.data);
  } catch (err) {
    const cached = await readPrefetchedPoRecord<PoIntakeRecord>(n);
    if (cached) return cached;
    if (err instanceof Error) throw err;
    throw new Error("تعذّر تحميل أمر العمل");
  }
}

export async function findPropertyInRecord(
  poNumber: string,
  propertyId: string,
): Promise<{ record: PoIntakeRecord; property: PoPropertyIntake } | null> {
  const record = await getPoRecord(poNumber);
  if (!record) return null;
  const property = record.properties.find((p) => p.id === propertyId);
  if (!property) return null;
  return { record, property };
}

export async function deedExistsInPo(
  poNumber: string,
  deedNumber: string,
  excludePropertyId?: string,
): Promise<boolean> {
  const record = await getPoRecord(poNumber);
  if (!record) return false;
  const n = deedNumber.trim();
  return record.properties.some(
    (p) =>
      !p.isRemoved &&
      p.deedNumber.trim() === n &&
      p.id !== excludePropertyId,
  );
}

/** Fetch server draft into in-memory cache. */
export async function hydratePoDraft(): Promise<PoIntakeDraftPayload | null> {
  if (poIntakeDraftCache.hydratePromise) return poIntakeDraftCache.hydratePromise;

  poIntakeDraftCache.hydratePromise = (async () => {
    const config = prototypeModulesApiConfig();
    if (!config) {
      poIntakeDraftCache.memoryDraft = null;
      return null;
    }

    const result = await getPoIntakeDraft(config);
    if (!result.ok) {
      if (result.kind === "not_found") {
        poIntakeDraftCache.memoryDraft = null;
        return null;
      }
      throw new Error(
        resolveApiError(result.kind, undefined, "تعذّر تحميل مسودة أمر العمل"),
      );
    }
    if (result.data) {
      poIntakeDraftCache.memoryDraft = dtoToDraft(result.data);
      return poIntakeDraftCache.memoryDraft;
    }

    poIntakeDraftCache.memoryDraft = null;
    return null;
  })();

  return poIntakeDraftCache.hydratePromise;
}
