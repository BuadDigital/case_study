"use client";
import type { ReactNode } from "react";
import { Button, Card, Note, cn } from "@platform/design-system";
import {
  CASE_STUDY_SECTION_QUESTIONS,
  caseStudyAnswerKey,
  type CaseStudyFormAnswer,
  type CaseStudyQuestionSection,
} from "../../lib/prototype/case-study-form-data";
import type { PartyQuestionContribution } from "../../lib/prototype/case-study-party-answers";
import {
  answerToYn,
  contributionsToPartyAnswers,
  getMatrixConsensus,
  getMatrixRowStatus,
  PARTY_MATRIX_ORDER,
  PARTY_MATRIX_SHORT,
  type MatrixYn,
  ynToAnswer,
} from "./case-study-matrix-utils";

function IconCheck({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconX({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconAlert({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconInfo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 10v6M12 7h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconFile({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCheckCheck({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 12l4 4L18 6M10 12l2 2"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PartyBadge({ short, value }: { short: string; value: MatrixYn }) {
  const label = value === "Y" ? "نعم" : "لا";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] leading-none whitespace-nowrap",
        value === "Y"
          ? "border-[#A7E8DA] bg-[#D5F5EF] text-[#1A6B5A]"
          : "border-[#F3C0BA] bg-[#FADBD8] text-[#E74C3C]",
      )}
    >
      <span className="font-semibold text-[#4A6272]">{short}</span>
      <span className="inline-flex items-center" aria-hidden="true">
        {value === "Y" ? <IconCheck size={11} /> : <IconX size={11} />}
      </span>
      <span className="font-bold">{label}</span>
    </span>
  );
}

function OfficialAnswerCell({
  value,
  target,
  disabled,
  onPick,
  showAdopt,
  onAdopt,
}: {
  value: MatrixYn | null;
  target: MatrixYn;
  disabled?: boolean;
  onPick: (next: MatrixYn | null) => void;
  showAdopt?: boolean;
  onAdopt?: () => void;
}) {
  const on = value === target;
  const adoptLabel =
    target === "Y" ? "اعتماد إجابة الأطراف (نعم)" : "اعتماد إجابة الأطراف (لا)";

  return (
    <div className="flex w-full flex-col items-center justify-start gap-2">
      <button
        type="button"
        className={cn(
          "inline-flex h-[22px] w-[22px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-2 p-0 transition-colors",
          on
            ? target === "Y"
              ? "border-[#1ABC9C] bg-[#1ABC9C] text-white"
              : "border-[#E74C3C] bg-[#E74C3C] text-white"
            : "border-[#B8CDE0] bg-white",
          disabled && "cursor-not-allowed opacity-45",
          !disabled && !on && "hover:border-[#2E86C1]",
        )}
        aria-pressed={on}
        aria-label={target === "Y" ? "نعم" : "لا"}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          onPick(on ? null : target);
        }}
      >
        {on ? (target === "Y" ? <IconCheck size={13} /> : <IconX size={13} />) : null}
      </button>
      {showAdopt && onAdopt ? (
        <button
          type="button"
          className="inline-flex max-w-full cursor-pointer items-center justify-center gap-1 rounded-full border border-[#BCDCF2] bg-[#D6EAF8] px-2.5 py-1.5 text-center text-[10px] leading-snug font-semibold whitespace-normal text-[#1A5276] hover:border-[#A9D0F0] hover:bg-[#C3E0F6]"
          onClick={onAdopt}
        >
          <IconCheck size={11} />
          {adoptLabel}
        </button>
      ) : null}
    </div>
  );
}

export function CaseStudyMatrixTable({
  section,
  sectionTitle,
  sectionIndex,
  sectionTotal,
  answers,
  onAnswer,
  canEditKey,
  visibleKey,
  partyByKey,
  showPartyColumn = true,
  partyContribCount = 0,
  onRefreshParty,
  footer,
}: {
  section: CaseStudyQuestionSection;
  sectionTitle: string;
  sectionIndex: number;
  sectionTotal: number;
  answers: Record<string, CaseStudyFormAnswer | null>;
  onAnswer: (key: string, value: CaseStudyFormAnswer | null) => void;
  canEditKey?: (key: string) => boolean;
  visibleKey?: (key: string) => boolean;
  partyByKey?: Record<string, PartyQuestionContribution[]>;
  showPartyColumn?: boolean;
  partyContribCount?: number;
  onRefreshParty?: () => void;
  footer?: ReactNode;
}) {
  const questions = CASE_STUDY_SECTION_QUESTIONS[section];
  const visibleRows = questions
    .map((q, i) => ({ q, i, key: caseStudyAnswerKey(section, i) }))
    .filter((row) => (visibleKey ? visibleKey(row.key) : true));

  if (visibleRows.length === 0) {
    return (
      <p className="m-0 border-t border-border bg-surface px-4 py-2.5 pb-3.5 text-[11px] leading-relaxed text-text-3 sm:px-6">
        لا توجد أسئلة مسندة لدورك في هذا القسم.
      </p>
    );
  }

  return (
    <Card className="overflow-hidden shadow-none">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-blue-light px-4 py-3">
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white"
          aria-hidden="true"
        >
          <IconFile />
        </span>
        <h3 className="m-0 min-w-0 flex-1 text-sm font-semibold text-text">
          {sectionTitle}
        </h3>
        <span className="text-[11px] text-text-2 max-sm:w-full sm:whitespace-nowrap">
          {visibleRows.length} سؤالاً · القسم {sectionIndex} من {sectionTotal}
        </span>
      </div>

      {showPartyColumn ? (
        <>
          <Note
            tone="info"
            className="mb-0 flex flex-wrap items-start gap-2.5 rounded-none border-0 border-b border-border bg-[#D6EAF8] text-[#1A5276]"
          >
            <IconInfo />
            <p className="m-0 min-w-[min(100%,220px)] flex-1">
              <strong>مسؤولية الأخصائي:</strong> راجِع إجابات الأطراف الظاهرة لكل
              سؤال (للاستدلال فقط)، ثم حدِّد <strong>الإجابة المعتمدة</strong>{" "}
              الرسمية. إجابات الأطراف للقراءة فقط، والأعمدة المعتمدة وحدها قابلة
              للتعديل.
            </p>
            {partyContribCount > 0 && onRefreshParty ? (
              <Button size="sm" className="shrink-0" onClick={onRefreshParty}>
                تحديث إجابات الأطراف ({partyContribCount})
              </Button>
            ) : null}
          </Note>

          <div className="flex flex-wrap items-center gap-3.5 border-b border-border bg-surface-2 px-4 py-2 text-[11px] text-text-2">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#1ABC9C]" />
              نعم / مطابق
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#E74C3C]" />
              لا / غير مطابق
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconCheckCheck size={13} /> اتفاق الأطراف
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconAlert size={12} /> تعارض
            </span>
          </div>
        </>
      ) : null}

      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[680px] border-collapse">
          <colgroup>
            <col className="w-[36%]" />
            {showPartyColumn ? <col /> : null}
            <col className="w-[155px]" />
            <col className="w-[155px]" />
          </colgroup>
          <thead>
            <tr>
              <th className="border-b border-border bg-blue-light px-4 py-2.5 text-right align-middle text-[11px] font-semibold text-text-2">
                السؤال
              </th>
              {showPartyColumn ? (
                <th className="border-b border-border bg-blue-light px-4 py-2.5 text-right align-middle text-[11px] font-semibold text-text-2">
                  إجابات الأطراف{" "}
                  <span className="font-normal text-[#8FA8BC]">(استدلال)</span>
                </th>
              ) : null}
              <th className="w-[155px] min-w-[155px] max-w-[155px] border-b border-border bg-blue-light px-4 py-2.5 text-center align-middle text-[11px] font-semibold text-primary">
                نعم
              </th>
              <th className="w-[155px] min-w-[155px] max-w-[155px] border-b border-border bg-blue-light px-4 py-2.5 text-center align-middle text-[11px] font-semibold text-primary">
                لا
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ q, key }, index) => {
              const official = answerToYn(answers[key]);
              const editable = canEditKey ? canEditKey(key) : true;
              const partyAnswers = showPartyColumn
                ? contributionsToPartyAnswers(partyByKey?.[key] ?? [])
                : {};
              const status = showPartyColumn
                ? getMatrixRowStatus(partyAnswers)
                : "pending";
              const consensus = showPartyColumn
                ? getMatrixConsensus(partyAnswers)
                : null;
              const hasPartyAnswers = Object.keys(partyAnswers).length > 0;

              const setOfficial = (next: MatrixYn | null) => {
                onAnswer(key, ynToAnswer(next));
              };

              const rowCellBg = cn(
                "transition-colors",
                status === "conflict"
                  ? "bg-[#FFF6F4] group-hover:bg-[#FFF0ED]"
                  : "bg-surface group-hover:bg-surface-2",
              );

              return (
                <tr key={key} className="group align-top">
                  <td
                    className={cn(
                      rowCellBg,
                      "border-b border-border px-4 py-2.5 align-top text-xs leading-snug text-text",
                      status === "pending" &&
                        showPartyColumn &&
                        "shadow-[inset_3px_0_0_#F39C12]",
                      status === "conflict" &&
                        showPartyColumn &&
                        "shadow-[inset_3px_0_0_#E74C3C]",
                    )}
                  >
                    <span className="me-1 inline-block min-w-5 text-[11px] font-semibold text-[#8FA8BC]">
                      {index + 1}.
                    </span>
                    <span className="leading-snug">{q}</span>
                    {showPartyColumn && status === "conflict" ? (
                      <span className="ms-1.5 inline-flex items-center gap-0.5 rounded-full bg-[#FADBD8] px-2 py-0.5 align-middle text-[10px] font-semibold text-[#E74C3C]">
                        <IconAlert size={9} /> تعارض
                      </span>
                    ) : null}
                    {showPartyColumn && status === "pending" ? (
                      <span className="ms-1.5 inline-flex items-center gap-0.5 rounded-full bg-[#FEF3D7] px-2 py-0.5 align-middle text-[10px] font-semibold text-[#946100]">
                        بانتظار إجابة
                      </span>
                    ) : null}
                  </td>

                  {showPartyColumn ? (
                    <td
                      className={cn(
                        rowCellBg,
                        "border-b border-border px-4 py-2.5 align-middle",
                      )}
                    >
                      {hasPartyAnswers ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {PARTY_MATRIX_ORDER.filter((k) => partyAnswers[k]).map(
                            (k) => (
                              <PartyBadge
                                key={k}
                                short={PARTY_MATRIX_SHORT[k]}
                                value={partyAnswers[k]!}
                              />
                            ),
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#8FA8BC]">
                          — لم يُسجَّل أي طرف إجابة بعد —
                        </span>
                      )}
                    </td>
                  ) : null}

                  <td
                    className={cn(
                      rowCellBg,
                      "w-[155px] min-w-[155px] max-w-[155px] overflow-hidden border-b border-border px-4 py-2.5 text-center align-top",
                    )}
                  >
                    <OfficialAnswerCell
                      value={official}
                      target="Y"
                      disabled={!editable}
                      onPick={setOfficial}
                      showAdopt={
                        showPartyColumn &&
                        status === "consensus" &&
                        consensus === "Y" &&
                        official !== "Y"
                      }
                      onAdopt={() => setOfficial("Y")}
                    />
                  </td>
                  <td
                    className={cn(
                      rowCellBg,
                      "w-[155px] min-w-[155px] max-w-[155px] overflow-hidden border-b border-border px-4 py-2.5 text-center align-top",
                    )}
                  >
                    <OfficialAnswerCell
                      value={official}
                      target="N"
                      disabled={!editable}
                      onPick={setOfficial}
                      showAdopt={
                        showPartyColumn &&
                        status === "consensus" &&
                        consensus === "N" &&
                        official !== "N"
                      }
                      onAdopt={() => setOfficial("N")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer ? <div className="px-4 pb-3">{footer}</div> : null}
    </Card>
  );
}
