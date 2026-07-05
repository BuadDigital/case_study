"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  Button,
  InlineLoadingSkeleton,
  Note,
  PageGutter,
  PageShell,
  PageShellHeader,
  ProgressBar,
  Textarea,
  cn,
  useToast,
} from "@platform/design-system";
import { CASE_STUDY_INFO_PARTIES,
  CASE_STUDY_INFO_ROLE_TYPES,
  CASE_STUDY_INFO_SECTIONS,
  CASE_STUDY_QUESTION_CATALOG,
  type CaseStudyInfoPartyId,
  type CaseStudyInfoRoleType,
} from "../lib/prototype/case-study-info-roles-data";
import { downloadCaseStudyInfoRolesMarkdown } from "../lib/prototype/case-study-info-roles-markdown";
import {
  emptyCaseStudyInfoRolesConfig,
  saveCaseStudyInfoRolesConfig,
  type CaseStudyInfoRolesConfig,
} from "../lib/prototype/case-study-info-roles-storage";
import { apiErrorMessage } from "../lib/settings-api-config";
import {
  setCaseStudyInfoRolesCache,
  useCaseStudyInfoRolesQuery,
} from "../query/settings-queries";

const ROLE_BTN_SELECTED: Record<string, string> = {
  primary: "border-[#C4B5FD] bg-[#F3EEFF] text-[#5B21B6]",
  secondary: "border-[#6EE7B7] bg-[#ECFDF5] text-[#065F46]",
  verify: "border-[#FCD34D] bg-[#FFF7ED] text-[#92400E]",
  none: "border-border bg-surface-2 text-text-3",
};

function setMatrixRole(
  config: CaseStudyInfoRolesConfig,
  questionKey: string,
  partyId: CaseStudyInfoPartyId,
  role: CaseStudyInfoRoleType | null,
): CaseStudyInfoRolesConfig {
  const row = { ...config.matrix[questionKey] };
  if (role == null) delete row[partyId];
  else row[partyId] = role;
  return {
    ...config,
    matrix: { ...config.matrix, [questionKey]: row },
  };
}

function questionStatus(
  config: CaseStudyInfoRolesConfig,
  questionKey: string,
): "empty" | "partial" | "done" {
  const vals = CASE_STUDY_INFO_PARTIES.map(
    (p) => config.matrix[questionKey]?.[p.id],
  ).filter((v) => v && v !== "none");
  if (vals.length === 0) return "empty";
  if (vals.length >= 3) return "done";
  return "partial";
}

export function CaseStudyInfoRolesView() {
  const queryClient = useQueryClient();
  const { data: config, isFetched } = useCaseStudyInfoRolesQuery();
  const { showToast } = useToast();
  const [openId, setOpenId] = useState<string | null>(
    CASE_STUDY_QUESTION_CATALOG[0]?.key ?? null,
  );
  const [activeSec, setActiveSec] = useState(CASE_STUDY_INFO_SECTIONS[0]?.id);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());
  const noteSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  useEffect(() => {
    return () => {
      for (const timer of Object.values(noteSaveTimersRef.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const enqueueSave = useCallback(
    (next: CaseStudyInfoRolesConfig, rollback: CaseStudyInfoRolesConfig) => {
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        setSaving(true);
        setSaveError(null);
        const savedConfig = await saveCaseStudyInfoRolesConfig(next);
        setSaving(false);
        if (!savedConfig) {
          const message = apiErrorMessage("server", "تعذّر حفظ المصفوفة");
          setSaveError(message);
          setCaseStudyInfoRolesCache(queryClient, rollback);
          showToast(message, "error");
          return;
        }
        setCaseStudyInfoRolesCache(queryClient, savedConfig);
      });
    },
    [queryClient, showToast],
  );

  const applyConfig = useCallback(
    (
      buildNext: (prev: CaseStudyInfoRolesConfig) => CaseStudyInfoRolesConfig,
      options?: { debounceMs?: number; noteKey?: string },
    ) => {
      const prev =
        queryClient.getQueryData<CaseStudyInfoRolesConfig>(
          prototypeKeys.caseStudyInfoRoles(),
        ) ?? config;
      if (!prev) return;

      const next = buildNext(prev);
      const rollback = prev;
      setCaseStudyInfoRolesCache(queryClient, next);

      if (options?.debounceMs != null && options.noteKey) {
        const { noteKey, debounceMs } = options;
        const existing = noteSaveTimersRef.current[noteKey];
        if (existing) clearTimeout(existing);
        noteSaveTimersRef.current[noteKey] = setTimeout(() => {
          delete noteSaveTimersRef.current[noteKey];
          const latest = queryClient.getQueryData<CaseStudyInfoRolesConfig>(
            prototypeKeys.caseStudyInfoRoles(),
          );
          if (latest) enqueueSave(latest, rollback);
        }, debounceMs);
        return;
      }

      enqueueSave(next, rollback);
    },
    [config, enqueueSave, queryClient],
  );

  const summary = useMemo(() => {
    if (!config) return { done: 0, partial: 0, empty: 0, pct: 0, total: 0 };
    let done = 0;
    let partial = 0;
    let empty = 0;
    for (const q of CASE_STUDY_QUESTION_CATALOG) {
      const s = questionStatus(config, q.key);
      if (s === "done") done++;
      else if (s === "partial") partial++;
      else empty++;
    }
    const total = CASE_STUDY_QUESTION_CATALOG.length;
    const pct = Math.round(((done + partial * 0.5) / total) * 100);
    return { done, partial, empty, pct, total };
  }, [config]);

  if (!isFetched || !config) {
    return <InlineLoadingSkeleton className="my-2" />;
  }

  const secQuestions = CASE_STUDY_QUESTION_CATALOG.filter(
    (q) => q.section === activeSec,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
      <PageShell className="min-h-0 flex-1 overflow-y-auto">
        <PageShellHeader
          title="علاقة المستخدم بالمعلومة"
          actions={
            <>
              {saveError ? (
                <Note tone="warn" className="m-0 px-2.5 py-1.5 text-[11px]">
                  {saveError}
                </Note>
              ) : null}
              {saving ? (
                <span className="text-[11px] text-text-3">جاري الحفظ…</span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!config}
                onClick={() => {
                  if (!config) return;
                  downloadCaseStudyInfoRolesMarkdown(config);
                }}
              >
                تصدير Markdown
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!window.confirm("إعادة تعيين جميع الاختيارات؟")) return;
                  applyConfig(() => emptyCaseStudyInfoRolesConfig());
                }}
              >
                إعادة تعيين
              </Button>
            </>
          }
        >
          <p className="m-0 max-w-[640px] text-xs leading-snug text-text-2">
            حدّد لكل سؤال في نموذج دراسة الحالة: من الأطراف المعنيين وما دوره (أصيل /
            ثانوي / معتمد). تُطبَّق القواعد على تبويب «نموذج الدراسة» في معاملات
            الأطراف. يُحفظ تلقائياً في قاعدة البيانات — استخدم «تصدير Markdown» لنسخ
            الملف إلى <code className="text-[11px]">docs/case-study-info-roles.md</code>.
          </p>
        </PageShellHeader>

        <PageGutter className="flex flex-col gap-4 py-4">

      <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3.5">
        <div className="min-w-16 text-center">
          <span className="block text-[22px] font-bold text-primary">{summary.total}</span>
          <span className="mt-0.5 text-[10px] text-text-3">إجمالي الأسئلة</span>
        </div>
        <div className="min-w-16 text-center">
          <span className="block text-[22px] font-bold text-success-text">{summary.done}</span>
          <span className="mt-0.5 text-[10px] text-text-3">مكتملة</span>
        </div>
        <div className="min-w-16 text-center">
          <span className="block text-[22px] font-bold text-warning">{summary.partial}</span>
          <span className="mt-0.5 text-[10px] text-text-3">جزئية</span>
        </div>
        <div className="min-w-16 text-center">
          <span className="block text-[22px] font-bold text-primary">{summary.empty}</span>
          <span className="mt-0.5 text-[10px] text-text-3">فارغة</span>
        </div>
        <div className="min-w-0 flex-1 basis-[200px]">
          <div className="mb-1.5 flex justify-between text-[11px] text-text-2">
            <span>نسبة الاكتمال</span>
            <span>{summary.pct}%</span>
          </div>
          <ProgressBar value={summary.pct} tone="primary" />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-[var(--radius-lg)] border border-border bg-surface py-0 max-lg:static lg:sticky lg:top-3">
          <div className="mb-3 border-b border-border px-3.5 pb-3 pt-0">
            <p className="mb-2 text-[11px] font-semibold text-text-2">الأطراف</p>
            {CASE_STUDY_INFO_PARTIES.map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1 text-[11px]">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: p.color }}
                />
                <span>{p.name}</span>
              </div>
            ))}
          </div>
          <div className="mb-3 border-b border-border px-3.5 pb-3">
            <p className="mb-2 text-[11px] font-semibold text-text-2">أنواع الأدوار</p>
            {CASE_STUDY_INFO_ROLE_TYPES.map((r) => (
              <div key={r.id} className="mb-1.5 flex items-center gap-2">
                <span
                  className="rounded-lg px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: r.bg, color: r.color }}
                >
                  {r.label}
                </span>
                <span className="text-[10px] text-text-2">
                  {r.id === "primary"
                    ? "المسؤول الأساسي عن المعلومة"
                    : r.id === "secondary"
                      ? "مساهم — قد يكون مصدراً أولاً دون أن يكون المسؤول الأساسي"
                      : r.id === "verify"
                        ? "يراجع ويعتمد صحة المعلومة (ليس معتمد التقرير)"
                        : "بدون صلاحية إجابة"}
                </span>
              </div>
            ))}
          </div>
          <p className="px-3.5 pb-1 pt-2 text-[10px] font-semibold tracking-wide text-text-3">
            الأقسام
          </p>
          {CASE_STUDY_INFO_SECTIONS.map((sec) => {
            const qs = CASE_STUDY_QUESTION_CATALOG.filter(
              (q) => q.section === sec.id,
            );
            const doneCount = qs.filter(
              (q) => questionStatus(config, q.key) === "done",
            ).length;
            const partialCount = qs.filter(
              (q) => questionStatus(config, q.key) === "partial",
            ).length;
            const active = activeSec === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 border-none border-e-[3px] border-transparent bg-transparent px-3.5 py-2 text-right font-[inherit] text-xs",
                  "hover:bg-surface-2",
                  active && "border-e-primary bg-[#EFF6FF]",
                )}
                onClick={() => setActiveSec(sec.id)}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: sec.color }}
                />
                <span>{sec.label}</span>
                <span
                  className={cn(
                    "ms-auto rounded-lg px-1.5 py-px text-[10px] text-text-3",
                    active ? "bg-[#DBEAFE] text-primary" : "bg-surface-2",
                  )}
                  title={`${doneCount} مكتمل · ${partialCount} جزئي · ${qs.length - doneCount - partialCount} فارغ`}
                >
                  {doneCount}/{qs.length}
                </span>
              </button>
            );
          })}
        </aside>

        <div className="min-w-0">
          {secQuestions.map((q) => {
            const globalNum =
              CASE_STUDY_QUESTION_CATALOG.findIndex((x) => x.key === q.key) + 1;
            const open = openId === q.key;
            const chips = CASE_STUDY_INFO_PARTIES.flatMap((p) => {
              const role = config.matrix[q.key]?.[p.id];
              if (!role || role === "none") return [];
              const rt = CASE_STUDY_INFO_ROLE_TYPES.find((r) => r.id === role);
              return [{ party: p, role: rt! }];
            });
            return (
              <div
                key={q.key}
                className={cn(
                  "mb-2.5 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface",
                  chips.length > 0 && "border-[#BFDBFE]",
                )}
              >
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-start gap-2.5 border-none bg-transparent px-3.5 py-3 text-right font-[inherit]"
                  onClick={() => setOpenId(open ? null : q.key)}
                >
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] border border-border text-[11px] font-bold text-text-3">
                    {globalNum}
                  </span>
                  <span className="flex-1 text-[13px] leading-snug text-text">
                    {q.text}
                  </span>
                </button>
                {chips.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 px-3.5 pb-2.5">
                    {chips.map(({ party, role }) => (
                      <span
                        key={party.id}
                        className="rounded-[10px] px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: role.bg, color: role.color }}
                      >
                        {party.name} · {role.label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {open ? (
                  <div className="border-t border-border bg-surface-2 p-3.5">
                    <p className="mb-2.5 text-[11px] font-semibold text-text-2">
                      حدّد دور كل طرف في هذه المعلومة:
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {CASE_STUDY_INFO_PARTIES.map((party) => (
                        <div
                          key={party.id}
                          className="rounded-[var(--radius-DEFAULT)] border-[1.5px] border-border bg-surface p-2.5"
                        >
                          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold">
                            <span
                              className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              style={{ background: party.color }}
                            >
                              {party.abbr}
                            </span>
                            <span>{party.name}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {CASE_STUDY_INFO_ROLE_TYPES.map((rt) => {
                              const sel =
                                config.matrix[q.key]?.[party.id] === rt.id;
                              return (
                                <button
                                  key={rt.id}
                                  type="button"
                                  className={cn(
                                    "flex w-full cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-right font-[inherit] text-[11px] text-text-2",
                                    "hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-primary",
                                    sel && ROLE_BTN_SELECTED[rt.id],
                                  )}
                                  onClick={() => {
                                    applyConfig((prev) => {
                                      const cur = prev.matrix[q.key]?.[party.id];
                                      const nextRole =
                                        cur === rt.id ? null : rt.id;
                                      return setMatrixRole(
                                        prev,
                                        q.key,
                                        party.id,
                                        nextRole,
                                      );
                                    });
                                  }}
                                >
                                  <span>{rt.icon}</span>
                                  {rt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <label className="mt-3 block text-[11px] text-text-2">
                      ملاحظة (اختياري)
                      <Textarea
                        className="mt-1"
                        rows={2}
                        value={config.notes[q.key] ?? ""}
                        onChange={(e) =>
                          applyConfig(
                            (prev) => ({
                              ...prev,
                              notes: {
                                ...prev.notes,
                                [q.key]: e.target.value,
                              },
                            }),
                            { debounceMs: 600, noteKey: q.key },
                          )
                        }
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
        </PageGutter>
      </PageShell>
    </div>
  );
}
