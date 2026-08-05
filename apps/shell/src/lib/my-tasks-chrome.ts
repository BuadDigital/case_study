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
 * Workspace / task-detail topbar chrome.
 * Matches Case Study.html where known:
 * - appraisal: setHeader('المقيم العقاري — نافذة التقييم', crumb(['لوحة التحكم','تقييم العقار','نافذة التقييم']))
 * - survey: setHeader('المكتب الهندسي — الرفع المساحي', crumb(['لوحة التحكم','الرفع المساحي','مساحة العمل']))
 * - ops detail: setHeader(t.title, crumb(['لوحة التحكم','المهام',t.id]))
 * Other workspaces follow the same لوحة التحكم / {list} / مساحة العمل pattern.
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
        breadcrumb: "لوحة التحكم / الرفع المساحي / إدخال الرفع المساحي",
        title: "ابدأ الرفع المساحي",
      };
    }
    return {
      breadcrumb: "لوحة التحكم / الرفع المساحي / مساحة العمل",
      title: "المكتب الهندسي — الرفع المساحي",
    };
  }

  if (page === "property-appraisal" && parts[1]) {
    decodeTaskParam(parts[1]);
    return {
      breadcrumb: "لوحة التحكم / تقييم العقار / نافذة التقييم",
      title: "المقيم العقاري — نافذة التقييم",
    };
  }

  if (page === "active-inspection" && parts[1]) {
    decodeTaskParam(parts[1]);
    return {
      breadcrumb: "لوحة التحكم / معاينة العقار / مساحة العمل",
      title: "معاينة العقار",
    };
  }

  if (page === "property-inspection" && parts[1]) {
    decodeTaskParam(parts[1]);
    return {
      breadcrumb: "لوحة التحكم / معاينة العقار / مساحة العمل",
      title: "معاينة العقار",
    };
  }

  if (page === "government-review" && parts[1]) {
    decodeTaskParam(parts[1]);
    return {
      breadcrumb:
        "دراسة الحالة / المعاملات النشطة / المراجعة الحكومية / مساحة العمل",
      title: "المراجعة الحكومية",
    };
  }

  if (page === "operations-tasks" && taskId) {
    const id = decodeTaskParam(taskId);
    const title = options?.opsTaskTitle?.trim() || id;
    return {
      breadcrumb: `لوحة التحكم / المهام / ${id}`,
      title,
    };
  }

  if (page && taskId) {
    const party = partyTaskPageDef(page);
    if (party) {
      decodeTaskParam(taskId);
      if (page === "property-appraisal") {
        return {
          breadcrumb: "لوحة التحكم / تقييم العقار / نافذة التقييم",
          title: "المقيم العقاري — نافذة التقييم",
        };
      }
      if (page === "active-survey") {
        return {
          breadcrumb: "لوحة التحكم / الرفع المساحي / مساحة العمل",
          title: "المكتب الهندسي — الرفع المساحي",
        };
      }
      if (page === "government-review") {
        return {
          breadcrumb:
            "دراسة الحالة / المعاملات النشطة / المراجعة الحكومية / مساحة العمل",
          title: "المراجعة الحكومية",
        };
      }
      return {
        breadcrumb: `لوحة التحكم / ${party.breadcrumbTitle} / مساحة العمل`,
        title: party.workTitle,
      };
    }
  }

  if (parts[0] === "all-transactions" && taskId) {
    return {
      breadcrumb: "لوحة التحكم / جميع المعاملات / تنفيذ المعاملة",
      title: "تنفيذ المعاملة",
    };
  }

  if (parts[0] === "active-primary-data" && taskId) {
    decodeTaskParam(taskId);
    return {
      breadcrumb: "لوحة التحكم / البيانات الأولية / تنفيذ المعاملة",
      title: "تنفيذ المعاملة",
    };
  }
  if (parts[0] === "active-distribution" && taskId) {
    decodeTaskParam(taskId);
    return {
      breadcrumb: "لوحة التحكم / توزيع المعاملات / توزيع المعاملة",
      title: "توزيع المعاملة",
    };
  }
  if (parts[0] === "active-case-study" && taskId) {
    decodeTaskParam(taskId);
    return {
      breadcrumb: "لوحة التحكم / دراسة حالة العقارات / تنفيذ المعاملة",
      title: "دراسة حالة العقار",
    };
  }
  if (parts[0] === "case-study" && parts[1]) {
    decodeTaskParam(parts[1]);
    const deed = options?.deedLabel?.trim();
    return {
      breadcrumb: deed
        ? `دراسة الحالة / المعاملات النشطة / دراسة حالة العقار / ${deed}`
        : "",
      title: "",
    };
  }
  return null;
}
