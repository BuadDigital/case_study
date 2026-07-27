"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPropertyKeyGate, type PropertyKeyGateDto } from "@platform/api-client";
import {
  KpiBand,
  KpiCell,
  MobileKpiStatCards,
  PageShell,
  PanelSkeleton,
  cn,
  useToast,
} from "@platform/design-system";
import { getAuthSession } from "@platform/auth-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import {
  getCachedPartySubmission,
  partySubmissionTaskIdsKey,
  prefetchPartySubmissionsForTasks,
} from "@platform/app-shared/prototype/party-submission-api";
import { partyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { RegisterKeyEnvelopeModal } from "@keys/mfe/components/RegisterKeyEnvelopeModal";
import { useInvalidateKeyEnvelopes } from "@keys/mfe/query/keys-queries";
import {
  decodeTaskParam,
  governmentReviewWorkspacePath,
} from "../lib/my-task-routes";
import { poPropertyDetailPath } from "../lib/po-routes";
import {
  tasksForPartyAssignee,
  type WorkflowTask,
} from "../lib/prototype/tasks-storage";
import {
  reviewerScopeForRole,
  poInReviewerScope,
  poCitiesForReviewerScope,
} from "../lib/prototype/reviewer-coverage";
import {
  formatPropertyDeedDisplay,
  formatPropertyLocation,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../lib/prototype/po-intake-data";
import {
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";
import { partyAccountForRole } from "../lib/prototype/distribution-parties";
import {
  getOrCreateGovernmentReviewDraft,
  GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
  updateGovernmentReviewDraft,
} from "../lib/prototype/government-review-work-storage";
import type {
  GovernmentReviewKeysStatus,
  GovernmentReviewSubmission,
} from "../lib/prototype/government-review-work-data";
import { normalizeGovernmentReviewSubmission } from "../lib/prototype/government-review-work-data";
import {
  GOV_REVIEW_LIST_COLS,
  GOV_REVIEW_LIST_FOOTER,
  GOV_STATUS_COLORS,
  GovEmpty,
  GovGridHead,
  GovGridRow,
  GovKpiAlertIcon,
  GovKpiBuildingIcon,
  GovKpiCheckIcon,
  GovKpiKeyIcon,
  GovPlusIcon,
  GovSelect,
  GovStatusPill,
  GovTd,
  GovTh,
  GovUserIcon,
  govCardClassName,
  govChipClassName,
  govGhostBtnClassName,
  govPrimaryBtnClassName,
  govReviewerBadgeClassName,
  govRowGhostBtnClassName,
} from "../components/government-review/GovernmentReviewHtmlPrimitives";

type QueuePropertyRow = {
  task: WorkflowTask;
  property: PoPropertyIntake | undefined;
  record: PoIntakeRecord | undefined;
  deed: string;
  location: string;
  court: string;
  request: string;
  circuit: string;
};

function submissionFromCache(
  taskId: string,
): GovernmentReviewSubmission | null {
  const dto = getCachedPartySubmission(taskId);
  if (!dto) return null;
  const payload = dto.payload as Partial<GovernmentReviewSubmission>;
  const normalized = normalizeGovernmentReviewSubmission(payload);
  return {
    ...normalized,
    taskId: dto.taskId,
    propertyId: normalized.propertyId || dto.propertyId || "",
    poNumber: normalized.poNumber || dto.poNumber || "",
    visitStatus: normalized.visitStatus ?? "",
    visitDate: normalized.visitDate ?? "",
    courtName: normalized.courtName ?? "",
    keysStatus: normalized.keysStatus ?? "",
    keysDescription: normalized.keysDescription ?? "",
    keyHandedToInspector: normalized.keyHandedToInspector ?? "",
    accessBlockReason: normalized.accessBlockReason ?? "",
    reviewNotes: normalized.reviewNotes ?? "",
    propertyZoneStatus: normalized.propertyZoneStatus ?? "",
    keysProofFiles: normalized.keysProofFiles ?? [],
    confirmed: normalized.confirmed ?? false,
    status: (normalized.status ?? dto.status) as GovernmentReviewSubmission["status"],
    submittedAtUtc: dto.submittedAtUtc ?? normalized.submittedAtUtc ?? null,
    updatedAtUtc: dto.updatedAtUtc ?? normalized.updatedAtUtc ?? "",
  };
}

function gateHasEnvelope(gate: PropertyKeyGateDto | undefined | null): boolean {
  if (!gate) return false;
  if (gate.envelopeId?.trim()) return true;
  return (
    !gate.envelopeMissingWarning &&
    (gate.source === "envelope" || gate.source === "court_access")
  );
}

export function GovernmentReviewView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTaskId = searchParams.get("task");
  const { role, viewerEmail } = usePrototype();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const invalidateEnvelopes = useInvalidateKeyEnvelopes();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = useMemo(() => staffResult?.users ?? [], [staffResult?.users]);
  const def = partyTaskPageDef("government-review");
  const reviewerScope = reviewerScopeForRole(role, staffUsers);
  const reviewerAccount = useMemo(
    () => partyAccountForRole(role, staffUsers),
    [role, staffUsers],
  );

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerRequestPrefill, setRegisterRequestPrefill] = useState("");
  const [keysOverrides, setKeysOverrides] = useState<
    Record<string, GovernmentReviewKeysStatus | "">
  >({});
  const [submissionGen, setSubmissionGen] = useState(0);
  const [savingKeysTaskId, setSavingKeysTaskId] = useState<string | null>(null);

  const {
    data: tasks,
    isFetched: tasksFetched,
  } = useWorkflowTasksQuery();
  const {
    data: poRecords = [],
    isFetched: poRecordsFetched,
  } = usePoRecordsQuery();

  const queueReady = tasksFetched && poRecordsFetched;

  useEffect(() => {
    if (!selectedTaskId) return;
    router.replace(governmentReviewWorkspacePath(decodeTaskParam(selectedTaskId)));
  }, [selectedTaskId, router]);

  useEffect(() => {
    const handler = () => setSubmissionGen((n) => n + 1);
    window.addEventListener(GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(
        GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
        handler,
      );
    };
  }, []);

  const poByNumber = useMemo(() => {
    const map = new Map<string, PoIntakeRecord>();
    for (const record of poRecords) map.set(record.poNumber.trim(), record);
    return map;
  }, [poRecords]);

  const mine = useMemo(
    () =>
      tasksForPartyAssignee(
        role,
        tasks ?? [],
        "government-reviewer",
        viewerEmail ?? getAuthSession()?.user.email,
        staffUsers,
      ),
    [viewerEmail, role, tasks, staffUsers],
  );

  const rows = useMemo((): QueuePropertyRow[] => {
    const govTasks = mine.filter((task) => task.kind === "government-review");
    const list: QueuePropertyRow[] = [];

    for (const task of govTasks) {
      const poNumber = task.poNumber.trim();
      const record = poByNumber.get(poNumber);
      const property = task.propertyId
        ? record?.properties.find((p) => p.id === task.propertyId)
        : undefined;
      const court = property?.court.trim() ?? "";
      const courts = court ? [court] : [];
      const cities = poCitiesForReviewerScope(record, [task]);
      if (!poInReviewerScope(courts, reviewerScope, cities)) continue;

      const deed =
        (property ? formatPropertyDeedDisplay(property) : "") ||
        task.title.split(" — ").slice(1).join(" — ").trim() ||
        `عقار ${task.propertyOrdinal}`;
      const location = property
        ? formatPropertyLocation(property) || "—"
        : "—";
      const request = property?.requestNumber?.trim() || "—";
      const circuit = property?.circuit?.trim() || "—";

      list.push({
        task,
        property,
        record,
        deed,
        location,
        court: court || "—",
        request,
        circuit,
      });
    }

    return list.sort((a, b) => {
      const createdCmp = b.task.createdAt.localeCompare(a.task.createdAt);
      if (createdCmp !== 0) return createdCmp;
      return a.deed.localeCompare(b.deed, "ar", { numeric: true });
    });
  }, [mine, poByNumber, reviewerScope]);

  const taskIdsKey = useMemo(
    () => partySubmissionTaskIdsKey(rows.map((r) => r.task.id)),
    [rows],
  );

  useEffect(() => {
    if (!taskIdsKey) return;
    const ids = taskIdsKey.split("\0").filter(Boolean);
    void prefetchPartySubmissionsForTasks(ids).then(() =>
      setSubmissionGen((n) => n + 1),
    );
  }, [taskIdsKey]);

  const gateTargets = useMemo(() => {
    const seen = new Set<string>();
    const targets: { propertyId: string; poNumber: string; deedNumber?: string; requestNumber?: string }[] = [];
    for (const row of rows) {
      const propertyId = row.task.propertyId?.trim();
      if (!propertyId) continue;
      const key = `${propertyId}:${row.task.poNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({
        propertyId,
        poNumber: row.task.poNumber.trim(),
        deedNumber: row.property?.deedNumber,
        requestNumber: row.property?.requestNumber,
      });
    }
    return targets;
  }, [rows]);

  const { data: gateByProperty = new Map<string, PropertyKeyGateDto>() } =
    useQuery({
      queryKey: [
        "government-review-key-gates",
        gateTargets.map((t) => `${t.propertyId}:${t.poNumber}`).join("|"),
      ],
      enabled: gateTargets.length > 0,
      staleTime: 30_000,
      queryFn: async () => {
        const config = prototypeModulesApiConfig();
        const map = new Map<string, PropertyKeyGateDto>();
        if (!config) return map;
        await Promise.all(
          gateTargets.map(async (target) => {
            const result = await getPropertyKeyGate(config, {
              propertyId: target.propertyId,
              poNumber: target.poNumber,
              deedNumber: target.deedNumber,
              requestNumber: target.requestNumber,
            });
            if (result.ok) {
              map.set(target.propertyId, result.data);
            }
          }),
        );
        return map;
      },
    });

  void submissionGen;

  const rowMeta = useMemo(() => {
    return rows.map((row) => {
      const sub = submissionFromCache(row.task.id);
      const keysStatus =
        keysOverrides[row.task.id] ??
        (sub?.keysStatus as GovernmentReviewKeysStatus | "" | undefined) ??
        "";
      const done =
        row.task.status === "completed" || sub?.status === "submitted";
      const propertyId = row.task.propertyId?.trim() ?? "";
      const gate = propertyId ? gateByProperty.get(propertyId) : undefined;
      const hasEnv = gateHasEnvelope(gate);
      return { row, keysStatus, done, hasEnv, sub };
    });
  }, [rows, keysOverrides, gateByProperty, submissionGen]);

  const kpis = useMemo(() => {
    const total = rowMeta.length;
    const received = rowMeta.filter((r) => r.keysStatus === "received").length;
    const waiting = rowMeta.filter(
      (r) => r.keysStatus === "received" && !r.hasEnv,
    ).length;
    const done = rowMeta.filter((r) => r.done).length;
    return { total, received, waiting, done };
  }, [rowMeta]);

  const openReviewTask = useCallback(
    (taskId: string) => {
      router.push(governmentReviewWorkspacePath(taskId));
    },
    [router],
  );

  const openRegister = useCallback((requestNumber?: string) => {
    setRegisterRequestPrefill(requestNumber?.trim() || "");
    setRegisterOpen(true);
  }, []);

  const onKeysStatusChange = useCallback(
    async (task: WorkflowTask, next: string) => {
      const value = next as GovernmentReviewKeysStatus | "";
      setKeysOverrides((prev) => ({ ...prev, [task.id]: value }));
      setSavingKeysTaskId(task.id);
      try {
        const propertyId = task.propertyId?.trim();
        if (!propertyId) {
          showToast("لا يوجد عقار مرتبط بالمهمة.", "error");
          return;
        }
        await getOrCreateGovernmentReviewDraft({
          taskId: task.id,
          propertyId,
          poNumber: task.poNumber,
        });
        await updateGovernmentReviewDraft(task.id, {
          keysStatus: value,
        });
        setSubmissionGen((n) => n + 1);
        void queryClient.invalidateQueries({
          queryKey: ["government-review-key-gates"],
        });
      } catch {
        showToast("تعذر حفظ حالة المفاتيح.", "error");
      } finally {
        setSavingKeysTaskId(null);
      }
    },
    [queryClient, showToast],
  );

  if (selectedTaskId) {
    return <PanelSkeleton className="p-4" />;
  }

  const reviewerLabel =
    reviewerAccount?.name?.trim() ||
    def?.assigneeSubtitle ||
    "مراجع حكومي";

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1 space-y-0">
      <KpiBand className="mb-6 hidden lg:flex">
        <KpiCell
          first
          icon={<GovKpiBuildingIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="عقارات في طابور المراجعة"
          value={queueReady ? kpis.total : "—"}
          sub={
            queueReady ? (
              <>
                <span className="size-1.5 rounded-full bg-gold" />
                صكوك مسجّلة
              </>
            ) : (
              "—"
            )
          }
          dot
        />
        <KpiCell
          icon={<GovKpiKeyIcon />}
          iconClass="bg-[color-mix(in_srgb,#2f7a4d_16%,transparent)] text-[#2f7a4d]"
          label="مفاتيح مستلمة"
          value={queueReady ? kpis.received : "—"}
          sub="من اختيار المراجع"
        />
        <KpiCell
          icon={<GovKpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]"
          label="بانتظار الظرف"
          value={queueReady ? kpis.waiting : "—"}
          sub="مستلمة دون ظرف مسجّل"
        />
        <KpiCell
          last
          icon={<GovKpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_16%,transparent)] text-[#2f7a4d]"
          label="مراجعات منتهية"
          value={queueReady ? kpis.done : "—"}
          sub={queueReady ? `من ${kpis.total} إجمالي` : "—"}
        />
      </KpiBand>

      <MobileKpiStatCards
        className="mb-6"
        items={[
          {
            key: "total",
            label: "عقارات في طابور المراجعة",
            sub: "صكوك مسجّلة",
            value: queueReady ? kpis.total : "—",
            icon: <GovKpiBuildingIcon />,
            iconClass: "bg-gold-soft text-gold-d",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "received",
            label: "مفاتيح مستلمة",
            sub: "من اختيار المراجع",
            value: queueReady ? kpis.received : "—",
            icon: <GovKpiKeyIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
          },
          {
            key: "waiting",
            label: "بانتظار الظرف",
            sub: "مستلمة دون ظرف مسجّل",
            value: queueReady ? kpis.waiting : "—",
            icon: <GovKpiAlertIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]",
            tone: "gold",
          },
          {
            key: "done",
            label: "مراجعات منتهية",
            sub: queueReady ? `من ${kpis.total} إجمالي` : "—",
            value: queueReady ? kpis.done : "—",
            icon: <GovKpiCheckIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
            valueClass: "!text-ink",
          },
        ]}
      />

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="m-0 text-[17px] font-extrabold text-heading">
            طابور المراجعة الحكومية
          </h2>
          <span className={govChipClassName}>
            {queueReady ? `${kpis.total} عقار` : "—"}
          </span>
          <span className={govReviewerBadgeClassName}>
            <GovUserIcon />
            {reviewerLabel} — مراجع حكومي
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/keys" className={cn(govGhostBtnClassName, "no-underline")}>
            <GovKpiKeyIcon />
            <span>محفظة المفاتيح</span>
          </Link>
          <button
            type="button"
            className={govPrimaryBtnClassName}
            onClick={() => openRegister()}
          >
            <GovPlusIcon />
            <span>تسجيل ظرف مفاتيح</span>
          </button>
        </div>
      </div>

      <div
        className={cn(
          govCardClassName,
          "max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:rounded-none",
        )}
      >
        {/* Desktop wide grid */}
        <div className="hidden overflow-x-auto lg:block">
          <div className="min-w-[1020px]">
            <GovGridHead cols={GOV_REVIEW_LIST_COLS}>
              <GovTh align="start">رقم الصك</GovTh>
              <GovTh align="start">الموقع</GovTh>
              <GovTh align="start">المحكمة / الطلب</GovTh>
              <GovTh align="start">حالة المفاتيح</GovTh>
              <GovTh align="start">بوابة الظرف</GovTh>
              <GovTh>إجراء</GovTh>
            </GovGridHead>

            {!queueReady ? (
              <div className="px-4 py-11 text-center text-[13.5px] text-text-3">
                جاري التحميل…
              </div>
            ) : rowMeta.length === 0 ? (
              <GovEmpty
                message={
                  def?.emptyLine ?? "لا توجد عقارات مسجّلة بعد"
                }
              />
            ) : (
              rowMeta.map(({ row, keysStatus, done, hasEnv }) => {
                const propertyId = row.task.propertyId?.trim();
                const deedHref =
                  propertyId
                    ? poPropertyDetailPath(row.task.poNumber, propertyId)
                    : undefined;
                return (
                  <GovGridRow key={row.task.id} cols={GOV_REVIEW_LIST_COLS}>
                    <GovTd>
                      {deedHref ? (
                        <Link
                          href={deedHref}
                          className="relative z-[1] text-[13.5px] font-bold text-primary underline decoration-primary underline-offset-2 hover:text-primary-mid"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.deed}
                        </Link>
                      ) : (
                        <span className="text-[13.5px] font-bold text-heading">
                          {row.deed}
                        </span>
                      )}
                    </GovTd>
                    <GovTd className="text-text-3">{row.location}</GovTd>
                    <GovTd col>
                      <span className="text-[12.5px] font-semibold text-heading">
                        {row.court}
                      </span>
                      <span className="text-[11px] text-text-3">
                        طلب {row.request} · {row.circuit}
                      </span>
                    </GovTd>
                    <GovTd>
                      <GovSelect
                        aria-label="حالة المفاتيح"
                        value={keysStatus}
                        disabled={done || savingKeysTaskId === row.task.id}
                        onChange={(v) => void onKeysStatusChange(row.task, v)}
                      >
                        <option value="">— اختر —</option>
                        <option value="received">مستلمة</option>
                        <option value="pending">قيد الاستلام</option>
                        <option value="not_required">لا تتطلب مفاتيح</option>
                      </GovSelect>
                    </GovTd>
                    <GovTd>
                      {hasEnv ? (
                        <GovStatusPill
                          label="ظرف مسجّل"
                          color={GOV_STATUS_COLORS.green}
                        />
                      ) : keysStatus === "received" ? (
                        <GovStatusPill
                          label="بانتظار الظرف"
                          color={GOV_STATUS_COLORS.amber}
                          fg={GOV_STATUS_COLORS.amberFg}
                          live
                        />
                      ) : (
                        <span className="text-text-3">—</span>
                      )}
                    </GovTd>
                    <GovTd align="center" className="gap-1.5">
                      {done ? (
                        <GovStatusPill
                          label="منتهية"
                          color={GOV_STATUS_COLORS.green}
                        />
                      ) : (
                        <>
                          {!hasEnv ? (
                            <button
                              type="button"
                              className={cn(
                                govRowGhostBtnClassName,
                                "text-gold-d hover:text-gold-d",
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                const req =
                                  row.property?.requestNumber?.trim() ||
                                  (row.request !== "—" ? row.request : "");
                                openRegister(req || undefined);
                              }}
                            >
                              تسجيل ظرف
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={cn(
                              govRowGhostBtnClassName,
                              "text-[#2f7a4d] hover:text-[#2f7a4d]",
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              openReviewTask(row.task.id);
                            }}
                          >
                            إنهاء المراجعة
                          </button>
                        </>
                      )}
                    </GovTd>
                  </GovGridRow>
                );
              })
            )}
          </div>
        </div>

        {/* Mobile cards — معاينة العقار language */}
        <div className="lg:hidden">
          {!queueReady ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[120px] animate-pulse rounded-[14px] border border-border bg-surface-2"
                />
              ))}
            </div>
          ) : rowMeta.length === 0 ? (
            <GovEmpty
              message={def?.emptyLine ?? "لا توجد عقارات مسجّلة بعد"}
            />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {rowMeta.map(({ row, keysStatus, done, hasEnv }, index) => {
                const propertyId = row.task.propertyId?.trim();
                const deedHref = propertyId
                  ? poPropertyDetailPath(row.task.poNumber, propertyId)
                  : undefined;
                const deedLabel = row.deed.startsWith("صك")
                  ? row.deed
                  : `صك ${row.deed}`;
                const tone = done
                  ? "border-s-ink"
                  : !hasEnv && keysStatus === "received"
                    ? "border-s-gold"
                    : "border-s-ink";
                return (
                  <li
                    key={row.task.id}
                    className={cn(
                      "ui-animate-fade-in relative overflow-hidden rounded-[14px] border border-border border-s-[3px] bg-surface px-3.5 py-3.5",
                      "shadow-[0_2px_8px_rgba(15,52,96,0.06)]",
                      tone,
                      done && "opacity-75",
                    )}
                    style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {deedHref ? (
                          <Link
                            href={deedHref}
                            className="text-[14px] font-bold text-heading no-underline hover:text-primary"
                          >
                            {deedLabel}
                          </Link>
                        ) : (
                          <div className="text-[14px] font-bold text-heading">
                            {deedLabel}
                          </div>
                        )}
                        <div className="mt-1 text-[12px] text-text-2">
                          {row.location !== "—" ? row.location : "بدون موقع"}
                        </div>
                      </div>
                      {done ? (
                        <GovStatusPill
                          label="منتهية"
                          color={GOV_STATUS_COLORS.green}
                        />
                      ) : hasEnv ? (
                        <GovStatusPill
                          label="ظرف مسجّل"
                          color={GOV_STATUS_COLORS.green}
                        />
                      ) : keysStatus === "received" ? (
                        <GovStatusPill
                          label="بانتظار الظرف"
                          color={GOV_STATUS_COLORS.amber}
                          fg={GOV_STATUS_COLORS.amberFg}
                          live
                        />
                      ) : null}
                    </div>

                    <div className="mt-2 text-[12px] text-text-2">
                      <span className="font-semibold text-heading">
                        {row.court}
                      </span>
                      <span className="text-text-3">
                        {" "}
                        · طلب {row.request} · {row.circuit}
                      </span>
                    </div>

                    {!done ? (
                      <div className="mt-3">
                        <label className="mb-1 block text-[10.5px] font-semibold text-text-3">
                          حالة المفاتيح
                        </label>
                        <GovSelect
                          aria-label="حالة المفاتيح"
                          value={keysStatus}
                          disabled={savingKeysTaskId === row.task.id}
                          onChange={(v) => void onKeysStatusChange(row.task, v)}
                        >
                          <option value="">— اختر —</option>
                          <option value="received">مستلمة</option>
                          <option value="pending">قيد الاستلام</option>
                          <option value="not_required">لا تتطلب مفاتيح</option>
                        </GovSelect>
                      </div>
                    ) : null}

                    {!done ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {!hasEnv ? (
                          <button
                            type="button"
                            className={cn(
                              govRowGhostBtnClassName,
                              "min-h-11 px-3 text-gold-d hover:text-gold-d",
                            )}
                            onClick={() => {
                              const req =
                                row.property?.requestNumber?.trim() ||
                                (row.request !== "—" ? row.request : "");
                              openRegister(req || undefined);
                            }}
                          >
                            تسجيل ظرف
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={cn(
                            govPrimaryBtnClassName,
                            "min-h-11 flex-1",
                          )}
                          onClick={() => openReviewTask(row.task.id)}
                        >
                          إنهاء المراجعة
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <p className="m-0 px-1 pt-3 text-[11.5px] text-text-3">
        {GOV_REVIEW_LIST_FOOTER}
      </p>

      <RegisterKeyEnvelopeModal
        open={registerOpen}
        busy={false}
        onClose={() => setRegisterOpen(false)}
        initialRequestNumber={registerRequestPrefill}
        onRegistered={() => {
          invalidateEnvelopes();
          void queryClient.invalidateQueries({
            queryKey: ["government-review-key-gates"],
          });
          setRegisterOpen(false);
          showToast("تم تسجيل ظرف المفاتيح.", "success");
        }}
      />
    </PageShell>
  );
}
