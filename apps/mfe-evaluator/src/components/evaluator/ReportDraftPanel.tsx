"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, cn, opsFldControl, promptAction, useToast } from "@platform/ui-kit";
import {
  reopenReportIssuance,
  saveReportDraftChoices,
  sendReportDraft,
  withdrawReportDraft,
  type ValuationReportDraftDto,
} from "@platform/api-client";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";
import type { EvaluatorReportDraftPanelProps } from "@platform/app-shared/party-appraisal/evaluator-runtime-bridge";
import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";
import { usePropertyDetailDocuments } from "../../lib/case-study-bridge";
import { findSiblingInspectionTask } from "../../lib/evaluator/evaluator-inspection-gate";
import { findSiblingSurveyTask } from "../../lib/evaluator/evaluator-readiness";
import { fetchEvaluatorSubmission } from "../../lib/evaluator/evaluator-submission-reads";
import { normalizeReportChoices } from "../../lib/evaluator/evaluator-window-data";
import {
  overlayFromDraft,
  pickSpecialistChoices,
  type SpecialistReportChoices,
} from "../../lib/evaluator/report-draft-choices";
import {
  buildValuationPrintAttachmentRows,
  resolvePrintAttachmentOrder,
} from "../../lib/evaluator/valuation-report-property-attachments";
import { FinalReportDownload } from "./FinalReportDownload";
import { ValCard } from "./EvaluatorHtmlPrimitives";
import { ValuationReportAttachmentsEditor } from "./ValuationReportAttachmentsEditor";
import { reportDraftKey, useReportDraftByProperty, useSetReportDraft } from "./useReportDraft";
import { apiConfig } from "./valuation-work/lib/shell-utils";

const AUTOSAVE_MS = 800;

const STATUS_LABEL: Record<string, string> = {
  none: "لم تبدأ",
  preparing: "قيد الإعداد",
  sent: "بانتظار اعتماد المقيّم",
  approved: "اعتمدها المقيّم",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA").replace(/-/g, "/");
}

/**
 * The case specialist's workspace for the valuation-report draft: after the appraiser hands his package
 * over, he fills the report choices he owns (the print attachments; the appraiser's own ESG is his), confirms the valuation matches the
 * property study, and sends the draft to the appraiser — who approves it (or he withdraws it).
 * Read-only for everyone else.
 */
export function ReportDraftPanel({
  appraisalTask,
  allTasks,
  property,
  canEdit,
}: EvaluatorReportDraftPanelProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const propertyId = appraisalTask.propertyId ?? property.id;
  const draftQuery = useReportDraftByProperty(propertyId);
  const setDraft = useSetReportDraft(propertyId);
  const draft = draftQuery.data ?? null;

  const submissionQuery = useQuery({
    queryKey: ["evaluator-submission-preview", appraisalTask.id],
    staleTime: 30_000,
    queryFn: () => fetchEvaluatorSubmission(appraisalTask.id),
  });

  const editable =
    canEdit && draft != null && (draft.status === "preparing" || (draft.status === "none" && draft.canPrepare));

  // ---- the specialist's working copy of his choices ----
  const [choices, setChoices] = useState<SpecialistReportChoices | null>(null);
  const [conformity, setConformity] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const seededRef = useRef(false);
  const dirtyRef = useRef(false);
  // The same fact for rendering (a ref cannot be read while rendering): an edit waits for the debounced save.
  const [pendingSave, setPendingSave] = useState(false);

  // Seed once: his saved overlay over what the appraiser filled, so nothing starts blank.
  useEffect(() => {
    if (seededRef.current || !draft || submissionQuery.isPending) return;
    seededRef.current = true;
    const appraiserChoices = normalizeReportChoices(
      (submissionQuery.data as { reportChoices?: unknown } | null | undefined)?.reportChoices,
    );
    setChoices(
      pickSpecialistChoices(
        normalizeReportChoices({ ...appraiserChoices, ...(overlayFromDraft(draft) ?? {}) }),
      ),
    );
    setNote(draft.specialistNote ?? "");
  }, [draft, submissionQuery.isPending, submissionQuery.data]);

  const patchChoices = useCallback((patch: Partial<SpecialistReportChoices>) => {
    dirtyRef.current = true;
    setPendingSave(true);
    setConformity(false);
    setChoices((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const persist = useCallback(
    async (next: SpecialistReportChoices): Promise<ValuationReportDraftDto | null> => {
      const config = apiConfig();
      if (!config || !draft) return null;
      setSaveState("saving");
      const res = await saveReportDraftChoices(config, draft.valuationRequestId, next);
      if (!res.ok) {
        setSaveState("error");
        showToast(res.message ?? "تعذّر حفظ خيارات التقرير", "error");
        return null;
      }
      dirtyRef.current = false;
      setPendingSave(false);
      setSaveState("saved");
      setDraft(res.data);
      return res.data;
    },
    [draft, setDraft, showToast],
  );

  // Debounced autosave while he edits.
  useEffect(() => {
    if (!editable || !choices || !dirtyRef.current) return;
    const timer = setTimeout(() => void persist(choices), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [choices, editable, persist]);

  // ---- print attachment rows (property documents → report attachments) ----
  const { data: valuationLists } = useValuationListsQuery();
  const attachmentCatalog = useMemo(
    () =>
      (valuationLists?.lists?.attachments ?? [])
        .filter((r) => r.isEnabled)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => ({ key: r.key, name: r.name, isRequired: r.isRequired })),
    [valuationLists],
  );
  const inspectionTaskId =
    appraisalTask.fieldInspectionTaskId?.trim() ||
    findSiblingInspectionTask(appraisalTask, allTasks)?.id ||
    null;
  const surveyTaskId = findSiblingSurveyTask(appraisalTask, allTasks)?.id ?? null;
  const documentSections = usePropertyDetailDocuments({
    property,
    showDecree: true,
    poNumber: appraisalTask.poNumber,
    surveyTaskId,
    appraisalTaskId: appraisalTask.id,
    inspectionTaskId,
    enabled: Boolean(property.id),
  });
  const propertyDocuments = useMemo(
    () => documentSections.flatMap((s) => s.documents),
    [documentSections],
  );
  const printRows = useMemo(
    () =>
      buildValuationPrintAttachmentRows({
        catalog: attachmentCatalog,
        documents: propertyDocuments,
        selectedKeys: choices?.printAttachmentKeys,
      }),
    [attachmentCatalog, choices?.printAttachmentKeys, propertyDocuments],
  );
  const printOrderKeys = useMemo(
    () =>
      resolvePrintAttachmentOrder(
        printRows.filter((row) => row.printable).map((row) => row.key),
        choices?.printAttachmentOrder,
      ),
    [printRows, choices?.printAttachmentOrder],
  );

  // ---- actions ----
  const send = useCallback(async () => {
    const config = apiConfig();
    if (!config || !draft || !choices) return;
    setBusy(true);
    try {
      // The server keeps what he last saved; flush a pending edit before sending.
      if (dirtyRef.current && !(await persist(choices))) return;
      const res = await sendReportDraft(config, draft.valuationRequestId, {
        conformityConfirmed: conformity,
        note: note.trim() || undefined,
      });
      if (!res.ok) {
        showToast(res.message ?? "تعذّر إرسال المسودة", "error");
        return;
      }
      setDraft(res.data);
      showToast("أُرسلت مسودة التقرير للمقيّم", "success");
    } finally {
      setBusy(false);
    }
  }, [choices, conformity, draft, note, persist, setDraft, showToast]);

  const withdraw = useCallback(async () => {
    const config = apiConfig();
    if (!config || !draft) return;
    const reason = await promptAction({
      title: "سحب المسودة",
      label: "ملاحظة للمقيّم عن سبب سحب المسودة (اختياري)",
      confirmLabel: "سحب المسودة",
    });
    if (reason === null) return;
    setBusy(true);
    try {
      const res = await withdrawReportDraft(config, draft.valuationRequestId, reason.trim() || undefined);
      if (!res.ok) {
        showToast(res.message ?? "تعذّر سحب المسودة", "error");
        return;
      }
      seededRef.current = false;
      setDraft(res.data);
      showToast("سُحبت المسودة — يمكنك تعديلها وإعادة إرسالها", "success");
    } finally {
      setBusy(false);
    }
  }, [draft, setDraft, showToast]);

  /** A deposited report changes only as a new version (n+1): the appraiser's package and task open again. */
  const reopenAsNewVersion = useCallback(async () => {
    const config = apiConfig();
    if (!config || !draft) return;
    const reason = await promptAction({
      title: "فتح التقرير بنسخة جديدة (ن+1)",
      message: "يعود التقييم للمقيّم، وتبقى النسخة القديمة محفوظة بنفس رقم التقرير.",
      label: "سبب فتح التقرير بنسخة جديدة",
      required: true,
      minLength: 10,
      confirmLabel: "فتح بنسخة جديدة",
    });
    if (reason === null) return;
    setBusy(true);
    try {
      const res = await reopenReportIssuance(config, draft.valuationRequestId, reason.trim());
      if (!res.ok) {
        showToast(res.message ?? "تعذّر فتح التقرير بنسخة جديدة", "error");
        return;
      }
      seededRef.current = false;
      await queryClient.invalidateQueries({ queryKey: reportDraftKey(propertyId) });
      notifyTasksChanged();
      showToast("فُتح التقرير بنسخة جديدة — عاد التقييم للمقيّم", "success");
    } finally {
      setBusy(false);
    }
  }, [draft, propertyId, queryClient, showToast]);

  if (draftQuery.isPending) return null;
  if (draftQuery.isError) {
    return (
      <p className="mb-3 mt-0 text-[12.5px] text-danger-text">
        تعذّر تحميل مسودة تقرير التقييم — أعد المحاولة.
      </p>
    );
  }
  if (!draft) return null;

  const status = draft.status;
  const waitingForHandOver = status === "none" && !draft.canPrepare;
  const finalIssued = draft.reportStage === "final_issued";
  const deposited = finalIssued || (status === "approved" && Boolean(draft.depositCode));

  return (
    <ValCard title="مسودة تقرير التقييم">
      <p className="mb-3 mt-0 text-[12px] leading-relaxed text-text-3" data-testid="report-draft-status">
        الحالة: <strong>{STATUS_LABEL[status] ?? status}</strong>
        {status === "sent" && draft.sentAtUtc ? ` — أُرسلت ${formatDate(draft.sentAtUtc)}` : null}
        {status === "approved" && draft.approvedAtUtc
          ? ` — اعتُمدت ${formatDate(draft.approvedAtUtc)} (تاريخ التقرير ${draft.reportDate ?? "—"})`
          : null}
        {draft.version > 1 ? ` · نسخة ${draft.version}` : null}
      </p>

      {status === "approved" ? (
        <p className="mb-3 mt-0 text-[12.5px] text-text-2" data-testid="report-draft-deposit-status">
          {finalIssued
            ? `صدر التقرير النهائي — رمز الإيداع ${draft.depositCode ?? "—"}${draft.certificateFileName ? ` · الشهادة: ${draft.certificateFileName}` : ""}.`
            : draft.depositCode
              ? `سُجّل رمز الإيداع ${draft.depositCode}.`
              : "بانتظار أن يرفع المقيّم التقرير على «قيمة» ويسجّل رمز الإيداع والشهادة."}
        </p>
      ) : null}

      {finalIssued ? (
        <div className="mb-3">
          <FinalReportDownload propertyId={propertyId} draft={draft} />
        </div>
      ) : null}

      {canEdit && deposited ? (
        <div className="mb-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void reopenAsNewVersion()}>
            فتح التقرير بنسخة جديدة
          </Button>
        </div>
      ) : null}

      {waitingForHandOver ? (
        <p className="m-0 text-[12.5px] text-text-3">
          تُفتح المسودة بعد أن يسلّم المقيّم تقييمه للأخصائي.
        </p>
      ) : null}

      {draft.appraiserNote ? (
        <p className="mb-3 mt-0 rounded-[var(--radius)] border border-amber-border bg-amber-bg px-3 py-2 text-[12.5px] text-amber-text">
          ملاحظة المقيّم: {draft.appraiserNote}
        </p>
      ) : null}

      {choices && !waitingForHandOver ? (
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="mb-2 mt-0 text-[13px] font-extrabold text-heading">مرفقات التقرير</h4>
            <ValuationReportAttachmentsEditor
              rows={printRows}
              selectedKeys={choices.printAttachmentKeys}
              orderKeys={printOrderKeys}
              disabled={!editable || busy}
              onChange={patchChoices}
            />
          </div>

          {editable ? (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <label className="flex items-start gap-2 text-[12.5px] font-semibold text-text-2">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[var(--ink)]"
                  checked={conformity}
                  disabled={busy}
                  onChange={(e) => setConformity(e.target.checked)}
                />
                <span>أؤكد أن التقييم مطابق لدراسة العقار</span>
              </label>
              <textarea
                className={cn(opsFldControl, "min-h-[64px] font-medium")}
                placeholder="ملاحظة للمقيّم (اختياري)"
                value={note}
                maxLength={2000}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-end gap-3">
                <span className="text-[11.5px] text-text-3" role="status">
                  {saveState === "saving"
                    ? "جاري الحفظ…"
                    : saveState === "saved"
                      ? "تم الحفظ"
                      : saveState === "error"
                        ? "تعذّر الحفظ"
                        : pendingSave
                          ? "يُحفظ تلقائياً…"
                          : ""}
                </span>
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  disabled={busy || !conformity}
                  onClick={() => void send()}
                >
                  إرسال المسودة للمقيّم
                </Button>
              </div>
            </div>
          ) : null}

          {canEdit && status === "sent" ? (
            <div className="flex justify-end border-t border-border pt-3">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void withdraw()}>
                سحب المسودة
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </ValCard>
  );
}
