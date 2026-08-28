"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { allocateNumberedDocument } from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import {
  Button,
  cn,
  InlineLoadingSkeleton,
  ModalBody,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  useToast,
} from "@platform/ui-kit";
import { CaseStudyReportDocument } from "../case-study/CaseStudyReportDocument";
import { buildCaseStudyReportModel } from "../../lib/prototype/case-study-report-model";
import type { CaseStudyReportSection } from "../../lib/prototype/case-study-report-model";
import {
  CASE_STUDY_SECTION_REMARKS_HINT,
  type CaseStudyQuestionSection,
} from "../../lib/prototype/case-study-form-data";
import {
  loadCaseStudyFormDraft,
  PARTY_CASE_STUDY_FORM_CHANGED_EVENT,
  type CaseStudyFormDraft,
} from "../../lib/prototype/case-study-form-storage";
import { buildCaseStudyReportPrintHtml } from "../../lib/prototype/case-study-report-html";
import { openHtmlDocumentInNewTab } from "../../lib/open-html-document";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { caseStudyWorkspacePath } from "../../lib/my-task-routes";
import { canOpenCaseStudyWorkspace } from "../../lib/prototype/viewer-task-access";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { EmptyState, InfoBox } from "./PropertyDetailFields";
const SECTION_AR_NUMS: Record<CaseStudyQuestionSection, string> = {
  deed: "١",
  survey: "٢",
  comp: "٣",
  occ: "٤",
  extra: "٥",
};

const REMARKS_SECTIONS: ReadonlySet<CaseStudyQuestionSection> = new Set([
  "deed",
  "survey",
]);

const CheckMark = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--text-3)"
    strokeWidth="2"
    className={cn(
      "shrink-0 transition-transform duration-200",
      open ? "rotate-0" : "-rotate-90",
    )}
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const EyeIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const DownloadIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

function sectionAnsweredCount(section: CaseStudyReportSection): {
  answered: number;
  total: number;
  done: boolean;
} {
  const total = section.rows.length;
  const answered = section.rows.filter((r) => r.markA || r.markB).length;
  return { answered, total, done: total > 0 && answered === total };
}

function CaseStudySectionAccordion({
  section,
  open,
  onToggle,
}: {
  section: CaseStudyReportSection;
  open: boolean;
  onToggle: () => void;
}) {
  const { answered, total, done } = sectionAnsweredCount(section);
  const remarksLabel = REMARKS_SECTIONS.has(section.id)
    ? CASE_STUDY_SECTION_REMARKS_HINT
    : "الملاحظات";

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-start font-inherit"
      >
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-ink text-xs font-extrabold text-gold-2">
          {SECTION_AR_NUMS[section.id]}
        </span>
        <span className="flex-1 text-[13px] font-bold text-heading">
          {section.title}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold",
            done
              ? "bg-[color-mix(in_srgb,#2f7a4d_12%,transparent)] text-[#2f7a4d]"
              : "bg-[color-mix(in_srgb,var(--gold-d)_12%,transparent)] text-gold-d",
          )}
        >
          {done ? <CheckMark /> : null}
          <span dir="ltr">
            {answered}/{total}
          </span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div className="mt-2">
          <table className="w-full table-fixed overflow-hidden rounded-[10px] border border-border border-collapse">
            <thead>
              <tr>
                <th className="border-b border-border bg-surface-2 px-3.5 py-2 text-right text-[11px] font-bold text-text-2">
                  الأسئلة
                </th>
                <th className="w-[130px] border-b border-s border-e border-border bg-surface-2 px-2 py-2 text-center text-[11px] font-bold text-text-2">
                  {section.colAHeader}
                </th>
                <th className="w-[130px] border-b border-border bg-surface-2 px-2 py-2 text-center text-[11px] font-bold text-text-2">
                  {section.colBHeader}
                </th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, i) => {
                const unanswered = !row.markA && !row.markB;
                return (
                  <tr
                    key={`${section.id}_${i}`}
                    className={
                      unanswered
                        ? "bg-[color-mix(in_srgb,var(--gold-d)_5%,transparent)]"
                        : undefined
                    }
                  >
                    <td
                      className={cn(
                        "border-b border-border px-3.5 py-1.5 text-xs leading-relaxed text-text text-pretty",
                        unanswered && "shadow-[-3px_0_0_#d9a441_inset]",
                      )}
                    >
                      <span className="me-1.5 font-bold text-text-3">
                        {i + 1}.
                      </span>
                      {row.question}
                      {unanswered ? (
                        <span className="ms-1.5 inline-flex align-middle rounded-full bg-[#fef3d7] px-2 py-px text-[10px] font-bold text-[#946100]">
                          بانتظار الإجابة
                        </span>
                      ) : null}
                    </td>
                    <td className="w-[130px] border-b border-s border-border px-2 py-1.5 text-center">
                      {row.markA ? (
                        <span className="inline-flex text-[#2f7a4d]">
                          <CheckMark />
                        </span>
                      ) : null}
                    </td>
                    <td className="w-[130px] border-b border-border px-2 py-1.5 text-center">
                      {row.markB ? (
                        <span className="inline-flex text-[#c0553d]">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            aria-hidden="true"
                          >
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {section.extras?.map((line) => (
                <tr key={line}>
                  <td
                    colSpan={3}
                    className="border-b border-border px-3.5 py-2 text-[11.5px] text-text-2"
                  >
                    {line}
                  </td>
                </tr>
              ))}
              {section.id !== "extra" ? (
                <tr>
                  <td
                    colSpan={3}
                    className="bg-surface-2 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-text-2"
                  >
                    <b className="mb-0.5 block text-[11px] text-heading">
                      {remarksLabel}
                    </b>
                    {section.remarks?.trim() || "—"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function PropertyDetailCaseStudyReport({
  record,
  property,
  task,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  task: WorkflowTask | null;
}) {
  const { role } = usePrototype();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<CaseStudyFormDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [partyRevision, setPartyRevision] = useState(0);
  const [openSections, setOpenSections] = useState<
    Record<CaseStudyQuestionSection, boolean>
  >({
    deed: false,
    survey: false,
    comp: false,
    occ: false,
    extra: false,
  });
  const [previewOpen, setPreviewOpen] = useState(false);
 // قرار 25 (الكيان 6): رقم التقرير CS-{سنة}-{تسلسل ٥} يُخصَّص عند أول طباعة
 // ويثبت للجلسة — لا رقم جديد لكل ضغطة.
  const [reportReference, setReportReference] = useState<string | null>(null);

  const { data: tasks = [] } = useWorkflowTasksQuery();

  const printReport = useCallback(async () => {
    let reference = reportReference;
    if (!reference) {
      const config = apiConfig();
      const propertyId = /^[0-9a-fA-F-]{36}$/.test(property.id)
        ? property.id
        : undefined;
      if (config) {
        const allocated = await allocateNumberedDocument(config, {
          kind: "case-study-report",
          poNumber: record.poNumber,
          propertyId,
          title: `تقرير دراسة الحالة — صك ${property.deedNumber}`.trim(),
        });
        if (allocated.ok) {
          reference = allocated.data.referenceNumber;
          setReportReference(reference);
        }
      }
    }
    // إطار واحد حتى يُرسم الرقم في الترويسة قبل حوار الطباعة.
    requestAnimationFrame(() => window.print());
  }, [reportReference, record.poNumber, property.id, property.deedNumber]);

  const refreshDraft = useCallback(async () => {
    if (!task) {
      setDraft(null);
      return;
    }
    setLoading(true);
    const loaded = await loadCaseStudyFormDraft(task.id);
    setDraft(loaded);
    setLoading(false);
  }, [task]);

  useEffect(() => {
    void refreshDraft();
  }, [refreshDraft, partyRevision]);

  useEffect(() => {
    const bump = () => setPartyRevision((n) => n + 1);
    window.addEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, bump);
    return () =>
      window.removeEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  const reportModel = useMemo(() => {
    if (!task || !draft) return null;
    return buildCaseStudyReportModel(draft, property, task, record);
  }, [draft, property, record, task]);

  const showWorkspaceLink = useMemo(() => {
    if (!task) return false;
    return canOpenCaseStudyWorkspace(role, task, tasks);
  }, [task, role, tasks]);

  const anyClosed = useMemo(
    () => reportModel?.sections.some((s) => !openSections[s.id]) ?? true,
    [openSections, reportModel],
  );

  const toggleSection = useCallback((id: CaseStudyQuestionSection) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const expandOrCollapseAll = useCallback(() => {
    if (!reportModel) return;
    const nextOpen = anyClosed;
    setOpenSections({
      deed: nextOpen,
      survey: nextOpen,
      comp: nextOpen,
      occ: nextOpen,
      extra: nextOpen,
    });
  }, [anyClosed, reportModel]);

  const openPrintWindow = useCallback(() => {
    if (!reportModel) return;
    const html = buildCaseStudyReportPrintHtml(reportModel, {
      origin: window.location.origin,
    });
    const opened = openHtmlDocumentInNewTab(html);
    if (!opened) {
      showToast("تعذّر فتح نافذة التقرير — تحقق من إعدادات المنبثقات.", "error");
    }
  }, [reportModel, showToast]);

  if (!task) {
    return (
      <InfoBox variant="amber" icon="ℹ">
        لم يُبدأ بنموذج دراسة الحالة بعد — افتح مسار دراسة حالة العقارات
        لإكماله.
      </InfoBox>
    );
  }

  if (loading) {
    return <InlineLoadingSkeleton />;
  }

  if (!draft || !reportModel) {
    return (
      <>
        <EmptyState
          icon="📋"
          title="لم يُبدأ النموذج بعد"
          sub="سيظهر هنا ملخّص نموذج دراسة الحالة مع جميع الأسئلة والإجابات بعد البدء في تعبئته."
        />
        <p className="mt-3">
          {showWorkspaceLink ? (
            <Link
              href={caseStudyWorkspacePath(task.id)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-DEFAULT)] border font-normal whitespace-nowrap transition-colors",
                "px-2 py-1 text-[11px]",
                "border-primary bg-primary text-white hover:border-primary-mid hover:bg-primary-mid",
              )}
            >
              دراسة حالة العقار
            </Link>
          ) : null}
        </p>
      </>
    );
  }

  return (
    <>
      <div className="mb-3.5 mt-1.5 flex flex-wrap items-center gap-2.5">
        <span className="text-[13px] font-bold text-heading">
          ملخّص النموذج المعتمد
        </span>
        <span className="flex-1" />
        <button
          type="button"
          title="توسيع/طي كل الأقسام"
          onClick={expandOrCollapseAll}
          className="inline-flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-lg border border-[var(--border-2)] bg-surface text-text-2"
        >
          <EyeIcon />
        </button>
        <button
          type="button"
          onClick={openPrintWindow}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-2)] bg-surface px-3.5 py-1.5 text-xs font-bold text-text-2"
        >
          <DownloadIcon />
          تحميل التقرير
        </button>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-2)] bg-surface px-3.5 py-1.5 text-xs font-bold text-text-2"
        >
          معاينة التقرير
        </button>
      </div>

      {reportModel.sections.map((section) => (
        <CaseStudySectionAccordion
          key={section.id}
          section={section}
          open={openSections[section.id]}
          onToggle={() => toggleSection(section.id)}
        />
      ))}

      {showWorkspaceLink ? (
        <p className="mt-3">
          <Link
            href={caseStudyWorkspacePath(task.id)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-DEFAULT)] border font-normal whitespace-nowrap transition-colors",
              "px-2 py-1 text-[11px]",
              "border-primary bg-primary text-white hover:border-primary-mid hover:bg-primary-mid",
            )}
          >
            فتح دراسة الحالة
          </Link>
        </p>
      ) : null}

      {previewOpen ? (
        <ModalOverlay
          className="z-[var(--z-lightbox)] items-start overflow-y-auto p-6 px-4 print:absolute print:inset-0 print:overflow-visible print:bg-white print:p-0"
          onClick={() => setPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="معاينة تقرير دراسة الحالة"
        >
          <div
            className="w-[210mm] max-w-full overflow-hidden rounded-xl bg-surface-2 shadow-lg print:rounded-none print:shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader className="print:hidden border-b border-border bg-surface px-3.5 py-2.5">
              <ModalTitle className="text-start text-[13px]">
                معاينة التقرير النهائي
              </ModalTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => void printReport()}
                >
                  طباعة / PDF
                </Button>
                <Button size="sm" onClick={() => setPreviewOpen(false)}>
                  إغلاق
                </Button>
              </div>
            </ModalHeader>
            <ModalBody className="max-h-[calc(100vh-120px)] overflow-auto p-0 print:max-h-none print:overflow-visible print:bg-white">
              <div className="cs-report-preview-shell print:p-0">
                <CaseStudyReportDocument
                  model={reportModel}
                  id="cs-report-print-root"
                  referenceNumber={reportReference}
                />
              </div>
            </ModalBody>
          </div>
        </ModalOverlay>
      ) : null}
    </>
  );
}
