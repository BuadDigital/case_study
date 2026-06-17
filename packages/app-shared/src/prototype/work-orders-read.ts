import { getPropertyFailure } from "@failures/mfe";
import type { PoRow, PropertyRow } from "./constants";
import type {
  WorkOrderDto,
  WorkOrderListItemDto,
  WorkOrderPropertyDto,
} from "@platform/api-client";
import { listWorkOrders, listWorkOrdersWithDetails } from "@platform/api-client";
import { workOrdersApiConfig } from "./work-orders-api-config";

const INCOMPLETE_CONTACT_MARKER_PHONE = "0500000000";

function poListStatusForAssignmentType(
  _assignmentType: string,
  workflowStatus: "progress" | "done",
): "progress" | "done" {
  return workflowStatus;
}

function listItemToPoRow(item: WorkOrderListItemDto): PoRow {
  return {
    id: item.poNumber,
    type: item.assignmentType || "—",
    count: item.expectedPropertyCount || item.propertyCount || 0,
    done: item.completedCount,
    status: poListStatusForAssignmentType(
      item.assignmentType,
      item.status === "done" ? "done" : "progress",
    ),
    date: item.receivedFromEnfathAt,
    dueDate: item.dueDateAt,
    specialist: item.assignmentSpecialist?.trim() || "—",
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

let workOrderDtosInflight: Promise<WorkOrderDto[]> | null = null;

/** Single API call — shared by PO records, property list, and dashboard stats. */
export async function loadWorkOrderDtos(): Promise<WorkOrderDto[]> {
  if (workOrderDtosInflight) return workOrderDtosInflight;

  workOrderDtosInflight = (async () => {
    const config = workOrdersApiConfig();
    if (!config) return [];

    const result = await listWorkOrdersWithDetails(config);
    if (!result.ok) return [];
    return result.data;
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

/** PO list rows for dashboard and PO screens — shared prototype read. */
export async function loadPoListRows(): Promise<PoRow[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listWorkOrders(config);
  if (!result.ok) return [];
  return result.data.map(listItemToPoRow);
}

export type PropertyListItem = {
  row: PropertyRow;
  poNumber: string;
  propertyId: string;
};

/** Property list items for dashboard stats — shared prototype read. */
export async function loadPropertyListItems(): Promise<PropertyListItem[]> {
  const records = await loadWorkOrderDtos();
  return mapWorkOrderDtosToPropertyListItems(records);
}
