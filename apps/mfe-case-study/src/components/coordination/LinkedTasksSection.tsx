"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OperationsTaskDto } from "@platform/api-client";
import { Badge, Button, Note, sectionDomId, useToast } from "@platform/ui-kit";
import { filterOperationsTasksForProperty } from "../../lib/app-data/operations-task-property-scope";
import { operationsTaskStatusLabel } from "../../lib/app-data/operations-task-display";
import { operationsTaskPath } from "../../lib/my-task-routes";
import { usePoRecordsQuery } from "../../query/case-study-queries";
import { useOperationsTasksQuery } from "../../query/operations-tasks-queries";
import { useOperationsTaskStaff } from "../../query/use-operations-task-staff";
import {
  CreateOperationsTaskModal,
  preloadCreateOperationsTaskModal,
} from "../../views/OperationsTasksLazyModals";
import {
  ADDED_SURVEY_STATE_LABELS,
  ADDED_SURVEY_STATE_TONES,
  type AddedSurveyRow,
} from "../../views/operations-tasks-added-surveys";

/**
 * Whether an operations task still holds the transaction (Omar 2026-11-08): not cancelled and its
 * outputs not accepted by its creator — the server applies the same rule before «إرسال المعاملة للدراسة».
 */
export function linkedTaskHolds(task: Pick<OperationsTaskDto, "status" | "outputsAcceptedAt">): boolean {
  return task.status !== "cancelled" && !task.outputsAcceptedAt;
}

/**
 * «المهام المرتبطة» on the coordinator's page: the operations tasks on this deed (a government review,
 * a court visit, a re-shoot…) — a task not accepted yet holds the send to the study.
 *
 * How it works: the shared operations-task list scoped to the deed as the property pages scope it
 * (`filterOperationsTasksForProperty`); each row shows its state and whether it holds the send, and
 * opens the task (its creator accepts the outputs there). «إنشاء مهمة مرتبطة» opens «مهمة جديدة» as
 * a window over this page, its link fixed on this deed (Omar 2026-11-12); the new task then shows in
 * the list here.
 * Edge cases: a list that cannot load shows a note — the server still checks before sending. The
 * button used to leave for «المهام» with only the work order filled in, so the deed was picked by
 * hand and the coordinator ended away from his transaction.
 * «رفع مساحي» made from the window is the office's survey task, not an operations task: it is listed
 * here all the same (`addedSurveys`, Omar 2026-11-12 — the window closed and nothing showed, as if
 * nothing had been created), with where it stands, and its button opens the page's «المكتب الهندسي»
 * section where the office's work is received or the office skipped. It carries no «تمنع الإرسال»
 * mark: the send's wait for the office is that section's own.
 */
export function LinkedTasksSection({
  poNumber,
  deedNumber,
  deedLabel,
  addedSurveys = [],
  canCreate,
}: {
  poNumber: string;
  deedNumber: string;
  /** The deed as «مهمة جديدة» lists it (its display form); defaults to the deed number. */
  deedLabel?: string;
  /** The deed's surveys added after the distribution (`addedSurveysOfProperty`). */
  addedSurveys?: AddedSurveyRow[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const query = useOperationsTasksQuery({ live: true });
  const deedDisplay = deedLabel?.trim() || deedNumber.trim();
  const tasks = useMemo(
    () => filterOperationsTasksForProperty(query.data ?? [], { poNumber, deedNumber, deedDisplay }),
    [query.data, poNumber, deedNumber, deedDisplay],
  );
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-3 pt-3" data-testid="coordination-linked-tasks">
      <p className="m-0 text-[12.5px] text-text-2">
        المهام التشغيلية على هذا الصك أو أمر العمل. لا تُرسل المعاملة للدراسة حتى يقبل منشئ كل مهمة مخرجاتها أو تُلغى.
      </p>
      {query.isError ? <Note tone="warn">تعذّر تحميل المهام — يتحقق منها النظام عند الإرسال.</Note> : null}
      {tasks.length === 0 && addedSurveys.length === 0 && query.isFetched ? (
        <p className="m-0 text-[12px] text-text-3">لا توجد مهام مرتبطة.</p>
      ) : null}
      {addedSurveys.map(({ task, state }) => (
        <div
          key={task.id}
          data-testid="coordination-linked-survey"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[13px]"
        >
          <span className="font-bold text-heading">رفع مساحي</span>
          <span className="text-[12px] text-text-3">مضاف بعد التوزيع</span>
          <span className="font-semibold text-text">{task.assigneeName}</span>
          <Badge tone={ADDED_SURVEY_STATE_TONES[state]}>{ADDED_SURVEY_STATE_LABELS[state]}</Badge>
          <span className="flex-1" />
          <Button type="button" size="sm" variant="outline" onClick={() => openPageSection("survey")}>
            فتح قسم المكتب الهندسي
          </Button>
        </div>
      ))}
      {tasks.map((task) => {
        const holds = linkedTaskHolds(task);
        return (
          <div
            key={task.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[13px]"
          >
            <span className="font-mono text-[12px] text-text-3">{task.displayId}</span>
            <span className="font-bold text-heading">{task.title}</span>
            <Badge tone="default">{operationsTaskStatusLabel(task.status)}</Badge>
            {holds ? (
              <Badge tone="warning">تمنع الإرسال</Badge>
            ) : task.outputsAcceptedAt ? (
              <Badge tone="success">قُبلت مخرجاتها</Badge>
            ) : null}
            <span className="flex-1" />
            <Button type="button" size="sm" variant="outline" onClick={() => router.push(operationsTaskPath(task.id))}>
              فتح المهمة
            </Button>
          </div>
        );
      })}
      {canCreate ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onMouseEnter={preloadCreateOperationsTaskModal}
            onFocus={preloadCreateOperationsTaskModal}
            onClick={() => setCreating(true)}
          >
            إنشاء مهمة مرتبطة
          </Button>
        </div>
      ) : null}
      {creating ? (
        <LinkedTaskCreateWindow
          poNumber={poNumber.trim()}
          deed={deedDisplay}
          onClose={() => setCreating(false)}
          onCreated={() => {
            showToast("أُنشئت المهمة وارتبطت بهذا الصك", "success");
            void query.refetch();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Opens a section of the page this one sits on, and scrolls to it.
 *
 * How it works: the sections frame opens the section named by the address's `#work-…` part whenever
 * that part changes, so the jump is a change of it.
 * Edge cases: already on that part (the section was folded again by hand) — the change is announced
 * without changing anything, so the frame still opens it.
 */
function openPageSection(id: string): void {
  const hash = `#${sectionDomId(id)}`;
  if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else window.location.hash = hash;
}

/**
 * «مهمة جديدة» opened from the deed's page: the same form as «المهام», its link fixed on the deed.
 *
 * How it works: mounted only while open, so the work orders and the staff the form needs are read
 * on the click, not with the page; both come from the caches «المهام» fills.
 * Edge cases: the staff still loading or failing is the form's own notice.
 */
function LinkedTaskCreateWindow({
  poNumber,
  deed,
  onClose,
  onCreated,
}: {
  poNumber: string;
  deed: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: poRecords = [] } = usePoRecordsQuery();
  const { staffUsers, staffLoadError, staffLoading } = useOperationsTaskStaff();
  const prefill = useMemo(
    () => ({ type: "general", scope: "transaction", poNumber, deed, linkLocked: true }),
    [poNumber, deed],
  );
  return (
    <CreateOperationsTaskModal
      open
      poRecords={poRecords}
      staffUsers={staffUsers}
      staffLoadError={staffLoadError}
      staffLoading={staffLoading}
      prefill={prefill}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}
