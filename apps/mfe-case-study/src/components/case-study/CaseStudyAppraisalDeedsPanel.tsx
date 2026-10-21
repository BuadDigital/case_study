"use client";

import { useMemo, useState } from "react";
import { InlineLoadingSkeleton, Note, cn } from "@platform/ui-kit";
import type { TransactionDeedDto, TransactionDetailDto } from "@platform/api-client";
import { CaseStudyAppraisalPanel } from "./CaseStudyAppraisalPanel";
import { transactionDeedLabel } from "../po-intake/TransactionDeedSwitcher";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import { usePoRecordQuery } from "../../query/case-study-queries";

/**
 * Phase 4 (decision 2026-10-19): the study is one per transaction, but every deed was
 * inspected on its own. The inspector-inputs step therefore shows one review per deed,
 * behind a deed picker; a one-deed transaction renders the plain panel.
 */
export function CaseStudyAppraisalDeedsPanel({
  property,
  poNumber,
  tasks,
  caseStudyTask,
  documentsEnabled,
  transaction,
}: {
  property: PoPropertyIntake;
  poNumber: string;
  tasks: WorkflowTask[];
  caseStudyTask: WorkflowTask;
  documentsEnabled: boolean;
  transaction: TransactionDetailDto | null | undefined;
}) {
  const deeds = useMemo(
    () => (transaction?.deeds ?? []).filter((d) => !d.isRemoved),
    [transaction],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentId =
    selectedId && deeds.some((d) => d.propertyId === selectedId) ? selectedId : property.id;

  if (deeds.length < 2) {
    return (
      <CaseStudyAppraisalPanel
        property={property}
        poNumber={poNumber}
        tasks={tasks}
        caseStudyTask={caseStudyTask}
        documentsEnabled={documentsEnabled}
      />
    );
  }

  return (
    <div className="pt-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <span className="text-[11.5px] font-bold text-text-2">معاينة كل صك:</span>
        {deeds.map((d) => {
          const active = d.propertyId === currentId;
          return (
            <button
              key={d.propertyId}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedId(d.propertyId)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors",
                active
                  ? "border-ink bg-ink text-white"
                  : "border-border bg-surface text-text-2 hover:border-border-md hover:text-heading",
              )}
              dir="ltr"
            >
              {transactionDeedLabel(d)}
            </button>
          );
        })}
      </div>
      {deeds.map((d) => {
        if (d.propertyId !== currentId) return null;
        if (d.propertyId === property.id) {
          return (
            <CaseStudyAppraisalPanel
              key={d.propertyId}
              property={property}
              poNumber={poNumber}
              tasks={tasks}
              caseStudyTask={caseStudyTask}
              documentsEnabled={documentsEnabled}
            />
          );
        }
        return (
          <SiblingDeedAppraisal
            key={d.propertyId}
            deed={d}
            tasks={tasks}
            documentsEnabled={documentsEnabled}
          />
        );
      })}
    </div>
  );
}

/** Another deed of the transaction: its own work order, property row and case-study parent task. */
function SiblingDeedAppraisal({
  deed,
  tasks,
  documentsEnabled,
}: {
  deed: TransactionDeedDto;
  tasks: WorkflowTask[];
  documentsEnabled: boolean;
}) {
  const { data: record, isPending, isError } = usePoRecordQuery(deed.poNumber);
  const siblingProperty = useMemo(
    () => record?.properties.find((p) => p.id === deed.propertyId) ?? null,
    [record, deed.propertyId],
  );
  const siblingTask = useMemo(
    () =>
      tasks.find(
        (t) =>
          t.kind === "case-study-property" &&
          t.propertyId === deed.propertyId &&
          t.status !== "cancelled",
      ) ?? null,
    [tasks, deed.propertyId],
  );

  if (isPending && !record) return <InlineLoadingSkeleton className="my-4" />;
  if (isError || !record || !siblingProperty) {
    return (
      <Note tone="warn" className="mt-4">
        تعذّر تحميل بيانات الصك {transactionDeedLabel(deed)}.
      </Note>
    );
  }
  if (!siblingTask) {
    return (
      <Note tone="warn" className="mt-4">
        لا توجد مهمة دراسة لهذا الصك — تُعرض معاينته من صفحة العقار.
      </Note>
    );
  }
  return (
    <CaseStudyAppraisalPanel
      property={siblingProperty}
      poNumber={record.poNumber}
      tasks={tasks}
      caseStudyTask={siblingTask}
      documentsEnabled={documentsEnabled}
    />
  );
}
