"use client";

import { useMemo, type ReactNode } from "react";
import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";
import { useQueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  cn,
  opsPanelCard,
} from "@platform/ui-kit";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { PropertyTimelineTones } from "@platform/api-client";
import {
  buildPropertyDetailTimeline,
  formatTimelineDate,
  type PropertyTimelineTone,
} from "../../lib/app-data/property-detail-timeline";
import { buildPropertyDetailTimelinePartyRows } from "../../lib/app-data/property-detail-parties";
import { formatDateAr } from "../../lib/app-data/po-intake-data";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import { caseStudyTaskForProperty } from "../../lib/app-data/tasks-storage";
import { TASKS_CHANGED_EVENT } from "../../query/case-study-queries";
import { usePropertyTimelineQuery } from "../../query/use-property-timeline-query";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { WORK_ORDERS_CHANGED_EVENT } from "../../lib/work-orders-api-config";
import { FAILURES_CHANGED_EVENT } from "@failures/mfe/lib/failures-events";
import { DetailBadge, ltrValueClass } from "./PropertyDetailFields";

function toneToDotClass(tone: PropertyTimelineTone): string {
  if (tone === PropertyTimelineTones.Done) return "bg-ink";
  if (tone === PropertyTimelineTones.Active) return "bg-[#8c7857]";
  if (tone === PropertyTimelineTones.Warn) return "bg-danger";
  return "bg-[#8c7857]";
}

function badgeToneFromClass(
  badgeClass: string,
): "teal" | "amber" | "red" | "gray" {
  if (badgeClass.includes("teal")) return "teal";
  if (badgeClass.includes("amber")) return "amber";
  if (badgeClass.includes("red")) return "red";
  return "gray";
}

/**
 * Ring fill = completion only.
 * "In progress" is status, not 50% work done — empty ring until completed.
 */
function partyRingProgress(badgeClass: string): number {
  if (badgeClass.includes("teal")) return 1;
  return 0;
}

function partyRingColor(badgeClass: string): string {
  if (badgeClass.includes("teal")) return "#3f8f5f";
  if (badgeClass.includes("amber")) return "#a4906f";
  return "#a4a6ad";
}

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SideCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn(opsPanelCard, "px-4 py-3.5")}>
      <div className="mb-3 flex items-center gap-1.5 text-[12.5px] font-bold text-heading">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function PartyRing({ progress, color }: { progress: number; color: string }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative h-6 w-6 shrink-0" aria-hidden>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        className="-rotate-90"
      >
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke="var(--border, #ece8df)"
          strokeWidth="3"
        />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c.toFixed(1)}
          strokeDashoffset={(c * (1 - progress)).toFixed(1)}
        />
      </svg>
    </span>
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

  const invalidateTimeline = () => {
    void queryClient.invalidateQueries({
      queryKey: appDataKeys.propertyTimeline(poNumber, property.id),
    });
  };
  useWindowEvents({
    [TASKS_CHANGED_EVENT]: invalidateTimeline,
    [WORK_ORDERS_CHANGED_EVENT]: invalidateTimeline,
    [FAILURES_CHANGED_EVENT]: invalidateTimeline,
  });

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
      className="flex w-full min-w-0 max-w-[250px] shrink-0 flex-col gap-3 max-lg:max-w-none"
      aria-label="الجدول الزمني للمعاملة"
    >
      <SideCard title="الجدول الزمني" icon={<ClockIcon />}>
        {displayEvents.length === 0 ? (
          <p className="m-0 text-xs text-text-3">لا توجد أحداث مسجّلة بعد.</p>
        ) : (
          <div className="flex flex-col">
            {displayEvents.map((event, index) => (
              <div
                key={event.id}
                className={cn(
                  "relative flex gap-2.5",
                  index < displayEvents.length - 1 && "pb-3.5",
                )}
              >
                <div className="flex w-[9px] shrink-0 flex-col items-center">
                  <span
                    className={cn(
                      "mt-[3px] h-[9px] w-[9px] shrink-0 rounded-full",
                      toneToDotClass(event.tone),
                    )}
                    aria-hidden
                  />
                  {index < displayEvents.length - 1 ? (
                    <span
                      className="mt-[3px] min-h-3.5 w-px flex-1 bg-border"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-semibold leading-snug text-text">
                    {event.title}
                  </div>
                  <div className="text-[10px] text-text-3 [direction:ltr] [unicode-bidi:isolate]">
                    {formatTimelineDate(event.at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SideCard>

      <SideCard title="حالة الأطراف">
        <div className="grid gap-[9px]">
          {partyRows.map((row) => (
            <div key={row.key} className="flex min-w-0 items-center gap-2">
              <PartyRing
                progress={partyRingProgress(row.badgeClass)}
                color={partyRingColor(row.badgeClass)}
              />
              <span
                className="min-w-0 flex-1 truncate text-[11.5px] text-text-2"
                title={row.role}
              >
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
        </div>
      </SideCard>

      <SideCard title="مواعيد مهمة">
        <div className="grid gap-[7px]">
          <div className="flex justify-between gap-2 text-[11.5px]">
            <span className="text-text-2">الاستحقاق</span>
            <span className="font-bold text-heading">
              {record.dueDateAt ? (
                <bdi dir="ltr" className={ltrValueClass}>
                  {formatDateAr(record.dueDateAt)}
                </bdi>
              ) : (
                "—"
              )}
            </span>
          </div>
          <div className="flex justify-between gap-2 text-[11.5px]">
            <span className="text-text-2">استلام إنفاذ</span>
            <span className="font-bold text-heading">
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
      </SideCard>
    </aside>
  );
}
