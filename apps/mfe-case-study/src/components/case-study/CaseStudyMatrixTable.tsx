"use client";

import type { ReactNode } from "react";
import { Button, cn } from "@platform/ui-kit";
import {
  CASE_STUDY_SECTION_QUESTIONS,
  caseStudyAnswerKey,
  type CaseStudyFormAnswer,
  type CaseStudyQuestionSection,
} from "../../lib/prototype/case-study-form-data";
import { caseStudyQuestionTargetId } from "../../lib/prototype/case-study-form-ux";
import type { PartyQuestionContribution } from "../../lib/prototype/case-study-party-answers";
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
  const label = value === "Y" ? "نعم" : value === "NA" ? "لا ينطبق" : "لا";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] border px-2 py-0.5 text-[11px] leading-none whitespace-nowrap",
        value === "Y"
          ? "border-[color-mix(in_srgb,var(--ink)_18%,var(--border))] bg-success-bg text-success-text"
          : value === "NA"
            ? "border-border-md bg-surface-2 text-text-2"
            : "border-[color-mix(in_srgb,var(--danger)_22%,var(--border))] bg-danger-bg text-danger",
      )}
    >
      <span className="font-semibold text-text-2">{short}</span>
      <span className="inline-flex items-center" aria-hidden="true">
        {value === "Y" ? (
          <IconCheck size={11} />
        ) : value === "NA" ? (
          <span className="text-[10px] font-bold">—</span>
        ) : (
          <IconX size={11} />
        )}
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
  target: MatrixYn;
  disabled?: boolean;
  onPick: (next: MatrixYn | null) => void;
  showAdopt?: boolean;
  onAdopt?: () => void;
}) {
  const on = value === target;
  const adoptLabel =
    target === "Y"
      ? "اعتماد الأطراف (نعم)"
      : target === "NA"
        ? "اعتماد الأطراف (لا ينطبق)"
        : "اعتماد الأطراف (لا)";
  const aria =
    target === "Y" ? "نعم" : target === "NA" ? "لا ينطبق" : "لا";

  return (
    <div className="mx-auto flex w-full max-w-[3rem] flex-col items-center justify-center gap-1">
      <button
        type="button"
        className={cn(
          "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border transition-colors",
          on
            ? target === "Y"
              ? "border-ink bg-ink text-white"
              : target === "NA"
                ? "border-ink bg-surface-2 text-heading"
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
          ) : target === "NA" ? (
            <span className="text-[10px] font-bold">—</span>
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

  /* Fixed columns so header (نعم/لا) lines up with body cells */
  const ynColClass = "w-[72px] text-center";
  const headClass =
    "border-b-2 border-gold bg-surface-2 px-3 py-2.5 text-[12px] font-bold text-heading";
  const cellClass =
    "border-b border-border px-3 py-2.5 text-[12.5px] text-text align-middle";

  return (
    <div className="overflow-hidden rounded-[10px] border border-border">
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

      <div className="min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <table
          className="w-full min-w-[640px] table-fixed border-collapse font-sans"
          dir="rtl"
        >
          <colgroup>
            {showPartyColumn ? (
              <>
                <col style={{ width: "36%" }} />
                <col />
                <col style={{ width: 64 }} />
                <col style={{ width: 64 }} />
                <col style={{ width: 72 }} />
              </>
            ) : (
              <>
                <col />
                <col style={{ width: 64 }} />
                <col style={{ width: 64 }} />
                <col style={{ width: 72 }} />
              </>
            )}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={cn(headClass, "text-start")}>
                السؤال
              </th>
              {showPartyColumn ? (
                <th scope="col" className={cn(headClass, "text-start")}>
                  إجابات الأطراف{" "}
                  <span className="font-normal text-text-3">(استدلال)</span>
                </th>
              ) : null}
              <th scope="col" className={cn(headClass, ynColClass)}>
                نعم
              </th>
              <th scope="col" className={cn(headClass, ynColClass)}>
                لا
              </th>
              <th scope="col" className={cn(headClass, ynColClass)}>
                لا ينطبق
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
                <tr
                  key={key}
                  id={caseStudyQuestionTargetId(key)}
                  className={cn(
                    "group transition-colors hover:bg-[var(--row-hover)]",
                    unansweredHighlight && invalidControlClass,
                  )}
                >
                  <td
                    className={cn(
                      cellClass,
                      "text-start leading-snug",
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
                  </td>

                  {showPartyColumn ? (
                    <td className={cn(cellClass, "text-start", conflictBg)}>
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
                    </td>
                  ) : null}

                  <td className={cn(cellClass, ynColClass, conflictBg)}>
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
                  </td>
                  <td className={cn(cellClass, ynColClass, conflictBg)}>
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
                  </td>
                  <td className={cn(cellClass, ynColClass, conflictBg)}>
                    <OfficialAnswerCell
                      value={official}
                      target="NA"
                      disabled={!editable}
                      onPick={setOfficial}
                      showAdopt={
                        editable &&
                        showPartyColumn &&
                        status === "consensus" &&
                        consensus === "NA" &&
                        official !== "NA"
                      }
                      onAdopt={() => setOfficial("NA")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {footer ? (
        <div className="border-t border-border bg-surface-2/60 px-4 py-3.5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
