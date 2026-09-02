"use client";

import type { ReactNode } from "react";
import {
  Button,
  TBody,
  Table,
  TableFrame,
  Td,
  Th,
  THead,
  Tr,
  cn,
} from "@platform/ui-kit";
import {
  CASE_STUDY_ANSWER_LABEL_A,
  CASE_STUDY_ANSWER_LABEL_B,
  CASE_STUDY_SECTION_QUESTIONS,
  caseStudyAnswerKey,
  type CaseStudyFormAnswer,
  type CaseStudyQuestionSection,
} from "../../lib/app-data/case-study-form-data";
import { caseStudyQuestionTargetId } from "../../lib/app-data/case-study-form-ux";
import type { PartyQuestionContribution } from "../../lib/app-data/case-study-party-answers";
import { invalidControlClass } from "@platform/app-shared/form-ux";
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

function PartyBadge({ short, value }: { short: string; value: MatrixYn }) {
  const label = value === "Y" ? "نعم" : "لا";
  const fullLabel =
    value === "Y" ? CASE_STUDY_ANSWER_LABEL_A : CASE_STUDY_ANSWER_LABEL_B;
  return (
    <span
      title={fullLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] border px-2 py-0.5 text-[11px] leading-none whitespace-nowrap",
        value === "Y"
          ? "border-[color-mix(in_srgb,var(--ink)_18%,var(--border))] bg-success-bg text-success-text"
          : "border-[color-mix(in_srgb,var(--danger)_22%,var(--border))] bg-danger-bg text-danger",
      )}
    >
      <span className="font-semibold text-text-2">{short}</span>
      <span className="inline-flex items-center" aria-hidden="true">
        {value === "Y" ? <IconCheck size={11} /> : <IconX size={11} />}
      </span>
      <span className="font-semibold">{label}</span>
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
  target: Exclude<MatrixYn, "NA">;
  disabled?: boolean;
  onPick: (next: MatrixYn | null) => void;
  showAdopt?: boolean;
  onAdopt?: () => void;
}) {
  const on = value === target;
  const adoptLabel =
    target === "Y"
      ? `اعتماد الأطراف (${CASE_STUDY_ANSWER_LABEL_A})`
      : `اعتماد الأطراف (${CASE_STUDY_ANSWER_LABEL_B})`;
  const aria =
    target === "Y" ? CASE_STUDY_ANSWER_LABEL_A : CASE_STUDY_ANSWER_LABEL_B;

  return (
    <div className="mx-auto flex w-full max-w-[3rem] flex-col items-center justify-center gap-1">
      <button
        type="button"
        className={cn(
          "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border transition-colors",
          on
            ? target === "Y"
              ? "border-ink bg-ink text-white"
              : "border-danger bg-danger text-white"
            : "border-border-md bg-surface text-text-3 hover:border-[color-mix(in_srgb,var(--ink)_30%,var(--border))] hover:text-heading",
          disabled &&
            "cursor-not-allowed opacity-45 hover:border-border-md hover:text-text-3",
        )}
        aria-pressed={on}
        aria-label={aria}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          onPick(on ? null : target);
        }}
      >
        {on ? (
          target === "Y" ? (
            <IconCheck size={12} />
          ) : (
            <IconX size={12} />
          )
        ) : null}
      </button>
      {showAdopt && onAdopt ? (
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center rounded-[6px] border border-border-md bg-gold-soft px-1.5 py-0.5 text-center text-[9px] font-semibold text-[var(--gold-d)] hover:bg-[color-mix(in_srgb,var(--gold)_18%,var(--surface))]"
          onClick={onAdopt}
          aria-label={adoptLabel}
        >
          اعتماد
        </button>
      ) : null}
    </div>
  );
}

function RowStatusChip({ kind }: { kind: "conflict" | "awaiting" }) {
  if (kind === "conflict") {
    return (
      <span className="ms-1.5 inline-flex items-center gap-0.5 rounded-[6px] bg-danger-bg px-1.5 py-0.5 align-middle text-[10px] font-semibold text-danger">
        <IconAlert size={9} /> تعارض
      </span>
    );
  }
  return (
    <span className="ms-1.5 inline-flex items-center gap-0.5 rounded-[6px] bg-[var(--warning-bg)] px-1.5 py-0.5 align-middle text-[10px] font-semibold text-[var(--amber-text)]">
      بانتظار
    </span>
  );
}

export function CaseStudyMatrixTable({
  section,
  answers,
  onAnswer,
  questions,
  canEditKey,
  visibleKey,
  partyByKey,
  showPartyColumn = true,
  partyContribCount = 0,
  onRefreshParty,
  footer,
  missingAnswerKeys,
}: {
  section: CaseStudyQuestionSection;
  sectionTitle?: string;
  sectionIndex?: number;
  sectionTotal?: number;
  answers: Record<string, CaseStudyFormAnswer | null>;
  onAnswer: (key: string, value: CaseStudyFormAnswer | null) => void;
  questions?: readonly string[];
  canEditKey?: (key: string) => boolean;
  visibleKey?: (key: string) => boolean;
  partyByKey?: Record<string, PartyQuestionContribution[]>;
  showPartyColumn?: boolean;
  partyContribCount?: number;
  onRefreshParty?: () => void;
  footer?: ReactNode;
  /** Highlight & target unanswered rows after a failed submit attempt. */
  missingAnswerKeys?: ReadonlySet<string>;
}) {
  const questionRows = questions ?? CASE_STUDY_SECTION_QUESTIONS[section];
  const visibleRows = questionRows
    .map((q, i) => ({ q, i, key: caseStudyAnswerKey(section, i) }))
    .filter((row) => (visibleKey ? visibleKey(row.key) : true));

  if (visibleRows.length === 0) {
    return (
      <p className="m-0 rounded-[10px] border border-dashed border-border bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-text-3">
        لا توجد أسئلة مسندة لدورك في هذا القسم.
      </p>
    );
  }

  /* Fixed columns so header (yes/no) lines up with body cells */
  const ynColClass = "w-[72px] text-center align-middle";
  /* Density overrides on the shared Th/Td contract — this matrix runs tighter. */
  const headClass = "whitespace-normal px-3 py-2.5 text-[12px]";
  const cellClass = "px-3 py-2.5 text-[12.5px]";

  return (
    <TableFrame>
      {showPartyColumn && partyContribCount > 0 && onRefreshParty ? (
        <div className="flex justify-end border-b border-border bg-surface-2 px-3 py-2">
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={onRefreshParty}
          >
            تحديث إجابات الأطراف ({partyContribCount})
          </Button>
        </div>
      ) : null}

      <p className="m-0 border-b border-border bg-surface-2/70 px-3 py-2 text-[11px] leading-relaxed text-text-3">
        مقياس الإجابة الموحّد:{" "}
        <span className="font-semibold text-text-2">
          {CASE_STUDY_ANSWER_LABEL_A}
        </span>
        {" · "}
        <span className="font-semibold text-text-2">
          {CASE_STUDY_ANSWER_LABEL_B}
        </span>
      </p>

      <Table className="min-w-[640px] table-fixed" dir="rtl">
        <colgroup>
          {showPartyColumn ? (
            <>
              <col style={{ width: "36%" }} />
              <col />
              <col style={{ width: 72 }} />
              <col style={{ width: 72 }} />
            </>
          ) : (
            <>
              <col />
              <col style={{ width: 72 }} />
              <col style={{ width: 72 }} />
            </>
          )}
        </colgroup>
        <THead>
          <Tr hoverable={false}>
            <Th scope="col" className={headClass}>
              السؤال
            </Th>
            {showPartyColumn ? (
              <Th scope="col" className={headClass}>
                إجابات الأطراف{" "}
                <span className="font-normal text-text-3">(استدلال)</span>
              </Th>
            ) : null}
            <Th
              scope="col"
              title={CASE_STUDY_ANSWER_LABEL_A}
              className={cn(headClass, ynColClass)}
            >
              نعم
            </Th>
            <Th
              scope="col"
              title={CASE_STUDY_ANSWER_LABEL_B}
              className={cn(headClass, ynColClass)}
            >
              لا
            </Th>
          </Tr>
        </THead>
        <TBody>
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
            const awaitingPartyAnswer =
              showPartyColumn && status === "pending" && official === null;

            const setOfficial = (next: MatrixYn | null) => {
              onAnswer(key, ynToAnswer(next));
            };

            const accent =
              status === "conflict" && showPartyColumn
                ? "shadow-[inset_3px_0_0_var(--danger)]"
                : awaitingPartyAnswer
                  ? "shadow-[inset_3px_0_0_var(--warning)]"
                  : "";

            const conflictBg =
              status === "conflict" && showPartyColumn
                ? "bg-danger-bg/35"
                : undefined;

            const unansweredHighlight =
              missingAnswerKeys?.has(key) && official === null;

            return (
              <Tr
                key={key}
                id={caseStudyQuestionTargetId(key)}
                hoverable={false}
                className={cn(
                  "group transition-colors hover:bg-row-hover",
                  unansweredHighlight && invalidControlClass,
                )}
              >
                <Td
                  className={cn(
                    cellClass,
                    "leading-snug",
                    accent,
                    conflictBg,
                  )}
                >
                  <span className="me-1.5 inline-block min-w-4 text-[11px] font-bold text-[var(--gold-d)]">
                    {index + 1}.
                  </span>
                  <span>{q}</span>
                  {showPartyColumn && status === "conflict" ? (
                    <RowStatusChip kind="conflict" />
                  ) : null}
                  {awaitingPartyAnswer ? (
                    <RowStatusChip kind="awaiting" />
                  ) : null}
                </Td>

                {showPartyColumn ? (
                  <Td className={cn(cellClass, conflictBg)}>
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
                    ) : official !== null ? (
                      <span className="text-[11px] text-text-3">—</span>
                    ) : (
                      <span className="text-[11px] text-text-3">
                        لا إجابات بعد
                      </span>
                    )}
                  </Td>
                ) : null}

                <Td className={cn(cellClass, ynColClass, conflictBg)}>
                  <OfficialAnswerCell
                    value={official}
                    target="Y"
                    disabled={!editable}
                    onPick={setOfficial}
                    showAdopt={
                      editable &&
                      showPartyColumn &&
                      status === "consensus" &&
                      consensus === "Y" &&
                      official !== "Y"
                    }
                    onAdopt={() => setOfficial("Y")}
                  />
                </Td>
                <Td className={cn(cellClass, ynColClass, conflictBg)}>
                  <OfficialAnswerCell
                    value={official}
                    target="N"
                    disabled={!editable}
                    onPick={setOfficial}
                    showAdopt={
                      editable &&
                      showPartyColumn &&
                      status === "consensus" &&
                      consensus === "N" &&
                      official !== "N"
                    }
                    onAdopt={() => setOfficial("N")}
                  />
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>

      {footer ? (
        <div className="border-t border-border bg-surface-2/60 px-4 py-3.5">
          {footer}
        </div>
      ) : null}
    </TableFrame>
  );
}
