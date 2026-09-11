/**
 * Copy and routing for the prompt a red report cell opens: who supplies the information
 * (from the work order's field sources or the organization-settings editors) and what the
 * appraiser reads before sending.
 */

import type {
  OrganizationSettingsSectionEditorsDto,
  WorkOrderFieldSourcesDto,
} from "@platform/api-client";
import {
  REPORT_FIELD_SOURCES,
  type ReportMissingCell,
  type ReportSettingsSection,
} from "./valuation-report-missing-fields";

export type MissingFieldResponsible = {
  name: string;
  roleLabel: string;
  canNotify: boolean;
};

const SETTINGS_SECTION_LABELS: Record<ReportSettingsSection, string> = {
  company: "بيانات المنشأة",
  evaluator: "المقيّمون",
  report: "تقرير التقييم المهني",
};

/** Null while the people behind the cell's source are not loaded (or the cell has no one to ask). */
export function responsibleForMissingCell(
  cell: ReportMissingCell,
  sources: WorkOrderFieldSourcesDto | null | undefined,
  editors: OrganizationSettingsSectionEditorsDto | null | undefined,
): MissingFieldResponsible | null {
  switch (cell.source) {
    case "intake":
    case "inspector":
    case "survey":
      return sources ? sources[cell.source] : null;
    case "org": {
      if (!editors || !cell.section) return null;
      const editor = editors[cell.section];
      return {
        name: editor.name,
        roleLabel: `إعدادات المنشأة — ${SETTINGS_SECTION_LABELS[cell.section]}`,
        canNotify: editor.canNotify,
      };
    }
    default:
      return null;
  }
}

export function missingFieldPromptText(
  cell: ReportMissingCell,
  responsible: MissingFieldResponsible,
): string {
  const who = responsible.name
    ? `${responsible.name} (${responsible.roleLabel})`
    : responsible.roleLabel;
  return `إشعار ${who} بنقص «${cell.label}»؟`;
}

export function missingFieldNoResponsibleText(cell: ReportMissingCell): string {
  return `لا يوجد مسؤول مسند لـ«${cell.label}» يمكن إشعاره (${REPORT_FIELD_SOURCES[cell.source].label}).`;
}

export function missingFieldNotifiedToast(
  cell: ReportMissingCell,
  recipientName: string,
  fallbackName: string,
): string {
  return `تم إشعار ${recipientName.trim() || fallbackName} بنقص «${cell.label}»`;
}

export function missingFieldNotifyError(res: {
  kind: string;
  message?: string;
  errors?: Record<string, string>;
}): string {
  switch (res.kind) {
    case "validation":
      return (
        res.message?.trim() ||
        Object.values(res.errors ?? {})[0]?.trim() ||
        "تعذّر إرسال الإشعار"
      );
    case "forbidden":
      return "ليس لديك صلاحية لإرسال إشعار نقص البيانات";
    case "auth":
      return "انتهت الجلسة — سجّل الدخول من جديد ثم أعد المحاولة";
    default:
      return "تعذّر إرسال الإشعار — أعد المحاولة";
  }
}
