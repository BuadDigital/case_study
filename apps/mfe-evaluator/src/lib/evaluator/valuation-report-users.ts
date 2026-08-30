import type { PoIntakeRecord } from "@case-study/mfe/lib/prototype/po-intake-data";
import {
  VALUATION_REPORT_USER_OPTION_LABEL,
  showsValuationReportUserField,
} from "@case-study/mfe/lib/prototype/po-intake-data";
import type { ClientDto } from "@platform/api-client";

/* Valuation report user formatting — lightweight module independent of valuation-report-live-fill
 * so the (eager) report tab does not pull the full report builder (~2.4k lines) for one helper. */

export function reportUserNamesFromRecord(
  record: Pick<PoIntakeRecord, "clientNameAr" | "reportUserClientIds" | "clientId"> | null | undefined,
  clients: Pick<ClientDto, "id" | "nameAr">[],
): string {
  const ids = record?.reportUserClientIds ?? [];
  const names = ids
    .map((id) => clients.find((c) => c.id === id)?.nameAr.trim() ?? "")
    .filter(Boolean);
  if (names.length) return names.join(" و ");
  return clientNameFromRecord(record, clients);
}

export function clientNameFromRecord(
  record: Pick<PoIntakeRecord, "clientNameAr" | "clientId"> | null | undefined,
  clients: Pick<ClientDto, "id" | "nameAr">[] = [],
): string {
  const named = (record?.clientNameAr ?? "").trim();
  if (named) return named;
  const id = (record?.clientId ?? "").trim();
  if (!id) return "";
  return clients.find((c) => c.id === id)?.nameAr.trim() ?? "";
}

export function formatValuationReportUsers(
  record:
    | Pick<
        PoIntakeRecord,
        "clientNameAr" | "reportUserClientIds" | "assignmentType" | "clientId"
      >
    | null
    | undefined,
  clients: Pick<ClientDto, "id" | "nameAr">[],
): string {
  if (
    record &&
    showsValuationReportUserField(record.assignmentType, record.clientId)
  ) {
    return VALUATION_REPORT_USER_OPTION_LABEL;
  }
  const names = reportUserNamesFromRecord(record, clients);
  const client = clientNameFromRecord(record, clients);
  if (names && client && names !== client) return `${client} و ${names}`;
  return names || client;
}
