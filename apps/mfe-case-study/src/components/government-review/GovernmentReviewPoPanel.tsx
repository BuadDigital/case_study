"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  cn,
  workspaceStickyPanelMaxHClassName,
} from "@platform/design-system";
import { PoNumber } from "../ui/PoNumber";
import { InternalDelegationLetterPanel } from "./InternalDelegationLetterPanel";
import type { GovernmentReviewPoRow } from "../../lib/prototype/government-review-po";
import { courtGroupsForPo } from "../../lib/prototype/government-review-po";
import {
  delegationLetterForCourt,
  hydrateInternalDelegationLetters,
  syncInternalDelegationLetters,
} from "../../lib/prototype/internal-delegation-letters";
import {
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
} from "../../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { usePoRecordsQuery } from "../../query/case-study-queries";

function PanelSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-DEFAULT border border-border bg-surface-2/30">
      <div className="border-b border-border px-3.5 py-2.5">
        <h3 className="m-0 text-[12px] font-semibold text-text">{title}</h3>
        {subtitle ? (
          <p className="m-0 mt-0.5 text-[10px] leading-relaxed text-text-3">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </section>
  );
}

function ChevronStartIcon() {
  return (
    <svg
      className="size-3.5 shrink-0 text-text-3 opacity-60"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M10 12 6 8l4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function reviewTaskPropertyLabel(
  task: WorkflowTask,
  record: PoIntakeRecord | undefined,
): string {
  const property = record?.properties.find((p) => p.id === task.propertyId);
  if (property) {
    return (
      formatPropertyDeedDisplay(property) ||
      property.ownerName?.trim() ||
      `عقار ${task.propertyOrdinal}`
    );
  }
  const deedFromTitle = task.title.split(" — ").slice(1).join(" — ").trim();
  return deedFromTitle || `عقار ${task.propertyOrdinal}`;
}

export function GovernmentReviewPoPanel({
  row,
  onClose,
  onRefresh,
  onOpenTask,
}: {
  row: GovernmentReviewPoRow;
  onClose: () => void;
  onRefresh: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { data: poRecords = [] } = usePoRecordsQuery();
  const record = useMemo(
    () => poRecords.find((r) => r.poNumber.trim() === row.poNumber.trim()),
    [poRecords, row.poNumber],
  );
  const [, bump] = useState(0);
  const refreshLetters = useCallback(() => bump((n) => n + 1), []);

  useEffect(() => {
    if (!record) return;
    void hydrateInternalDelegationLetters(record.poNumber)
      .then(() => {
        syncInternalDelegationLetters(record);
        refreshLetters();
      })
      .catch((err: unknown) => {
        console.warn("Delegation letters hydrate failed:", err);
      });
  }, [record, refreshLetters]);

  const courtGroups = useMemo(
    () => courtGroupsForPo(record, row.courts),
    [record, row.courts],
  );

  const circuits = useMemo(() => {
    if (!record) return [];
    const courtSet = new Set(row.courts.map((c) => c.trim()));
    const values = new Set<string>();
    for (const property of record.properties) {
      if (!courtSet.has(property.court.trim())) continue;
      const circuit = property.circuit.trim();
      if (circuit) values.add(circuit);
    }
    return [...values].sort((a, b) => a.localeCompare(b, "ar"));
  }, [record, row.courts]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        workspaceStickyPanelMaxHClassName,
      )}
    >
      <div className="shrink-0 border-b border-border bg-linear-to-b from-surface-2/80 to-surface px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <PoNumber
              value={row.poNumber}
              className="text-[15px] font-bold text-primary"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone="default" className="text-[10px]">
                {row.assignmentType}
              </Badge>
              <Badge tone="info" className="text-[10px]">
                {row.propertyCount}{" "}
                {row.propertyCount === 1 ? "عقار" : "عقارات"}
              </Badge>
              {row.openCount > 0 ? (
                <Badge tone="warning" className="text-[10px]">
                  {row.openCount} مهمة مفتوحة
                </Badge>
              ) : (
                <Badge tone="success" className="text-[10px]">
                  كل المهام منجزة
                </Badge>
              )}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="size-8 shrink-0 rounded-full p-0 text-text-3 hover:bg-surface-3 hover:text-text"
            onClick={onClose}
            aria-label="إغلاق اللوحة"
          >
            ✕
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        <PanelSection title="ملخص أمر العمل">
          <div className="flex flex-col gap-2.5">
            <div
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-[12px]",
                row.primaryDataReady
                  ? "border-success/30 bg-success-light/50 text-success-text"
                  : "border-warning/30 bg-warning-light/50 text-warning-text",
              )}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  row.primaryDataReady ? "bg-success" : "bg-warning",
                )}
                aria-hidden
              />
              <span className="font-medium">{row.primaryDataLabel}</span>
            </div>
            {row.courts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1.5 text-[10px] font-medium text-text-3">
                    المحاكم
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.courts.map((court) => (
                      <span
                        key={court}
                        className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] text-text-2"
                      >
                        {court}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-[10px] font-medium text-text-3">
                    الدوائر
                  </div>
                  {circuits.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {circuits.map((circuit) => (
                        <span
                          key={circuit}
                          className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] text-text-2"
                        >
                          {circuit}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="m-0 text-[11px] text-text-3">—</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="m-0 text-[11px] leading-relaxed text-text-3">
                لا توجد محاكم مسجّلة بعد في بيانات العقارات.
              </p>
            )}
          </div>
        </PanelSection>

        <PanelSection
          title="مهام المراجعة"
          subtitle="حسب العقار — اضغط لفتح مهمة المراجعة"
        >
          {row.tasks.length === 0 ? (
            <p className="m-0 text-[11px] text-text-3">
              لا توجد مهام مراجعة مرتبطة بهذا الأمر.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {row.tasks.map((task) => {
                const isOpen = task.status === "open";
                const property = record?.properties.find(
                  (p) => p.id === task.propertyId,
                );
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      className={cn(
                        "group flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2.5 text-start transition-colors",
                        "hover:border-primary/40 hover:bg-primary-light/30",
                      )}
                      onClick={() => onOpenTask(task.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold text-text">
                          {reviewTaskPropertyLabel(task, record)}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-text-3">
                          مراجعة حكومية
                          {property?.court
                            ? ` · ${property.court.trim()}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={isOpen ? "warning" : "success"}>
                          {isOpen ? "مفتوحة" : "منجزة"}
                        </Badge>
                        <ChevronStartIcon />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelSection>

        {record
          ? courtGroups.map((group) => {
              const letter = delegationLetterForCourt(
                row.poNumber,
                group.court,
                record,
              );
              if (!letter) return null;
              return (
                <InternalDelegationLetterPanel
                  key={group.court}
                  letter={letter}
                  record={record}
                  onRefresh={() => {
                    refreshLetters();
                    onRefresh();
                  }}
                />
              );
            })
          : null}
      </div>
    </div>
  );
}
