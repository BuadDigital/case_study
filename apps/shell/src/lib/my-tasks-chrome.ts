import { decodeTaskParam } from "@case-study/mfe";
import { partyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { PageId } from "@platform/types";

export type MyTasksChrome = {
  breadcrumb: string;
  title: string;
};

export type MyTasksChromeOptions = {
  /** Appended after breadcrumb on `/case-study/[taskId]` (e.g. رقم الصك). */
  deedLabel?: string;
  /** Operations task title for `/operations-tasks?task=` (HTML `t.title`). */
  opsTaskTitle?: string;
};

/**
 * Workspace / task-detail topbar chrome — current leaf label only
 * (no لوحة التحكم / section parents).
 */
export function resolveMyTasksChrome(
  pathname: string,
  taskId?: string | null,
  options?: MyTasksChromeOptions,
): MyTasksChrome | null {
  const parts = pathname.split("/").filter(Boolean);
  const page = parts[0] as PageId | undefined;

  if (page === "active-survey" && parts[1]) {
    decodeTaskParam(parts[1]);
    const isEntry = parts[2] === "entry";
    if (isEntry) {
      return {
        breadcrumb: "إدخال الرفع المساحي",
        title: "ابدأ الرفع المساحي",
      };
    }
    return {
      breadcrumb: "مساحة العمل",
      title: "المكتب الهندسي — الرفع المساحي",
    };
  }

  if (page === "property-appraisal" && parts[1]) {
    decodeTaskParam(parts[1]);
    return {
      breadcrumb: "نافذة التقييم",
      title: "المقيم العقاري — نافذة التقييم",
    };
  }

  if (page === "active-inspection" && parts[1]) {
    decodeTaskParam(parts[1]);
    return {
      breadcrumb: "مساحة العمل",
      title: "معاينة العقار",
    };
  }

  if (page === "property-inspection" && parts[1]) {
    decodeTaskParam(parts[1]);
    return {
      breadcrumb: "مساحة العمل",
      title: "معاينة العقار",
    };
  }

  if (page === "operations-tasks" && taskId) {
    const id = decodeTaskParam(taskId);
    const title = options?.opsTaskTitle?.trim() || id;
    return {
      breadcrumb: title,
      title,
    };
  }

  if (page && taskId) {
    const party = partyTaskPageDef(page);
    if (party) {
      decodeTaskParam(taskId);
      if (page === "property-appraisal") {
        return {
          breadcrumb: "نافذة التقييم",
          title: "المقيم العقاري — نافذة التقييم",
        };
      }
      if (page === "active-survey") {
        return {
          breadcrumb: "مساحة العمل",
          title: "المكتب الهندسي — الرفع المساحي",
        };
      }
      return {
        breadcrumb: "مساحة العمل",
        title: party.workTitle,
      };
    }
  }

  if (parts[0] === "all-transactions" && taskId) {
    return {
      breadcrumb: "تنفيذ المعاملة",
      title: "تنفيذ المعاملة",
    };
  }

  if (parts[0] === "active-primary-data" && taskId) {
    decodeTaskParam(taskId);
    return {
      breadcrumb: "المعاملات النشطة / البيانات الأولية / تنفيذ المعاملة",
      title: "تنفيذ المعاملة",
    };
  }
  if (parts[0] === "active-distribution" && taskId) {
    decodeTaskParam(taskId);
    return {
      breadcrumb: "المعاملات النشطة / توزيع المعاملات / توزيع المعاملة",
      title: "توزيع المعاملة",
    };
  }
  if (parts[0] === "active-case-study" && taskId) {
    decodeTaskParam(taskId);
    return {
      breadcrumb: "المعاملات النشطة / دراسة حالة العقارات / دراسة حالة العقار",
      title: "دراسة حالة العقار",
    };
  }
  if (parts[0] === "case-study" && parts[1]) {
    decodeTaskParam(parts[1]);
    const deed = options?.deedLabel?.trim();
    return {
      breadcrumb: deed || "دراسة حالة العقار",
      title: "",
    };
  }
  return null;
}
