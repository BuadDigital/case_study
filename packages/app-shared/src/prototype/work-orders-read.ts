import { getPropertyFailure } from "@failures/mfe";
import type { PoRow, PropertyRow } from "./constants";
import {
  normalizePoListStatus,
} from "./po-list-status";
import type {
  PropertyListItemDto,
  WorkOrderDto,
  WorkOrderListItemDto,
  WorkOrderPropertyDto,
} from "@platform/api-client";
import {
  listPropertyListItems,
  listWorkOrders,
  listWorkOrdersWithDetails,
} from "@platform/api-client";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "./work-orders-api-config";

const INCOMPLETE_CONTACT_MARKER_PHONE = "0500000000";

function listItemToPoRow(item: WorkOrderListItemDto): PoRow {
  const expected = item.expectedPropertyCount || item.propertyCount || 0;
  return {
    id: item.poNumber,
    type: item.assignmentType || "—",
    count: expected,
    registered: item.propertyCount ?? 0,
    done: item.completedCount ?? 0,
    status: normalizePoListStatus(item.status),
    date: item.receivedFromEnfathAt,
    dueDate: item.dueDateAt,
    specialist: item.assignmentSpecialist?.trim() || "—",
    createdAtUtc: item.createdAtUtc,
  };
}

function classificationRequiresSurvey(classification: string): boolean {
  return classification.trim() !== "وحدة داخل مبنى";
}

function propertyHasIncompleteContact(prop: WorkOrderPropertyDto): boolean {
  return (prop.contacts ?? []).some((c) => {
    const digits = (c.phone ?? "").replace(/\D/g, "");
    const marker = INCOMPLETE_CONTACT_MARKER_PHONE;
    return digits === marker || digits === marker.replace(/^0/, "");
  });
}

function propertyRowId(poNumber: string, prop: WorkOrderPropertyDto): string {
  const deed = (prop.deedNumber ?? "").trim();
  if (deed) return deed;
  const id = String(prop.id ?? "");
  return `${poNumber}-${id.slice(0, 8)}`;
}

function priorSurveyWaived(
  prop: WorkOrderPropertyDto,
  priorByDeed: Map<string, string>,
): boolean {
  if (!classificationRequiresSurvey(prop.classification ?? "")) return true;
  const n = (prop.deedNumber ?? "").trim();
  if (!n) return false;
  return priorByDeed.has(n);
}

function workOrderPropertyToPropertyRow(
  order: WorkOrderDto,
  prop: WorkOrderPropertyDto,
  priorByDeed: Map<string, string>,
): PropertyRow {
  const propertyId = String(prop.id ?? "");
  const failure = getPropertyFailure(order.poNumber, propertyId);
  const boursePending = !prop.bourseDataCompleted;
  const underVerification = prop.deedStatus === "قيد التحقق";
  const isFailed =
    failure?.status === "approved" || prop.deedStatus === "موقوف";
  const incomplete = propertyHasIncompleteContact(prop);
  const city = prop.city ?? "";
  const district = prop.district ?? "";
  const area = boursePending
    ? "بانتظار البورصة"
    : district
      ? `${city} · ${district}`
      : city || "—";

  return {
    id: propertyRowId(order.poNumber, prop),
    po: order.poNumber,
    area,
    type: boursePending
      ? "—"
      : prop.propertyType || prop.classification || "—",
    key: false,
    survey: boursePending
      ? "new"
      : priorSurveyWaived(prop, priorByDeed)
        ? "done"
        : "new",
    val: "new",
    study: boursePending
      ? "progress"
      : underVerification
        ? "progress"
        : "new",
    status: boursePending
      ? "progress"
      : isFailed
        ? "fail"
        : incomplete
          ? "incomplete"
          : underVerification
            ? "progress"
            : "new",
    specialist: order.assignmentSpecialist ?? "",
  };
}

function apiPropertyListItemToPropertyListItem(
  item: PropertyListItemDto,
): PropertyListItem {
  const failure = getPropertyFailure(item.poNumber, item.propertyId);
  const row = item.row;
  const status =
    failure?.status === "approved" && row.status !== "fail"
      ? "fail"
      : (row.status as PropertyRow["status"]);

  return {
    poNumber: item.poNumber,
    propertyId: item.propertyId,
    row: {
      id: row.id,
      po: row.po,
      area: row.area,
      type: row.type,
      key: row.key,
      survey: row.survey as PropertyRow["survey"],
      val: row.val as PropertyRow["val"],
      study: row.study as PropertyRow["study"],
      status,
      specialist: row.specialist,
    },
  };
}

let workOrderDtosInflight: Promise<WorkOrderDto[]> | null = null;
let propertyListItemsInflight: Promise<PropertyListItem[]> | null = null;

/** Single API call — shared by PO records and legacy detail consumers. */
export async function loadWorkOrderDtos(): Promise<WorkOrderDto[]> {
  if (workOrderDtosInflight) return workOrderDtosInflight;

  workOrderDtosInflight = (async () => {
    const config = requireWorkOrdersApiConfig();
    const result = await listWorkOrdersWithDetails(config);
    return unwrapApiResult(result, "تعذّر تحميل أوامر العمل");
  })().finally(() => {
    workOrderDtosInflight = null;
  });

  return workOrderDtosInflight;
}

export function mapWorkOrderDtosToPropertyListItems(
  records: WorkOrderDto[],
): PropertyListItem[] {
  const priorByDeed = new Map<string, string>();
  for (const record of records) {
    for (const prop of record.properties) {
      if (prop.identifierType === "deed" && (prop.deedNumber ?? "").trim()) {
        priorByDeed.set(prop.deedNumber.trim(), record.poNumber);
      }
    }
  }

  return records.flatMap((record) =>
    record.properties.map((prop) => ({
      row: workOrderPropertyToPropertyRow(record, prop, priorByDeed),
      poNumber: record.poNumber,
      propertyId: String(prop.id ?? ""),
    })),
  );
}

/** PO list rows for dashboard and PO screens — loads all pages (500 rows per request). */
export async function loadPoListRows(): Promise<PoRow[]> {
  const config = requireWorkOrdersApiConfig();
  const result = await listWorkOrders(config);
  return unwrapApiResult(result, "تعذّر تحميل قائمة أوامر العمل").map(
    listItemToPoRow,
  );
}

export type PropertyListItem = {
  row: PropertyRow;
  poNumber: string;
  propertyId: string;
};

/** Property list items for dashboard stats — slim API payload. */
export async function loadPropertyListItems(): Promise<PropertyListItem[]> {
  if (propertyListItemsInflight) return propertyListItemsInflight;

  propertyListItemsInflight = (async () => {
    const config = requireWorkOrdersApiConfig();
    const result = await listPropertyListItems(config);
    return unwrapApiResult(
      result,
      "تعذّر تحميل قائمة العقارات",
    ).map(apiPropertyListItemToPropertyListItem);
  })().finally(() => {
    propertyListItemsInflight = null;
  });

  return propertyListItemsInflight;
}
