/**
 * Quick-fill for «missing field» notifications: a short list of simple, ungated intake
 * property fields (no cross-field rules, no attachments, no workflow gating) that the
 * notified specialist can fill in directly from the notification, instead of opening the
 * full PO intake screen. Everything else — owner name, deed number, inspector / survey
 * fields, org settings — stays "click notification → open the real screen", since those
 * carry business rules (duplicate-deed checks, ClientFieldPolicy, on-site observation)
 * that a one-field patch must not bypass.
 */

import {
  getWorkOrder,
  updateWorkOrderProperty,
  type ApiErr,
  type ApiOk,
  type WorkOrderPropertyDto,
  type WorkOrdersApiConfig,
} from "@platform/api-client";

/** The only WorkOrderPropertyDto fields the quick-fill dialog is allowed to write —
 * all plain strings, so a patch can never collide with a boolean/array/file field. */
export type IntakeQuickFillFieldKey =
  | "requestNumber"
  | "region"
  | "city"
  | "district"
  | "planName"
  | "planNumber"
  | "blockNumber"
  | "plotNumber"
  | "area"
  | "classification"
  | "partitionMinutesNumber"
  | "partitionMinutesDate";

const SOURCE_EVENT_PREFIX = "intake-field-gap:";

/** The field label carried by an intake field-gap notification's sourceEvent, if any. */
export function parseIntakeFieldGapSourceEvent(
  sourceEvent: string | null | undefined,
): { fieldLabel: string } | null {
  const value = (sourceEvent ?? "").trim();
  if (!value.startsWith(SOURCE_EVENT_PREFIX)) return null;
  const rest = value.slice(SOURCE_EVENT_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep < 0) return null;
  const fieldLabel = rest.slice(sep + 1).trim();
  return fieldLabel ? { fieldLabel } : null;
}

/** PO number embedded in the notification's deep link — the only place it's carried. */
export function poNumberFromNotificationHref(href: string | null | undefined): string | null {
  const match = (href ?? "").match(/^\/po\/([^/]+)\/property\//);
  return match ? decodeURIComponent(match[1]) : null;
}

export type IntakeQuickFillInput = {
  key: IntakeQuickFillFieldKey;
  label: string;
  type: "text" | "date";
};

export type IntakeQuickFillField = {
  label: string;
  inputs: readonly IntakeQuickFillInput[];
};

/** Keyed by the exact report cell label — the same string the notification's fieldKey carries. */
export const INTAKE_QUICK_FILL_FIELDS: Record<string, IntakeQuickFillField> = {
  "رقم الطلب": {
    label: "رقم الطلب",
    inputs: [{ key: "requestNumber", label: "رقم الطلب", type: "text" }],
  },
  "اسم المنطقة": {
    label: "اسم المنطقة",
    inputs: [{ key: "region", label: "اسم المنطقة", type: "text" }],
  },
  "اسم المدينة": {
    label: "اسم المدينة",
    inputs: [{ key: "city", label: "اسم المدينة", type: "text" }],
  },
  "اسم الحي": {
    label: "اسم الحي",
    inputs: [{ key: "district", label: "اسم الحي", type: "text" }],
  },
  "اسم المخطط": {
    label: "اسم المخطط",
    inputs: [{ key: "planName", label: "اسم المخطط", type: "text" }],
  },
  "رقم المخطط": {
    label: "رقم المخطط",
    inputs: [{ key: "planNumber", label: "رقم المخطط", type: "text" }],
  },
  "رقم البلك": {
    label: "رقم البلك",
    inputs: [{ key: "blockNumber", label: "رقم البلك", type: "text" }],
  },
  "رقم القطعة": {
    label: "رقم القطعة",
    inputs: [{ key: "plotNumber", label: "رقم القطعة", type: "text" }],
  },
  "مساحة الأرض (حسب الصك)": {
    label: "مساحة الأرض (حسب الصك)",
    inputs: [{ key: "area", label: "مساحة الأرض (م²)", type: "text" }],
  },
  "استخدام العقار": {
    label: "استخدام العقار",
    inputs: [{ key: "classification", label: "التصنيف / الاستخدام", type: "text" }],
  },
  "محضر التجزئة": {
    label: "محضر التجزئة",
    inputs: [
      { key: "partitionMinutesNumber", label: "رقم محضر التجزئة", type: "text" },
      { key: "partitionMinutesDate", label: "تاريخ محضر التجزئة", type: "date" },
    ],
  },
};

export function intakeQuickFillFieldFor(fieldLabel: string): IntakeQuickFillField | null {
  return INTAKE_QUICK_FILL_FIELDS[fieldLabel] ?? null;
}

/**
 * Loads the property, patches only the quick-fill keys, writes it back in soft-draft mode —
 * the same gate-free path the intake form's own field autosave uses — so this never re-runs
 * full required-field validation for fields the specialist did not touch.
 */
export async function saveIntakeQuickFill(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
  patch: Partial<Record<IntakeQuickFillFieldKey, string>>,
): Promise<ApiOk<WorkOrderPropertyDto> | ApiErr> {
  const order = await getWorkOrder(config, poNumber);
  if (!order.ok) return order;

  const property = order.data.properties.find((p) => p.id === propertyId);
  if (!property) return { ok: false, kind: "not_found" };

  const merged: WorkOrderPropertyDto = { ...property, ...patch };
  return updateWorkOrderProperty(config, poNumber, propertyId, merged, { draft: true });
}
