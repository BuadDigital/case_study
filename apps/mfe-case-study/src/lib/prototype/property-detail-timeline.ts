import { getPropertyFailure } from "@failures/mfe";
import { failureStatusLabel } from "@failures/mfe/lib/failures-labels";
import { formatInstantInRiyadh } from "./active-transactions-situation";
import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-data";
import { getSuspendedTransaction } from "./suspended-transactions-storage";
import {
  caseStudyTaskForProperty,
  taskPhaseLabel,
  type WorkflowTask,
} from "./tasks-storage";

import type { PropertyTimelineEventDto } from "@platform/api-client";

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

export function mapPropertyTimelineDtos(
  events: PropertyTimelineEventDto[],
): PropertyTimelineEvent[] {
  return events
    .filter((e) => e.at)
    .map((e) => ({
      id: e.id,
      at: e.at,
      title: e.title,
      detail: e.detail?.trim() || undefined,
      tone: normalizeTimelineTone(e.tone),
    }));
}

function normalizeTimelineTone(tone: string): PropertyTimelineTone {
  if (tone === "active" || tone === "warn" || tone === "muted") return tone;
  return "done";
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
    const taskCreatedAt = task.createdAt || task.updatedAt || "";
    const taskUpdatedAt = task.updatedAt || taskCreatedAt;

    pushEvent(events, {
      id: `task-${task.id}`,
      at: taskCreatedAt || record.receivedFromEnfathAt || "",
      title: "إنشاء مهمة العقار",
      detail: taskPhaseLabel(task.phase),
      tone: task.status === "completed" ? "done" : "active",
    });

    if (task.phase !== "enfath" && task.phase !== "bourse") {
      pushEvent(events, {
        id: "bourse-done",
        at: property.bourseDataCompleted
          ? record.receivedFromEnfathAt || taskUpdatedAt
          : taskUpdatedAt,
        title: "اكتمال استعلام البورصة",
        tone: "done",
      });
    }

    if (
      task.phase === "distribution" ||
      task.phase === "case-study" ||
      task.phase === "done"
    ) {
      const children = tasks.filter((t) => t.parentTaskId === task.id);
      const distributionDone =
        children.length > 0 &&
        children.every((c) => c.status === "completed");
      pushEvent(events, {
        id: "distribution",
        at: taskUpdatedAt,
        title: "توزيع المعاملة",
        tone: distributionDone ? "done" : "active",
      });
    }

    if (task.phase === "case-study" || task.phase === "done") {
      pushEvent(events, {
        id: "case-study",
        at: taskUpdatedAt,
        title: "دراسة حالة العقار",
        detail: task.assigneeName,
        tone:
          task.status === "completed" || task.phase === "done" ? "done" : "active",
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
      tone: "warn",
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
  return formatInstantInRiyadh(iso);
}
