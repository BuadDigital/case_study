"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CASE_STUDY_FORM_STEPS,
  caseStudyFormSummary,
} from "../../lib/prototype/case-study-form-data";
import {
  loadCaseStudyFormDraft,
  type CaseStudyFormDraft,
  type CaseStudyFormStatus,
  type CaseStudyMeterType,
} from "../../lib/prototype/case-study-form-storage";
import { formatDateAr } from "../../lib/prototype/po-intake-data";
import {
  caseStudyTaskForProperty,
  taskPhaseLabel,
  taskStatusLabel,
} from "../../lib/prototype/tasks-storage";
import { caseStudyWorkspacePath } from "../../lib/my-task-routes";
import { useWorkflowTasksQuery } from "@case-study/mfe/query/case-study-queries";
import { Badge, cn, type BadgeTone } from "@platform/design-system";

function DetailField({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  if (!value || value === "—") return null;
  return (
    <div className="flex min-w-0 flex-col items-stretch gap-1">
      <span className="block w-full text-start text-[10px] font-semibold text-text-3">
        {label}
      </span>
      <span className="block w-full break-words text-start text-[13px] font-medium leading-snug text-text">
        {ltr ? (
          <bdi dir="ltr" className="inline isolate text-primary-mid">
            {value}
          </bdi>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

function formStatusLabel(status: CaseStudyFormStatus): string {
  if (status === "submitted") return "مرفوع";
  if (status === "draft") return "مسودة";
  return "جديد";
}

function meterTypeLabel(value: CaseStudyMeterType): string {
  if (value === "electronic") return "إلكتروني";
  if (value === "analog") return "تناظري";
  if (value === "none") return "لا يوجد";
  return "";
}

function currentStepLabel(draft: CaseStudyFormDraft): string {
  const step = CASE_STUDY_FORM_STEPS[draft.currentStep];
  return step ? `الخطوة ${step.id} — ${step.label}` : "—";
}

function taskBadgeTone(task: {
  status: string;
  phase: string;
}): BadgeTone {
  if (task.status === "completed" || task.phase === "done") return "success";
  if (task.status === "blocked") return "default";
  return "warning";
}

const linkButtonSmClass = cn(
  "inline-flex items-center justify-center gap-[5px] rounded-[var(--radius-DEFAULT)] border-[0.5px] border-solid font-normal whitespace-nowrap no-underline transition-[background,border-color] duration-150",
  "px-2 py-1 text-[11px]",
  "border-border-md bg-surface text-text hover:bg-surface-2",
);

export function PoDetailCaseStudySection({
  poNumber,
  propertyId,
}: {
  poNumber: string;
  propertyId: string;
}) {
  const { data: tasks } = useWorkflowTasksQuery();

  const task = useMemo(
    () => caseStudyTaskForProperty(poNumber, propertyId, tasks ?? []),
    [poNumber, propertyId, tasks],
  );

  const [draft, setDraft] = useState<CaseStudyFormDraft | null>(null);

  useEffect(() => {
    if (!task) {
      setDraft(null);
      return;
    }
    let cancelled = false;
    void loadCaseStudyFormDraft(task.id).then((loaded) => {
      if (!cancelled) setDraft(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [task?.id]);

  const summary = useMemo(
    () => (draft ? caseStudyFormSummary(draft.answers) : null),
    [draft],
  );

  if (!task) {
    return (
      <p className="m-0 text-xs text-text-3">
        لم تُنشأ بعد مهمة دراسة حالة لهذا العقار — تظهر بعد ربط الخانة
        بأمر العمل.
      </p>
    );
  }

  return (
    <>
      <DetailField label="حالة المهمة" value={taskStatusLabel(task.status)} />
      <DetailField label="المرحلة" value={taskPhaseLabel(task.phase)} />
      <DetailField label="الأخصائي" value={task.assigneeName} />
      {draft ? (
        <>
          <DetailField
            label="حالة النموذج"
            value={formStatusLabel(draft.status)}
          />
          <DetailField label="رقم الطلب" value={draft.requestNumber} ltr />
          <DetailField
            label="تاريخ الطلب"
            value={draft.requestDate ? formatDateAr(draft.requestDate) : ""}
          />
          <DetailField label="رقم الصك (النموذج)" value={draft.sigDeed} ltr />
          {summary ? (
            <DetailField
              label="تقدم الأسئلة"
              value={`${summary.answered} من ${summary.total} (${summary.pct}%)`}
            />
          ) : null}
          <DetailField label="الخطوة الحالية" value={currentStepLabel(draft)} />
          {draft.sigApprover.trim() ? (
            <DetailField label="المعتمد" value={draft.sigApprover} />
          ) : null}
          {meterTypeLabel(draft.meterType) ? (
            <DetailField
              label="نوع العداد"
              value={meterTypeLabel(draft.meterType)}
            />
          ) : null}
          {draft.meterNumber.trim() ? (
            <DetailField label="رقم العداد" value={draft.meterNumber} ltr />
          ) : null}
          {draft.savedAtUtc ? (
            <DetailField
              label="آخر حفظ"
              value={formatDateAr(draft.savedAtUtc.slice(0, 10))}
            />
          ) : null}
        </>
      ) : (
        <p className="m-0 text-xs text-text-3">
          لم يُبدأ نموذج دراسة الحالة بعد — افتح مسار دراسة حالة العقارات
          لإكماله.
        </p>
      )}
      <p className="mt-3">
        <Badge tone={taskBadgeTone(task)} className="me-2 text-[11px]">
          {task.phase === "case-study"
            ? "دراسة الحالة"
            : taskPhaseLabel(task.phase)}
        </Badge>
        <Link href={caseStudyWorkspacePath(task.id)} className={linkButtonSmClass}>
          فتح دراسة الحالة
        </Link>
      </p>
    </>
  );
}
