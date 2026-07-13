import { getPropertyFailure } from "@failures/mfe";
import type { PoRow, PropertyRow } from "./constants";
import { normalizePoListStatus } from "./po-list-status";
import type {
  PropertyListItemDto,
  WorkOrderDto,
  WorkOrderListItemDto,
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

/** Property list items for dashboard stats — slim API payload (task-aware on backend). */
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
