"use client";

/**
 * Chip UI from Field Inspection Workspace.dc.html.
 * Shows every question assigned to the inspector in «علاقة المستخدم بالمعلومة».
 */

import { useEffect, useMemo, useState } from "react";
import { cn, InlineLoadingSkeleton, Note } from "@platform/ui-kit";
import {
  emptyCaseStudyInfoRolesConfig,
  isPartyQuestionVisible,
} from "@settings/mfe/lib/prototype/case-study-info-roles-storage";
import { partyIdForRoleId } from "@settings/mfe/lib/prototype/case-study-info-roles-data";
import { useCaseStudyInfoRolesQuery } from "@settings/mfe/query/settings-queries";
import {
  DEFAULT_CASE_STUDY_QUESTION_CATALOG,
  caseStudyAnswerKey,
} from "@platform/app-shared/domain/case-study/question-catalog";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import {
  CASE_STUDY_TABLE_HEADERS,
  type CaseStudyFormAnswer,
  type CaseStudyQuestionSection,
} from "../../lib/prototype/case-study-form-data";
import {
  loadPartyCaseStudyFormDraft,
  savePartyCaseStudyFormDraft,
  type CaseStudyFormDraft,
} from "../../lib/prototype/case-study-form-storage";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { useCaseStudyQuestionCatalogQuery } from "../../query/case-study-question-catalog-queries";

const DEFAULT_INFO_ROLES = emptyCaseStudyInfoRolesConfig();

/** All case-study sections — filtered per party via info-roles matrix. */
const GROUPS: { title: string; section: CaseStudyQuestionSection }[] = [
  { title: "بيانات الصك والعقار", section: "deed" },
  { title: "الرفع المساحي والطبيعة", section: "survey" },
  { title: "مكوّنات العقار على الطبيعة", section: "comp" },
  { title: "الإشغال والعقود", section: "occ" },
  { title: "ملاحظات إضافية", section: "extra" },
];

const OPTS: CaseStudyFormAnswer[] = ["A", "B", "NA"];

function resolveParentId(
  task: WorkflowTask,
  all: WorkflowTask[],
): string | null {
  if (task.kind === "case-study-property") return task.id;
  if (task.parentTaskId) return task.parentTaskId;
  return (
    all.find(
      (t) =>
        t.kind === "case-study-property" &&
        t.poNumber === task.poNumber &&
        t.propertyId === task.propertyId,
    )?.id ?? null
  );
}

export function InspectorCaseStudyChips({
  def,
  childTask,
  forceReadOnly = false,
}: {
  def: PartyTaskPageDef;
  childTask: WorkflowTask;
  forceReadOnly?: boolean;
}) {
  const partyId = partyIdForRoleId(def.roleId);
  const { data: tasks } = useWorkflowTasksQuery();
  const { data: infoRolesData } = useCaseStudyInfoRolesQuery();
  const { data: questionCatalog = DEFAULT_CASE_STUDY_QUESTION_CATALOG } =
    useCaseStudyQuestionCatalogQuery();
  const matrix = (infoRolesData ?? DEFAULT_INFO_ROLES).matrix;

  const [draft, setDraft] = useState<CaseStudyFormDraft | null>(null);
  const [loading, setLoading] = useState(true);

  const parentId = useMemo(
    () => resolveParentId(childTask, tasks ?? []),
    [childTask, tasks],
  );

  /** Design layout + matrix permissions. */
  const groups = useMemo(() => {
    if (!partyId) return [];
    return GROUPS.map((g) => {
      const questions = questionCatalog.sectionQuestions[g.section]
        .map((label, i) => {
          const key = caseStudyAnswerKey(g.section, i);
          return { key, label };
        })
        .filter(({ key }) => isPartyQuestionVisible(matrix, key, partyId));
      return { ...g, questions };
    }).filter((g) => g.questions.length > 0);
  }, [partyId, matrix, questionCatalog]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadPartyCaseStudyFormDraft(childTask.id)
      .then((d) => {
        if (!cancelled) setDraft(d);
      })
      .catch(() => {
        if (!cancelled) setDraft(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [childTask.id]);

  if (!partyId) {
    return (
      <Note tone="warn">
        لا يوجد طرف مطابق لهذا الدور في مصفوفة علاقة المستخدم بالمعلومة.
      </Note>
    );
  }

  if (loading) return <InlineLoadingSkeleton className="my-2" />;

  if (!parentId) {
    return (
      <Note tone="warn">
        لم تُعثر على معاملة دراسة الحالة الأم لهذا العقار. أكمل التوزيع أولاً.
      </Note>
    );
  }

  if (groups.length === 0) {
    return (
      <Note tone="warn">
        لا أسئلة مسندة للمعاين في «علاقة المستخدم بالمعلومة».
      </Note>
    );
  }

  const answers = draft?.answers ?? {};
  const total = groups.reduce((n, g) => n + g.questions.length, 0);
  const answered = groups.reduce(
    (n, g) =>
      n +
      g.questions.filter((q) => {
        const v = answers[q.key];
        return v === "A" || v === "B" || v === "NA";
      }).length,
    0,
  );

  async function pick(key: string, value: CaseStudyFormAnswer) {
    if (forceReadOnly) return;
    const base: CaseStudyFormDraft =
      draft ??
      ({
        taskId: childTask.id,
        status: "draft",
        currentStep: 1,
        requestNumber: "",
        requestDate: "",
        deedNumber: "",
        answers: {},
        deedRemarks: "",
        surveyRemarks: "",
        componentsRemarks: "",
        occupancyRemarks: "",
        meterType: "",
        meterNumber: "",
      } as CaseStudyFormDraft);
    const next: CaseStudyFormDraft = {
      ...base,
      answers: { ...base.answers, [key]: value },
      status: base.status === "new" ? "draft" : base.status,
    };
    setDraft(next);
    const saved = await savePartyCaseStudyFormDraft(next);
    if (saved.ok) setDraft(saved.draft);
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <span className="inline-flex rounded-md bg-surface-2 px-2.5 py-[3px] text-[10.5px] font-bold tabular-nums text-text-2">
          {answered}/{total} مُجاب
        </span>
      </div>
      {groups.map((g) => {
        const headers = CASE_STUDY_TABLE_HEADERS[g.section];
        const labels: Record<CaseStudyFormAnswer, string> = {
          A: headers.colA,
          B: headers.colB,
          NA: headers.colNa,
        };
        return (
          <div key={g.section} className="mb-3.5">
            <span className="mb-[5px] block text-[11px] font-semibold text-text-2">
              {g.title}
            </span>
            <div className="flex flex-col gap-1.5">
              {g.questions.map(({ key, label }) => {
                const current = answers[key] ?? null;
                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2"
                  >
                    <span className="min-w-[200px] flex-1 text-start text-xs text-text">
                      {label}
                    </span>
                    <div className="flex gap-1.5">
                      {OPTS.map((opt) => {
                        const on = current === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={forceReadOnly}
                            onClick={() => void pick(key, opt)}
                            className={cn(
                              "rounded-lg border px-[11px] py-[5px] font-inherit text-[11.5px]",
                              on
                                ? "border-[color-mix(in_srgb,#1f6f6f_30%,transparent)] bg-[color-mix(in_srgb,#2a8f8f_12%,transparent)] text-[#1f6f6f]"
                                : "border-border bg-surface text-text-3",
                              forceReadOnly && "cursor-default opacity-80",
                            )}
                          >
                            {labels[opt]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}