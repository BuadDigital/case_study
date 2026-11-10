// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • The specialist's send is disabled while the issuance gate `required_attachments` fails
//         (missingSpecialistDocuments over a fresh getValuationIssuanceGates query) and the missing documents
//         are listed under the button — the appraiser's approval would be refused for them.
//  • A refused send refetches those gates so the list follows the server.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, InlineLoadingSkeleton, cn, opsFldControl, promptAction, useToast } from "@platform/ui-kit";
import {
  getValuationIssuanceGates,
  reopenReportIssuance,
  saveReportDraftChoices,
  sendReportDraft,
  withdrawReportDraft,
  type ValuationReportDraftDto,
} from "@platform/api-client";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";
import { TASKS_CHANGED_EVENT } from "@platform/app-shared/events/app-events";
import type { EvaluatorReportDraftPanelProps } from "@platform/app-shared/party-appraisal/evaluator-runtime-bridge";
import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";
import { usePropertyDetailDocuments } from "../../lib/case-study-bridge";
import { findSiblingInspectionTask } from "../../lib/evaluator/evaluator-inspection-gate";
import { findSiblingSurveyTask } from "../../lib/evaluator/evaluator-readiness";
import { useEvaluatorSubmissionQuery } from "../../query/evaluator-submission-query";
import { normalizeReportChoices } from "../../lib/evaluator/evaluator-window-data";
import {
  REPORT_DRAFT_MISSING_DOCUMENTS_PREFIX,
  missingSpecialistDocuments,
} from "../../lib/evaluator/report-draft-send-gate";
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
import { ReportDepositStep } from "./ReportDepositStep";
import { ValCard } from "./EvaluatorHtmlPrimitives";
import { ValuationReportAttachmentsEditor } from "./ValuationReportAttachmentsEditor";
import { reportDraftKey, useReportDraftByProperty, useSetReportDraft } from "./useReportDraft";
import { apiConfig } from "./valuation-work/lib/shell-utils";

const AUTOSAVE_MS = 800;

const STATUS_LABEL: Record<string, string> = {
  none: "لم تبدأ",
  preparing: "قيد الإعداد",
  in_review: "عند المراجع",
  sent: "بانتظار اعتماد المقيّم",
  approved: "اعتمدها المقيّم",
};

/** The server's 409 wording for a draft someone else saved after this screen loaded it (2026-11-10). */
const STALE_DRAFT_MESSAGE = "حفظ مستخدم آخر تعديلات أحدث — أعد تحميل الصفحة";

/** The server's wording when Case Study's state could not be verified (2026-11-10). */
const CASE_STUDY_STATE_UNKNOWN_MESSAGE = "تعذّر التحقق من حالة دراسة الحالة — حاول مرة أخرى";

/**
 * Whether review's two decisions are unknown: the gates did not load, or Case Study's answer lacks either.
 * Edge cases: Case Study always answers both, so a missing one means it could not be read — the issue is
 * held with that reason instead of counting as passed (fixed 2026-11-10).
 */
function reviewStateIsUnknown(
  gates: { studyApprovedByReview?: boolean | null; valueAcceptedByReview?: boolean | null } | null | undefined,
): boolean {
  return gates == null || gates.studyApprovedByReview == null || gates.valueAcceptedByReview == null;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA").replace(/-/g, "/");
}

/**
 * The valuation-report draft (Omar 2026-11-08): after the appraiser hands his value over, every case
 * specialist (`canEdit`) fills the report choices (the print attachments; the appraiser's own ESG is his)
 * while it is prepared. Review (`canReview`) issues it to the appraiser for his final approval once it
 * approved the study and accepted the value (the readiness lines show both), and pulls a sent draft back
 * to correct it; the appraiser returns it to review with a reason (shown here) and never edits it. Once he
 * approved, review (`canDeposit`) deposits it in «قيمة», records the code and certificate
 * (`ReportDepositStep`) and may open a new version. Read-only for everyone else.
 */
export function ReportDraftPanel({
  appraisalTask,
  allTasks,
  property,
  canEdit,
  canDeposit = false,
  canReview = false,
}: EvaluatorReportDraftPanelProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const propertyId = appraisalTask.propertyId ?? property.id;
  const draftQuery = useReportDraftByProperty(propertyId);
  const setDraft = useSetReportDraft(propertyId);
  const draft = draftQuery.data ?? null;

  const submissionQuery = useEvaluatorSubmissionQuery(appraisalTask.id);

  // Every specialist edits the choices while the draft is prepared (a legacy draft «in review» too).
  const preparing = draft != null && (draft.status === "preparing" || (draft.status === "none" && draft.canPrepare));
  const inReview = draft?.status === "in_review";
  const editable = (canEdit || canReview) && (preparing || inReview);

  // Round 2: the documents only he uploads must be in place before the draft goes out.
  const requestId = draft?.valuationRequestId ?? null;
  const sendGatesQuery = useQuery({
    queryKey: ["valuation-issuance-gates", "report-draft-send", requestId],
    enabled: editable && requestId != null,
    staleTime: 0,
    queryFn: async () => {
      const config = apiConfig();
      if (!config || !requestId) return null;
      const res = await getValuationIssuanceGates(config, requestId);
      return res.ok ? res.data : null;
    },
  });
  // Review's decisions elsewhere on the page (approving the study, accepting the value) announce a tasks
  // change — the readiness lines follow them without a reload.
  const refetchGates = sendGatesQuery.refetch;
  useEffect(() => {
    if (!editable || requestId == null) return;
    const onChange = () => void refetchGates();
    window.addEventListener(TASKS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(TASKS_CHANGED_EVENT, onChange);
  }, [editable, requestId, refetchGates]);
  const missingDocuments = missingSpecialistDocuments(sendGatesQuery.data);
  // Review's two decisions before it issues the draft. Fixed 2026-11-10: an unknown answer (Case Study not
  // read, or the gates did not load) used to count as passed and enabled the issue — it now holds it, with
  // the reason shown. While the gates load nothing is claimed either way.
  const gatesLoading = sendGatesQuery.isPending;
  const reviewStateUnknown = !gatesLoading && reviewStateIsUnknown(sendGatesQuery.data);
  const studyApproved = sendGatesQuery.data?.studyApprovedByReview === true;
  const valueAccepted = sendGatesQuery.data?.valueAcceptedByReview === true;

  // ---- the specialist's working copy of his choices ----
  const [choices, setChoices] = useState<SpecialistReportChoices | null>(null);
  const [conformity, setConformity] = useState(false);
  const [note, setNote] = useState("");
  // Which action is in flight — its button spins, the others stay disabled.
  const [busy, setBusy] = useState<"send" | "withdraw" | "reopen" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const seededRef = useRef(false);
  const dirtyRef = useRef(false);
  // Optimistic concurrency (2026-11-10): the draft's updatedAtUtc this screen's choices are based on — set
  // at seeding, moved on by each of its own successful saves so sequential autosaves never conflict.
  const draftTokenRef = useRef<string | null>(null);
  // Someone else saved a newer draft: autosave stops and the reload message stays up.
  const [conflict, setConflict] = useState(false);
  // The same fact for rendering (a ref cannot be read while rendering): an edit waits for the debounced save.
  const [pendingSave, setPendingSave] = useState(false);

  // Seed once: his saved overlay over what the appraiser filled, so nothing starts blank.
  useEffect(() => {
    if (seededRef.current || !draft || submissionQuery.isPending) return;
    seededRef.current = true;
    draftTokenRef.current = draft.updatedAtUtc ?? "";
    setConflict(false);
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

  /**
   * Saves the whole choices object with the draft token this screen holds.
   * How it works: PUT with `draftTokenRef`; on success the token moves to the saved draft's stamp.
   * Edge cases (2026-11-10): a 409 means another specialist saved a newer draft — nothing is overwritten,
   * autosave stops and «حفظ مستخدم آخر تعديلات أحدث — أعد تحميل الصفحة» stays shown (was: last writer won).
   */
  const persist = useCallback(
    async (next: SpecialistReportChoices): Promise<ValuationReportDraftDto | null> => {
      const config = apiConfig();
      if (!config || !draft) return null;
      setSaveState("saving");
      const res = await saveReportDraftChoices(config, draft.valuationRequestId, next, draftTokenRef.current);
      if (!res.ok) {
        setSaveState("error");
        if (res.kind === "conflict") setConflict(true);
        showToast(res.message ?? (res.kind === "conflict" ? STALE_DRAFT_MESSAGE : "تعذّر حفظ خيارات التقرير"), "error");
        return null;
      }
      draftTokenRef.current = res.data.updatedAtUtc;
      dirtyRef.current = false;
      setPendingSave(false);
      setSaveState("saved");
      setDraft(res.data);
      return res.data;
    },
    [draft, setDraft, showToast],
  );

  // Debounced autosave while he edits (never over a newer draft someone else saved).
  useEffect(() => {
    if (!editable || !choices || !dirtyRef.current || conflict) return;
    const timer = setTimeout(() => void persist(choices), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [choices, conflict, editable, persist]);

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
  /**
   * Review issues the draft to the appraiser for his final approval (Omar 2026-11-08).
   * Edge cases (2026-11-10): the conformity confirmation is sent only when review actually ticked it — a
   * legacy draft «in review» used to be sent as confirmed automatically.
   */
  const send = useCallback(async () => {
    const config = apiConfig();
    if (!config || !draft || !choices) return;
    setBusy("send");
    try {
      // The server keeps what was last saved; flush a pending edit before sending.
      if (dirtyRef.current && !(await persist(choices))) return;
      const res = await sendReportDraft(config, draft.valuationRequestId, {
        conformityConfirmed: conformity,
        note: note.trim() || undefined,
      });
      if (!res.ok) {
        showToast(res.message ?? "تعذّر إصدار المسودة للمقيّم", "error");
        // A refusal (missing documents, study / value not reviewed): the lines follow the fresh gates.
        void sendGatesQuery.refetch();
        return;
      }
      draftTokenRef.current = res.data.updatedAtUtc;
      setDraft(res.data);
      notifyTasksChanged();
      showToast("أُصدرت مسودة التقرير للمقيّم لاعتمادها النهائي", "success");
    } finally {
      setBusy(null);
    }
  }, [choices, conformity, draft, note, persist, sendGatesQuery, setDraft, showToast]);

  /** Review pulls a sent draft back from the appraiser to correct it. */
  const withdraw = useCallback(async () => {
    const config = apiConfig();
    if (!config || !draft) return;
    const reason = await promptAction({
      title: "سحب المسودة من المقيّم",
      label: "ملاحظة للمقيّم عن سبب سحب المسودة (اختياري)",
      confirmLabel: "سحب المسودة",
    });
    if (reason === null) return;
    setBusy("withdraw");
    try {
      const res = await withdrawReportDraft(config, draft.valuationRequestId, reason.trim() || undefined);
      if (!res.ok) {
        showToast(res.message ?? "تعذّر سحب المسودة", "error");
        return;
      }
      seededRef.current = false;
      setDraft(res.data);
      notifyTasksChanged();
      showToast("سُحبت المسودة — عدّلها ثم أصدرها للمقيّم من جديد", "success");
    } finally {
      setBusy(null);
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
    setBusy("reopen");
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
      setBusy(null);
    }
  }, [draft, propertyId, queryClient, showToast]);

  const anyBusy = busy !== null;

  if (draftQuery.isPending) {
    return (
      <ValCard title="مسودة تقرير التقييم">
        <InlineLoadingSkeleton />
      </ValCard>
    );
  }
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
              : "بانتظار إيداع التقرير في «قيمة» وتسجيل رمز الإيداع والشهادة."}
        </p>
      ) : null}

      {finalIssued ? (
        <div className="mb-3">
          <FinalReportDownload propertyId={propertyId} draft={draft} />
        </div>
      ) : null}

      {canDeposit && status === "approved" ? <ReportDepositStep propertyId={propertyId} draft={draft} /> : null}

      {canDeposit && deposited ? (
        <div className="mb-3 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={busy === "reopen"}
            disabled={anyBusy}
            onClick={() => void reopenAsNewVersion()}
          >
            {busy === "reopen" ? "جاري فتح النسخة الجديدة…" : "فتح التقرير بنسخة جديدة"}
          </Button>
        </div>
      ) : null}

      {waitingForHandOver ? (
        <p className="m-0 text-[12.5px] text-text-3">
          تُفتح المسودة بعد أن يسلّم المقيّم تقييمه للأخصائي.
        </p>
      ) : null}

      {draft.reviewNote && status === "preparing" ? (
        <p
          className="mb-3 mt-0 rounded-[var(--radius)] border border-amber-border bg-amber-bg px-3 py-2 text-[12.5px] text-amber-text"
          data-testid="report-draft-review-note"
        >
          أعادها المقيّم للمراجع: {draft.reviewNote}
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
            {valuationLists ? (
              <ValuationReportAttachmentsEditor
                rows={printRows}
                selectedKeys={choices.printAttachmentKeys}
                orderKeys={printOrderKeys}
                disabled={!editable || anyBusy}
                onChange={patchChoices}
              />
            ) : (
              // The attachment catalog is what the rows are built from — without it the editor would
              // claim «لا توجد مرفقات معرفة بعد» while it is still loading.
              <InlineLoadingSkeleton />
            )}
          </div>

          {conflict ? (
            <p role="alert" className="m-0 text-[12px] font-semibold text-danger-text" data-testid="report-draft-conflict">
              {STALE_DRAFT_MESSAGE}
            </p>
          ) : null}

          {editable && !canReview ? (
            <p className="m-0 border-t border-border pt-3 text-[12px] text-text-3" data-testid="report-draft-review-issues">
              {saveState === "saving" ? "جاري الحفظ… · " : saveState === "saved" ? "تم الحفظ · " : ""}
              يُصدر المراجع المسودة للمقيّم بعد اعتماد الدراسة وقبول القيمة.
            </p>
          ) : null}

          {editable && canReview ? (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {gatesLoading ? (
                <p className="m-0 text-[12px] text-text-3" data-testid="report-draft-readiness">
                  جاري التحقق من اعتماد الدراسة وقبول القيمة…
                </p>
              ) : reviewStateUnknown ? (
                <p role="alert" className="m-0 text-[12px] font-semibold text-danger-text" data-testid="report-draft-readiness">
                  ✗ {CASE_STUDY_STATE_UNKNOWN_MESSAGE}
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px] font-semibold" data-testid="report-draft-readiness">
                  <li className={studyApproved ? "text-success-text" : "text-amber-text"}>
                    {studyApproved ? "✓ اعتمدتَ الدراسة" : "✗ لم تُعتمد الدراسة بعد — من قسم «تقرير دراسة الحالة»"}
                  </li>
                  <li className={valueAccepted ? "text-success-text" : "text-amber-text"}>
                    {valueAccepted ? "✓ قبلتَ القيمة" : "✗ لم تُقبل القيمة بعد — «قبول القيمة» أعلاه"}
                  </li>
                </ul>
              )}
              <label className="flex items-start gap-2 text-[12.5px] font-semibold text-text-2">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[var(--ink)]"
                  checked={conformity}
                  disabled={anyBusy}
                  onChange={(e) => setConformity(e.target.checked)}
                />
                <span>أؤكد أن التقييم مطابق لدراسة العقار</span>
              </label>
              <textarea
                className={cn(opsFldControl, "min-h-[64px] font-medium")}
                placeholder="ملاحظة للمقيّم (اختياري)"
                value={note}
                maxLength={2000}
                disabled={anyBusy}
                onChange={(e) => setNote(e.target.value)}
              />
              {missingDocuments ? (
                <p role="alert" className="m-0 text-[12px] font-semibold text-danger-text">
                  {REPORT_DRAFT_MISSING_DOCUMENTS_PREFIX}
                  {missingDocuments}
                </p>
              ) : null}
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
                  loading={busy === "send"}
                  disabled={
                    anyBusy ||
                    conflict ||
                    !conformity ||
                    missingDocuments != null ||
                    !studyApproved ||
                    !valueAccepted
                  }
                  onClick={() => void send()}
                >
                  {busy === "send" ? "جاري الإصدار…" : "إصدار المسودة للمقيّم"}
                </Button>
              </div>
            </div>
          ) : null}

          {canReview && status === "sent" ? (
            <div className="flex justify-end border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={busy === "withdraw"}
                disabled={anyBusy}
                onClick={() => void withdraw()}
              >
                {busy === "withdraw" ? "جاري السحب…" : "سحب المسودة من المقيّم"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </ValCard>
  );
}
