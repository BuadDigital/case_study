"use client";

import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@platform/ui-kit";
import { PropertyTimelineTones } from "@platform/api-client";
import {
  formatTimelineDate,
  type PropertyTimelineEvent,
  type PropertyTimelineTone,
} from "../../lib/app-data/property-detail-timeline";
import { formatDateAr } from "../../lib/app-data/po-intake-data";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import { usePropertyOrTransactionTimeline } from "../../query/use-transaction-query";
import { ltrValueClass } from "./PropertyDetailFields";
import { PartyStatusRows, SideCard, usePropertyPartyRows } from "./PropertyPartiesStatus";
import {
  FAILURES_CHANGED_EVENT,
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  TASKS_CHANGED_EVENT,
  WORK_ORDERS_CHANGED_EVENT,
} from "@platform/app-shared/events/app-events";

const EMPTY_EVENTS: PropertyTimelineEvent[] = [];

function toneToDotClass(tone: PropertyTimelineTone): string {
  if (tone === PropertyTimelineTones.Done) return "bg-ink";
  if (tone === PropertyTimelineTones.Active) return "bg-[#8c7857]";
  if (tone === PropertyTimelineTones.Warn) return "bg-danger";
  return "bg-[#8c7857]";
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

export function PropertyTransactionTimeline({
  record,
  property,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
}) {
  const poNumber = record.poNumber.trim();
  // A transaction with several deeds has one timeline for all of them.
  const { query: timelineQuery, invalidationKey } = usePropertyOrTransactionTimeline(poNumber, property);
  const queryClient = useQueryClient();

  const invalidateTimeline = () => {
    void queryClient.invalidateQueries({ queryKey: invalidationKey });
  };
  useWindowEvents({
    [TASKS_CHANGED_EVENT]: invalidateTimeline,
    [WORK_ORDERS_CHANGED_EVENT]: invalidateTimeline,
    [FAILURES_CHANGED_EVENT]: invalidateTimeline,
    [FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT]: invalidateTimeline,
  });

  // «حالة الأطراف» — the same rows the frame pages show under their rail, here with the names.
  const partyRows = usePropertyPartyRows(poNumber, property.id);

  const displayEvents = timelineQuery.data ?? EMPTY_EVENTS;

  return (
    <aside
      className="flex w-full min-w-0 max-w-[250px] shrink-0 flex-col gap-3 max-lg:max-w-none"
      aria-label="الجدول الزمني للمعاملة"
    >
      <SideCard title="حالة الأطراف">
        <PartyStatusRows rows={partyRows} />
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
                  {event.detail?.trim() ? (
                    <div className="line-clamp-3 text-[10.5px] leading-snug text-text-2">
                      {event.detail.trim()}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-x-2 text-[10px] text-text-3">
                    <span className="[direction:ltr] [unicode-bidi:isolate]">
                      {formatTimelineDate(event.at)}
                    </span>
                    {/* On a transaction timeline each event names the deed it happened on. */}
                    {event.deedLabel ? (
                      <span>
                        صك{" "}
                        <bdi dir="ltr" className={ltrValueClass}>
                          {event.deedLabel}
                        </bdi>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SideCard>
    </aside>
  );
}
