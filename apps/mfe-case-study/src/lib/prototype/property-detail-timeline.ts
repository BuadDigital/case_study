import {
  failuresForProperty,
  getCachedFailuresList,
} from "@failures/mfe";
import { failureStatusLabel } from "@failures/mfe/lib/failures-labels";
import { formatInstantInRiyadh } from "./active-transactions-situation";
import type { PoIntakeRecord, PoPropertyIntake } from "./po-intake-data";
import { getSuspendedTransaction } from "./suspended-transactions-storage";
import {
  caseStudyTaskForProperty,
  taskPhaseLabel,
  type WorkflowTask,
} from "./tasks-storage";

import {
  normalizePropertyTimelineTone,
  PropertyTimelineTones,
  type PropertyTimelineEventDto,
  type PropertyTimelineTone,
} from "@platform/api-client";

export type { PropertyTimelineTone };

export type PropertyTimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  tone: PropertyTimelineTone;
};

const FAILURE_REGISTRATION_TITLE = "تسجيل تعذر";

function isFailureRegistrationTitle(title: string): boolean {
  const t = title.trim();
  return (
    t === FAILURE_REGISTRATION_TITLE ||
    /^تسجيل تعذر\s*\(\s*\d+\s*[x×]\s*\)$/i.test(t) ||
    /^تسجيل تعذر\s*\(\s*[x×]\s*\d+\s*\)$/i.test(t)
  );
}

export function formatFailureRegistrationTitle(count: number): string {
  if (count <= 1) return FAILURE_REGISTRATION_TITLE;
  return `${FAILURE_REGISTRATION_TITLE} (${count}×)`;
}

function pushEvent(
  list: PropertyTimelineEvent[],
  event: PropertyTimelineEvent,
): void {
  if (list.some((e) => e.id === event.id)) return;
  list.push(event);
}

/** Collapse multiple «تسجيل تعذر» rows into one titled «تسجيل تعذر (N×)». */
export function collapseFailureRegistrationEvents(
  events: PropertyTimelineEvent[],
): PropertyTimelineEvent[] {
  const failures = events.filter((e) => isFailureRegistrationTitle(e.title));
  if (failures.length <= 1) {
    return events.map((e) =>
      isFailureRegistrationTitle(e.title)
        ? { ...e, title: FAILURE_REGISTRATION_TITLE }
        : e,
    );
  }

  const rest = events.filter((e) => !isFailureRegistrationTitle(e.title));
  const sorted = [...failures].sort((a, b) => a.at.localeCompare(b.at));
  const latest = sorted[sorted.length - 1]!;
  const details = sorted
    .map((e) => e.detail?.trim())
    .filter((d): d is string => Boolean(d));
  const uniqueDetails = [...new Set(details)];

  rest.push({
    id: "failure-registrations",
    at: latest.at,
    title: formatFailureRegistrationTitle(failures.length),
    detail:
      uniqueDetails.length === 0
        ? undefined
        : uniqueDetails.length === 1
          ? uniqueDetails[0]
          : `${failures.length} تعذرات — أحدثها: ${uniqueDetails[uniqueDetails.length - 1]}`,
    tone: PropertyTimelineTones.Warn,
  });

  return rest
    .filter((e) => e.at)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function mapPropertyTimelineDtos(
  events: PropertyTimelineEventDto[],
): PropertyTimelineEvent[] {
  const mapped = events
    .filter((e) => e.at)
    .map((e) => ({
      id: e.id,
      at: e.at,
      title: e.title,
      detail: e.detail?.trim() || undefined,
      tone: normalizePropertyTimelineTone(e.tone),
    }));
  return collapseFailureRegistrationEvents(mapped);
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
      tone: PropertyTimelineTones.Done,
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
        tone: task.status === "completed" ? PropertyTimelineTones.Done : PropertyTimelineTones.Active,
    });

    if (task.phase !== "enfath" && task.phase !== "bourse") {
      pushEvent(events, {
        id: "bourse-done",
        at: property.bourseDataCompleted
          ? record.receivedFromEnfathAt || taskUpdatedAt
          : taskUpdatedAt,
        title: "اكتمال استعلام البورصة",
        tone: PropertyTimelineTones.Done,
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
        tone: distributionDone ? PropertyTimelineTones.Done : PropertyTimelineTones.Active,
      });
    }

    if (task.phase === "case-study" || task.phase === "done") {
      pushEvent(events, {
        id: "case-study",
        at: taskUpdatedAt,
        title: "دراسة حالة العقار",
        detail: task.assigneeName,
        tone:
          task.status === "completed" || task.phase === "done"
            ? PropertyTimelineTones.Done
            : PropertyTimelineTones.Active,
      });
    }

    if (task.status === "blocked" || task.phase === "obstruction") {
      pushEvent(events, {
        id: "blocked",
        at: task.updatedAt ?? "",
        title: "تعذر / إيقاف",
        detail: task.obstructionReason,
        tone: PropertyTimelineTones.Warn,
      });
    }
  }

  if (property.bourseDataCompleted) {
    pushEvent(events, {
      id: "property-bourse",
      at: record.receivedFromEnfathAt ?? "",
      title: "بيانات البورصة للعقار",
      detail: [property.city, property.district].filter(Boolean).join(" · "),
      tone: PropertyTimelineTones.Done,
    });
  }

  const propertyFailures = failuresForProperty(getCachedFailuresList(), {
    poNumber: po,
    propertyId: property.id,
    deedNumber: property.deedNumber,
  });
  for (const failure of propertyFailures) {
    pushEvent(events, {
      id: `failure-${failure.id}`,
      at: failure.createdAt || failure.updatedAt,
      title: FAILURE_REGISTRATION_TITLE,
      detail: `${failure.title} — ${failureStatusLabel(failure.status)}`,
      tone: PropertyTimelineTones.Warn,
    });
  }

  const suspended = getSuspendedTransaction(po, property.id);
  if (suspended) {
    const suspendDetail = [suspended.supervisorNote, suspended.suspendedBy]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" — ");
    pushEvent(events, {
      id: `suspended-${suspended.id}`,
      at: suspended.suspendedAt,
      title: "تعليق المعاملة",
      detail: suspendDetail || undefined,
      tone: PropertyTimelineTones.Warn,
    });
  }

  if (record.dueDateAt) {
    pushEvent(events, {
      id: "due",
      at: record.dueDateAt,
      title: "موعد الاستحقاق",
      tone: PropertyTimelineTones.Muted,
    });
  }

  return collapseFailureRegistrationEvents(
    events
      .filter((e) => e.at)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((e) => ({
        ...e,
        detail: e.detail?.trim() || undefined,
      })),
  );
}

export function formatTimelineDate(iso: string): string {
  return formatInstantInRiyadh(iso);
}
