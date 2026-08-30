"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  cn,
  EmptyState,
  InlineLoadingSkeleton,
  PageShell,
  Spinner,
  useToast,
} from "@platform/ui-kit";
import {
  CASE_STUDY_INFO_PARTIES,
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
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsFldTextarea,
  opsFilters,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsPpBadge,
  opsTfActions,
  opsTfLbl,
  opsTfSeg,
  opsTfSegActive,
} from "../lib/settings-ops-tw";

const QUESTION_INDEX_BY_KEY = new Map(
  CASE_STUDY_QUESTION_CATALOG.map((q, i) => [q.key, i]),
);
const ROLE_TYPE_BY_ID = new Map(
  CASE_STUDY_INFO_ROLE_TYPES.map((r) => [r.id, r]),
);

const FOLDER_ICON =
  "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z";

const ROLE_BTN_SELECTED: Record<string, string> = {
  primary: "border-ink bg-ink text-white",
  secondary: "border-gold-2 bg-gold-soft text-gold-d",
  verify: "border-border-md bg-surface-2 text-heading",
  none: "border-border bg-surface text-text-3",
};

function OpsIcon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

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
    if (!config) return { done: 0, partial: 0, empty: 0, pct: 0, total: 0, answered: 0 };
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
    const answered = done + partial;
    const pct = total === 0 ? 0 : Math.round((answered / total) * 100);
    return { done, partial, empty, pct, total, answered };
  }, [config]);

  if (!isFetched || !config) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <InlineLoadingSkeleton className="my-2" />
      </PageShell>
    );
  }

  const activeSection =
    CASE_STUDY_INFO_SECTIONS.find((s) => s.id === activeSec) ??
    CASE_STUDY_INFO_SECTIONS[0]!;
  const secQuestions = CASE_STUDY_QUESTION_CATALOG.filter(
    (q) => q.section === activeSec,
  );
  let secDone = 0;
  let secAnswered = 0;
  for (const q of secQuestions) {
    const s = questionStatus(config, q.key);
    if (s !== "empty") secAnswered++;
    if (s === "done") secDone++;
  }

  return (
    <PageShell
      variant="canvas"
      className="gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
      dir="rtl"
    >
      {saveError ? (
        <p className="mb-3.5 m-0 rounded-[10px] border border-danger/30 bg-danger-bg px-3.5 py-3 text-[12.5px] text-danger-text">
          {saveError}
        </p>
      ) : null}

      {saving ? (
        <p className="mb-3.5 m-0 inline-flex items-center gap-1.5 text-[12px] text-text-3">
          <Spinner />
          جاري الحفظ…
        </p>
      ) : null}

      <section className={cn(opsLetterCard, "mb-3.5")}>
        <div className={opsLetterHead}>
          <div className="flex items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <OpsIcon path={FOLDER_ICON} />
            </span>
            <div>
              <div className={opsLetterTitle}>ملخص المصفوفة</div>
              <div className={opsLetterSub}>
                {summary.done} مكتملة · {summary.partial} جزئية · {summary.empty}{" "}
                فارغة — تعبئة {summary.pct}%
              </div>
            </div>
          </div>
          <span className={opsPpBadge}>{summary.total}</span>
        </div>
        <div className="px-4 pb-[18px] pt-4 sm:px-[18px]">
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-200"
              style={{ width: `${summary.pct}%` }}
            />
          </div>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-text-2">
            {CASE_STUDY_INFO_PARTIES.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: p.color }}
                />
                {p.name}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {CASE_STUDY_INFO_ROLE_TYPES.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 rounded-[8px] border border-border-md bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-text-2"
              >
                <span>{r.icon}</span>
                {r.label}
              </span>
            ))}
          </div>
          <div className={opsTfActions}>
            <button
              type="button"
              className={opsBtnPrimary}
              disabled={!config}
              onClick={() => {
                if (!config) return;
                downloadCaseStudyInfoRolesMarkdown(config);
                showToast("تم تنزيل ملف Markdown", "success");
              }}
            >
              تصدير Markdown
            </button>
            <button
              type="button"
              className={opsBtnGhost}
              onClick={() => {
                if (!window.confirm("إعادة تعيين جميع الاختيارات؟")) return;
                applyConfig(() => emptyCaseStudyInfoRolesConfig());
              }}
            >
              إعادة تعيين
            </button>
          </div>
        </div>
      </section>

      <div className={cn(opsFilters, "mb-3.5")}>
        <div className="inline-flex flex-wrap" role="tablist" aria-label="أقسام النموذج">
          {CASE_STUDY_INFO_SECTIONS.map((sec) => {
            const qs = CASE_STUDY_QUESTION_CATALOG.filter(
              (q) => q.section === sec.id,
            );
            let answeredCount = 0;
            for (const q of qs) {
              if (questionStatus(config, q.key) !== "empty") answeredCount++;
            }
            const active = activeSec === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? opsTfSegActive : opsTfSeg}
                onClick={() => setActiveSec(sec.id)}
              >
                {sec.label}
                <span className="ms-1.5 opacity-70">
                  {answeredCount}/{qs.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section className={opsLetterCard}>
        <div className={opsLetterHead}>
          <div className="flex items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <OpsIcon path={FOLDER_ICON} />
            </span>
            <div>
              <div className={opsLetterTitle}>{activeSection.label}</div>
              <div className={opsLetterSub}>
                {secQuestions.length === 0
                  ? "لا أسئلة في هذا القسم"
                  : `${secAnswered} مجابة · ${secDone} مكتملة من ${secQuestions.length}`}
              </div>
            </div>
          </div>
          <span className={opsPpBadge}>{secQuestions.length}</span>
        </div>
        <div className="px-4 pb-2 sm:px-[18px]">
          {secQuestions.length === 0 ? (
            <EmptyState line="لا أسئلة." />
          ) : (
            secQuestions.map((q) => {
              const globalNum = (QUESTION_INDEX_BY_KEY.get(q.key) ?? -1) + 1;
              const open = openId === q.key;
              const chips = CASE_STUDY_INFO_PARTIES.flatMap((p) => {
                const role = config.matrix[q.key]?.[p.id];
                if (!role || role === "none") return [];
                const rt = ROLE_TYPE_BY_ID.get(role);
                return [{ party: p, role: rt! }];
              });
              const status = questionStatus(config, q.key);

              return (
                <div
                  key={q.key}
                  className="border-b border-border py-3 last:border-b-0"
                >
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-start gap-2.5 border-none bg-transparent p-0 text-right font-[inherit]"
                    onClick={() => setOpenId(open ? null : q.key)}
                  >
                    <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] border border-border-md bg-surface-2 text-[11px] font-bold text-text-3">
                      {globalNum}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold leading-snug text-heading">
                        {q.text}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                            status === "done" && "bg-gold-soft text-gold-d",
                            status === "partial" &&
                              "bg-surface-2 text-text-2",
                            status === "empty" && "bg-surface-2 text-text-3",
                          )}
                        >
                          {status === "done"
                            ? "مكتمل"
                            : status === "partial"
                              ? "جزئي"
                              : "فارغ"}
                        </span>
                        {chips.map(({ party, role }) => (
                          <span
                            key={party.id}
                            className="rounded-[8px] border border-border-md bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-text-2"
                          >
                            {party.name} · {role.label}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>

                  {open ? (
                    <div className="mt-3 rounded-[10px] border border-border bg-surface-2 p-3.5">
                      <p className={cn(opsTfLbl, "mb-2.5")}>
                        حدّد دور كل طرف في هذه المعلومة
                      </p>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {CASE_STUDY_INFO_PARTIES.map((party) => (
                          <div
                            key={party.id}
                            className="rounded-[10px] border border-border-md bg-surface p-2.5"
                          >
                            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-heading">
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
                                      "flex w-full cursor-pointer items-center gap-1.5 rounded-[8px] border border-border-md bg-surface-2 px-2 py-1.5 text-right font-[inherit] text-[11.5px] font-semibold text-text-2 transition-colors",
                                      "hover:border-gold hover:bg-gold-soft/40",
                                      sel && ROLE_BTN_SELECTED[rt.id],
                                    )}
                                    onClick={() => {
                                      applyConfig((prev) => {
                                        const cur =
                                          prev.matrix[q.key]?.[party.id];
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
                      <label className="mt-3 block">
                        <span className={opsTfLbl}>ملاحظة (اختياري)</span>
                        <textarea
                          className={opsFldTextarea}
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
            })
          )}
        </div>
      </section>
    </PageShell>
  );
}
