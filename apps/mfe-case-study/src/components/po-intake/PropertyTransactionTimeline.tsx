"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { cn } from "@platform/design-system";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  buildPropertyDetailTimeline,
  formatTimelineDate,
  type PropertyTimelineTone,
} from "../../lib/prototype/property-detail-timeline";
import { buildPropertyDetailTimelinePartyRows } from "../../lib/prototype/property-detail-parties";
import { formatDateAr } from "../../lib/prototype/po-intake-data";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/prototype/po-intake-data";
import { caseStudyTaskForProperty } from "../../lib/prototype/tasks-storage";
import { TASKS_CHANGED_EVENT } from "../../query/case-study-queries";
import { usePropertyTimelineQuery } from "../../query/use-property-timeline-query";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { WORK_ORDERS_CHANGED_EVENT } from "../../lib/work-orders-api-config";
import { FAILURES_CHANGED_EVENT } from "@failures/mfe/lib/failures-events";
import { DetailBadge, ltrValueClass } from "./PropertyDetailFields";
function toneToDotClass(tone: PropertyTimelineTone): string {
  if (tone === "done") return "bg-success";
  if (tone === "active") return "bg-warning";
  if (tone === "warn") return "bg-danger";
  return "bg-text-3";
}

function badgeToneFromClass(
  badgeClass: string,
): "teal" | "amber" | "red" | "gray" {
  if (badgeClass.includes("teal")) return "teal";
  if (badgeClass.includes("amber")) return "amber";
  if (badgeClass.includes("red")) return "red";
  return "gray";
}

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function PropertyTransactionTimeline({
  record,
  property,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
}) {
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const poNumber = record.poNumber.trim();
  const timelineQuery = usePropertyTimelineQuery(poNumber, property.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.propertyTimeline(poNumber, property.id),
      });
    };
    window.addEventListener(TASKS_CHANGED_EVENT, invalidate);
    window.addEventListener(WORK_ORDERS_CHANGED_EVENT, invalidate);
    window.addEventListener(FAILURES_CHANGED_EVENT, invalidate);
    return () => {
      window.removeEventListener(TASKS_CHANGED_EVENT, invalidate);
      window.removeEventListener(WORK_ORDERS_CHANGED_EVENT, invalidate);
      window.removeEventListener(FAILURES_CHANGED_EVENT, invalidate);
    };
  }, [queryClient, poNumber, property.id]);

  const task = useMemo(
    () => caseStudyTaskForProperty(poNumber, property.id, tasks),
    [poNumber, property.id, tasks],
  );

  const partyRows = useMemo(
    () =>
      buildPropertyDetailTimelinePartyRows({
        task: task ?? null,
        allTasks: tasks,
        staffUsers,
      }),
    [task, tasks, staffUsers],
  );

  const displayEvents = useMemo(() => {
    const fromApi = timelineQuery.data ?? [];
    const events =
      fromApi.length > 0
        ? fromApi
        : buildPropertyDetailTimeline({ record, property, tasks });
    return [...events].reverse();
  }, [timelineQuery.data, record, property, tasks]);

  return (
    <aside
      className="order-2 flex h-full min-h-0 min-w-0 w-full max-w-[240px] shrink-0 flex-col self-stretch overflow-x-hidden overflow-y-auto border-s border-border bg-surface px-3.5 py-4 max-lg:max-h-[360px] max-lg:w-full max-lg:border-s-0 max-lg:border-t"
      aria-label="الجدول الزمني للمعاملة"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium text-text-2">الجدول الزمني</span>
        <span className="inline-flex text-text-3" aria-hidden>
          <ClockIcon />
        </span>
      </div>

      {displayEvents.length === 0 ? (
        <p className="m-0 text-xs text-text-3">لا توجد أحداث مسجّلة بعد.</p>
      ) : (
        <div className="flex flex-col gap-0">
          {displayEvents.map((event, index) => (
            <div key={event.id} className="flex gap-2.5">
              <div className="flex w-3.5 shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "z-[1] mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    toneToDotClass(event.tone),
                  )}
                  aria-hidden
                />
                {index < displayEvents.length - 1 ? (
                  <span
                    className="min-h-3.5 w-px flex-1 bg-border"
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pb-4">
                <div className="mb-0.5 text-xs leading-snug text-text">
                  {event.title}
                </div>
                <div className="text-[11px] text-text-3 [direction:ltr] [unicode-bidi:isolate]">
                  {formatTimelineDate(event.at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <hr className="my-3 border-0 border-t border-border" />
      <div className="mb-2 text-[10px] font-medium tracking-wide text-text-3 uppercase">
        حالة الأطراف
      </div>
      {partyRows.map((row) => (
        <div
          key={row.label}
          className="flex min-w-0 items-center justify-between gap-2 border-b border-border py-1.5 last:border-b-0"
        >
          <span className="min-w-0 truncate text-[11px] text-text-2">
            {row.label}
          </span>
          <DetailBadge
            tone={badgeToneFromClass(row.badgeClass)}
            className="px-1.5 py-px text-[10px]"
          >
            {row.badge}
          </DetailBadge>
        </div>
      ))}

      <hr className="my-3 border-0 border-t border-border" />
      <div className="mb-2 text-[10px] font-medium tracking-wide text-text-3 uppercase">
        مواعيد مهمة
      </div>
      <div className="mt-0.5 flex flex-col gap-1.5">
        <div className="flex justify-between text-[11px] text-text-2">
          <span>الاستحقاق</span>
          <span className="font-medium text-danger-text">
            {record.dueDateAt ? (
              <bdi dir="ltr" className={ltrValueClass}>
                {formatDateAr(record.dueDateAt)}
              </bdi>
            ) : (
              "—"
            )}
          </span>
        </div>
        <div className="flex justify-between text-[11px] text-text-2">
          <span>استلام إنفاذ</span>
          <span>
            {record.receivedFromEnfathAt ? (
              <bdi dir="ltr" className={ltrValueClass}>
                {formatDateAr(record.receivedFromEnfathAt)}
              </bdi>
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>
    </aside>
  );
}
