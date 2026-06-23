import { getPropertyFailure } from "@failures/mfe";
import { failureStatusLabel } from "@failures/mfe/lib/failures-labels";
import { formatDateAr } from "./po-intake-data";
import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-data";
import { getSuspendedTransaction } from "./suspended-transactions-storage";
import {
  caseStudyTaskForProperty,
  taskPhaseLabel,
  type WorkflowTask,
} from "./tasks-storage";

export type PropertyTimelineTone = "done" | "active" | "warn" | "muted";

export type PropertyTimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  tone: PropertyTimelineTone;
};

function pushEvent(
  list: PropertyTimelineEvent[],
  event: PropertyTimelineEvent,
): void {
  if (list.some((e) => e.id === event.id)) return;
  list.push(event);
}

export function buildPropertyDetailTimeline(input: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  tasks: WorkflowTask[];
}): PropertyTimelineEvent[] {
  const { record, property, tasks } = input;
  const events: PropertyTimelineEvent[] = [];
  const po = record.poNumber.trim();

  if (record.receivedFromEnfathAt) {
    pushEvent(events, {
      id: "enfath",
      at: record.receivedFromEnfathAt,
      title: "استلام من إنفاذ",
      detail: record.assignmentSpecialist
        ? `أخصائي الإسناد: ${record.assignmentSpecialist}`
        : undefined,
      tone: "done",
    });
  }

  const task = caseStudyTaskForProperty(po, property.id, tasks);
  if (task) {
    pushEvent(events, {
      id: `task-${task.id}`,
      at: task.updatedAt ?? record.receivedFromEnfathAt ?? "",
      title: "إنشاء مهمة العقار",
      detail: taskPhaseLabel(task.phase),
      tone: task.status === "completed" ? "done" : "active",
    });

    if (task.phase !== "enfath" && task.phase !== "bourse") {
      pushEvent(events, {
        id: "bourse-done",
        at: task.updatedAt ?? "",
        title: "اكتمال استعلام البورصة",
        tone: "done",
      });
    }

    if (
      task.phase === "distribution" ||
      task.phase === "case-study" ||
      task.phase === "done"
    ) {
      pushEvent(events, {
        id: "distribution",
        at: task.updatedAt ?? "",
        title: "توزيع المعاملة",
        tone: task.phase === "distribution" ? "active" : "done",
      });
    }

    if (task.phase === "case-study" || task.phase === "done") {
      pushEvent(events, {
        id: "case-study",
        at: task.updatedAt ?? "",
        title: "دراسة حالة العقار",
        detail: task.assigneeName,
        tone: task.phase === "case-study" ? "active" : "done",
      });
    }

    if (task.status === "blocked" || task.phase === "obstruction") {
      pushEvent(events, {
        id: "blocked",
        at: task.updatedAt ?? "",
        title: "تعذر / إيقاف",
        detail: task.obstructionReason,
        tone: "warn",
      });
    }
  }

  if (property.bourseDataCompleted) {
    pushEvent(events, {
      id: "property-bourse",
      at: record.receivedFromEnfathAt ?? "",
      title: "بيانات البورصة للعقار",
      detail: [property.city, property.district].filter(Boolean).join(" · "),
      tone: "done",
    });
  }

  const failure = getPropertyFailure(po, property.id);
  if (failure) {
    pushEvent(events, {
      id: `failure-${failure.id}`,
      at: failure.updatedAt,
      title: "تسجيل تعذر",
      detail: `${failure.title} — ${failureStatusLabel(failure.status)}`,
      tone: failure.status === "approved" ? "warn" : "active",
    });
  }

  const suspended = getSuspendedTransaction(po, property.id);
  if (suspended) {
    pushEvent(events, {
      id: `suspended-${suspended.id}`,
      at: suspended.suspendedAt,
      title: "تعليق المعاملة",
      detail: suspended.supervisorNote || suspended.suspendedBy,
      tone: "warn",
    });
  }

  if (record.dueDateAt) {
    pushEvent(events, {
      id: "due",
      at: record.dueDateAt,
      title: "موعد الاستحقاق",
      tone: "muted",
    });
  }

  return events
    .filter((e) => e.at)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e) => ({
      ...e,
      detail: e.detail?.trim() || undefined,
    }));
}

export function formatTimelineDate(iso: string): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  return formatDateAr(day);
}
