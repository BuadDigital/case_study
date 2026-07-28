"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import {
  Button,
  KpiBand,
  KpiCell,
  MobileKpiStatCards,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  OperationalToolbarPrimaryButton,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageShell,
  cn,
  useToast,
} from "@platform/design-system";
import {
  ActiveQueueMobileCards,
  type ActiveQueueMobileCardItem,
} from "@case-study/mfe/components/queue/ActiveQueueMobileCards";
import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { KeyEnvelopeDetailPage } from "../components/KeyEnvelopeDetailModal";
import { KeyEnvelopeFeesPanel } from "../components/KeyEnvelopeFeesPanel";
import {
  KEYS_LIST_COLS,
  KeysEmpty,
  KeysGridHead,
  KeysGridRow,
  KeysStatusPill,
  KeysTd,
  KeysTh,
  keysCardClassName,
  keysChipClassName,
  keysGhostBtnClassName,
} from "../components/KeysHtmlPrimitives";
import { RegisterKeyEnvelopeModal } from "../components/RegisterKeyEnvelopeModal";
import { removeKeyEnvelope } from "../lib/keys-envelope-api";
import {
  envelopeDisplayRef,
  envelopeStatusColor,
  envelopeStatusLabel,
  isEnvelopeOutOfCustody,
  scenarioColor,
  scenarioLabel,
  type KeyEnvelopeRow,
} from "../lib/keys-envelope-types";
import "./keys-look.css";
import {
  useInvalidateKeyEnvelopes,
  useKeyEnvelopesQuery,
} from "../query/keys-queries";

type StatusFilter = "all" | "reviewer" | "assessor" | "external" | "returned";
type ListTab = "envelopes" | "fees";

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function EyeIcon({ open, blink }: { open: boolean; blink?: boolean }) {
  return (
    <svg
      className={cn("show-all-eye", open && "is-open", blink && "is-blink")}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <g className="show-all-eye-ball">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle className="show-all-eye-pupil" cx="12" cy="12" r="3" />
      </g>
      <path className="show-all-eye-lid" d="M3 12h18" />
    </svg>
  );
}

function KpiEnvIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 7 12 13 2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
    </svg>
  );
}

function KpiClockIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function KpiAlertIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function KpiReadyIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 7 12 13 2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M12 13v4" />
    </svg>
  );
}

function MismatchIcon() {
  return (
    <span
      title="تعارض في العدد"
      className="ms-1.5 inline-grid size-[18px] place-items-center rounded-full"
      style={{
        background: "color-mix(in srgb, #d9694f 15%, transparent)",
        color: "#c0553d",
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
    </span>
  );
}

function keysListHref(opts?: {
  tab?: "fees";
  envelope?: string;
  register?: boolean;
  request?: string;
}): string {
  const params = new URLSearchParams();
  if (opts?.tab === "fees") params.set("tab", "fees");
  if (opts?.envelope) params.set("envelope", opts.envelope);
  if (opts?.register) params.set("register", "1");
  if (opts?.request) params.set("request", opts.request);
  const qs = params.toString();
  return qs ? `/keys?${qs}` : "/keys";
}

export function KeysView() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role } = usePrototype();
  const viewOnly = !isSuperAdmin(role) && role === "general-manager";
  const canEditEnvelope =
    !viewOnly &&
    (isSuperAdmin(role) ||
      role === "government-reviewer" ||
      role === "section-supervisor" ||
      role === "field-inspector" ||
      role === "real-estate-appraiser");
  const canRegisterEnvelope =
    !viewOnly &&
    (isSuperAdmin(role) ||
      role === "government-reviewer" ||
      role === "section-supervisor");

  const envelopesQuery = useKeyEnvelopesQuery();
  const invalidateEnvelopes = useInvalidateKeyEnvelopes();
  const envelopes = envelopesQuery.data ?? [];
  const ready = !envelopesQuery.isPending;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showOut, setShowOut] = useState(false);
  const [eyeBlink, setEyeBlink] = useState(false);
  const [listTab, setListTab] = useState<ListTab>("envelopes");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KeyEnvelopeRow | null>(
    null,
  );
  const registerRequestPrefill =
    searchParams.get("request")?.trim() || undefined;
  const registerTaskId = searchParams.get("task")?.trim() || undefined;

  useEffect(() => {
    const tab = searchParams.get("tab");
    setListTab(tab === "fees" ? "fees" : "envelopes");
    if (searchParams.get("register") === "1" && canRegisterEnvelope) {
      setRegisterOpen(true);
    }
    const envelope = searchParams.get("envelope")?.trim() || null;
    setDetailId(envelope);
  }, [searchParams, canRegisterEnvelope]);

  function closeRegisterModal() {
    setRegisterOpen(false);
    if (searchParams.get("register") === "1") {
      const fromFees = searchParams.get("tab") === "fees";
      router.replace(keysListHref(fromFees ? { tab: "fees" } : undefined));
    }
  }

  function openEnvelope(id: string) {
    const fromFees =
      listTab === "fees" || searchParams.get("tab") === "fees";
    router.replace(
      keysListHref(
        fromFees ? { tab: "fees", envelope: id } : { envelope: id },
      ),
    );
  }

  function closeEnvelope() {
    const backToFees = searchParams.get("tab") === "fees";
    router.replace(keysListHref(backToFees ? { tab: "fees" } : undefined));
  }

  function backToList() {
    router.replace(keysListHref());
  }

  /** KPI metrics — labels from `renderKeys`; live API approximates order-state with custody + assignments. */
  const kpis = useMemo(() => {
    const total = envelopes.length;
    const delivered = envelopes.filter((e) =>
      isEnvelopeOutOfCustody(e.status),
    ).length;
    const inCustody = total - delivered;
    const active = envelopes.filter(
      (e) => !isEnvelopeOutOfCustody(e.status),
    ).length;
    const pendingMatch = envelopes.reduce(
      (n, e) => n + e.assignments.filter((a) => a.status === "pending").length,
      0,
    );
    const readyToDeliver = envelopes.filter((e) => {
      if (e.status === "returned") return false;
      if (e.assignments.length === 0) return false;
      return e.assignments.every((a) => a.status !== "pending");
    }).length;
    return { total, delivered, inCustody, active, pendingMatch, readyToDeliver };
  }, [envelopes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return envelopes.filter((e) => {
      const deeds = e.assignments.map((a) => a.deedNumber).join(" ");
      const ref = envelopeDisplayRef(e.id, e.createdAtUtc).toLowerCase();
      const hay =
        `${ref} ${e.requestNumber} ${e.court} ${e.circuit} ${deeds}`.toLowerCase();
      const okQ = !q || hay.includes(q);
      const okSt = statusFilter === "all" || e.status === statusFilter;
      const okOut =
        showOut ||
        statusFilter !== "all" ||
        !isEnvelopeOutOfCustody(e.status);
      return okQ && okSt && okOut;
    });
  }, [envelopes, search, statusFilter, showOut]);

  const mobileCardItems = useMemo((): ActiveQueueMobileCardItem[] => {
    return filtered.map((env) => {
      const out = isEnvelopeOutOfCustody(env.status);
      const stColor = envelopeStatusColor(env.status);
      const tone: ActiveQueueMobileCardItem["tone"] = out
        ? "done"
        : env.countMismatch
          ? "returned"
          : env.receiveScenario
            ? "pending"
            : "new";
      const moreItems: RowMoreMenuItem[] = canRegisterEnvelope
        ? [
            {
              id: "delete",
              label: "حذف الظرف",
              onClick: () => setPendingDelete(env),
            },
          ]
        : [];
      return {
        id: env.id,
        title: envelopeDisplayRef(env.id, env.createdAtUtc),
        meta: [
          {
            text: env.court?.trim() || "بدون محكمة",
            kind: "place" as const,
          },
          {
            text: env.requestNumber?.trim()
              ? `طلب ${env.requestNumber.trim()}`
              : env.circuit?.trim() || "—",
            kind: "po" as const,
          },
          {
            text: `${env.keysCountActual} مفاتيح · ${env.assignments.length} صك`,
            kind: "type" as const,
          },
        ],
        statusLabel: envelopeStatusLabel(env.status),
        statusStyle: { base: stColor, fg: stColor },
        tone,
        muted: out,
        moreItems,
        onOpen: () => openEnvelope(env.id),
      };
    });
  }, [filtered, canRegisterEnvelope]);

  async function confirmDeleteEnvelope() {
    const env = pendingDelete;
    if (!env) return;

    setDeletingId(env.id);
    const result = await removeKeyEnvelope(env.id);
    setDeletingId(null);
    setPendingDelete(null);
    if (result.ok) {
      if (detailId === env.id) closeEnvelope();
      invalidateEnvelopes();
      showToast("تم حذف الظرف", "success");
    } else {
      showToast(result.error, "error");
    }
  }

  if (detailId) {
    const fromFees = searchParams.get("tab") === "fees";
    return (
      <PageShell variant="canvas" className="min-h-0 flex-1 space-y-0">
        <KeyEnvelopeDetailPage
          envelopeId={detailId}
          canEdit={canEditEnvelope}
          onBack={closeEnvelope}
          onChanged={() => invalidateEnvelopes()}
          backLabel={fromFees ? "تقرير الأتعاب" : "محفظة المفاتيح"}
        />
      </PageShell>
    );
  }

  if (listTab === "fees") {
    return (
      <PageShell variant="canvas" className="min-h-0 flex-1 space-y-0">
        <KeyEnvelopeFeesPanel
          canCollect={canRegisterEnvelope || isSuperAdmin(role)}
          onOpenEnvelope={(id) => openEnvelope(id)}
          onBack={backToList}
        />
        <RegisterKeyEnvelopeModal
          open={registerOpen}
          busy={false}
          onClose={closeRegisterModal}
          initialRequestNumber={registerRequestPrefill}
          operationsTaskId={registerTaskId}
          onRegistered={(id) => {
            invalidateEnvelopes();
            openEnvelope(id);
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1 space-y-0">
      <KpiBand className="mb-6 hidden lg:flex">
        <KpiCell
          first
          icon={<KpiEnvIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="إجمالي الأظرف"
          value={ready ? kpis.total : "—"}
          sub={
            ready ? (
              <>
                <span className="size-1.5 rounded-full bg-gold" />
                {kpis.delivered} مسلَّمة · المتبقي في العهدة{" "}
                <b className="text-[12.5px] text-gold-d">{kpis.inCustody}</b>
              </>
            ) : (
              "—"
            )
          }
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#378add_15%,transparent)] text-[#378add]"
          label="الأظرف النشطة"
          value={ready ? kpis.active : "—"}
          sub="لها معاملات لم تكتمل في النظام"
        />
        <KpiCell
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]"
          label="بانتظار المطابقة الميدانية"
          value={ready ? kpis.pendingMatch : "—"}
          sub="صكوك لم تُجرَّب مفاتيحها"
        />
        <KpiCell
          last
          icon={<KpiReadyIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9694f_16%,transparent)] text-[#c0553d]"
          label="أظرف جاهزة للتسليم"
          value={ready ? kpis.readyToDeliver : "—"}
          sub="اكتملت معاملاتها — بانتظار الإرجاع أو التسليم"
        />
      </KpiBand>

      <MobileKpiStatCards
        className="mb-6"
        items={[
          {
            key: "total",
            label: "إجمالي الأظرف",
            sub: ready
              ? `${kpis.delivered} مسلَّمة · عهدة ${kpis.inCustody}`
              : "—",
            value: ready ? kpis.total : "—",
            icon: <KpiEnvIcon />,
            iconClass: "bg-gold-soft text-gold-d",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "active",
            label: "الأظرف النشطة",
            sub: "لها معاملات لم تكتمل",
            value: ready ? kpis.active : "—",
            icon: <KpiClockIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
          },
          {
            key: "pending",
            label: "بانتظار المطابقة الميدانية",
            sub: "صكوك لم تُجرَّب مفاتيحها",
            value: ready ? kpis.pendingMatch : "—",
            icon: <KpiAlertIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]",
            tone: "gold",
          },
          {
            key: "ready",
            label: "أظرف جاهزة للتسليم",
            sub: "بانتظار الإرجاع أو التسليم",
            value: ready ? kpis.readyToDeliver : "—",
            icon: <KpiReadyIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--red)_12%,transparent)] text-red",
            tone: "red",
            valueClass: "!text-red",
          },
        ]}
      />

      {/* .toolbar — renderKeys */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h2 className="m-0 text-[17px] font-extrabold text-heading">
            ظروف المفاتيح
          </h2>
          <span className={keysChipClassName}>
            {ready ? `${filtered.length} نتيجة` : "…"}
          </span>
        </div>
        <div className="filters flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2.5 max-lg:w-full max-lg:flex-[1_1_100%]">
          <OperationalToolbarSearch
            type="text"
            placeholder="رقم الطلب أو المحكمة أو الصك..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث الظروف"
            className="max-lg:min-w-0 max-lg:flex-1"
          />
          <button
            type="button"
            className={cn(
              keysGhostBtnClassName,
              "show-all-btn-motion h-[38px] px-3.5 text-[12.5px] max-lg:flex-1",
            )}
            onClick={() => {
              setShowOut((v) => {
                const next = !v;
                if (next) {
                  setEyeBlink(true);
                  window.setTimeout(() => setEyeBlink(false), 420);
                }
                return next;
              });
            }}
          >
            <EyeIcon open={showOut} blink={eyeBlink} />
            <span className="max-sm:hidden">
              {showOut
                ? "إخفاء المسلَّمة (خارج العهدة)"
                : "إظهار المسلَّمة (خارج العهدة)"}
            </span>
            <span className="sm:hidden">
              {showOut ? "إخفاء المسلَّمة" : "إظهار المسلَّمة"}
            </span>
          </button>
          <OperationalToolbarSelect
            className="h-[38px] shrink-0 max-lg:min-w-0 max-lg:flex-1"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="تصفية العهدة"
          >
            <option value="all">كل حالات العهدة</option>
            <option value="reviewer">بعهدة المراجع</option>
            <option value="assessor">بعهدة المعاين</option>
            <option value="external">بعهدة طرف خارجي</option>
            <option value="returned">مُرجَع للمحكمة</option>
          </OperationalToolbarSelect>
          {canRegisterEnvelope ? (
            <OperationalToolbarPrimaryButton
              className="h-[38px] max-lg:w-full"
              onClick={() => setRegisterOpen(true)}
            >
              <PlusIcon />
              تسجيل ظرف مفاتيح
            </OperationalToolbarPrimaryButton>
          ) : null}
        </div>
      </div>

      {/* .card > .scroll > .grid — keyDrawList */}
      <div
        className={cn(
          keysCardClassName,
          "max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:rounded-none",
        )}
      >
        <div className="overflow-x-auto rounded-xl">
          <div className="hidden min-w-[960px] lg:block">
            <KeysGridHead cols={KEYS_LIST_COLS}>
              <KeysTh align="start">الرقم المرجعي</KeysTh>
              <KeysTh align="start">المحكمة / الدائرة</KeysTh>
              <KeysTh>عدد المفاتيح</KeysTh>
              <KeysTh align="start">رقم الطلب</KeysTh>
              <KeysTh>الصكوك</KeysTh>
              <KeysTh align="start">سيناريو الاستلام</KeysTh>
              <KeysTh align="start">العهدة</KeysTh>
              <KeysTh>{null}</KeysTh>
            </KeysGridHead>

            {!ready ? (
              <div className="space-y-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[58px] animate-pulse border-b border-border bg-surface-2/60"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <KeysEmpty
                title="لا توجد ظروف مطابقة"
                sub="جرّب تعديل البحث أو الفلاتر"
              />
            ) : (
              filtered.map((env) => {
                const out = isEnvelopeOutOfCustody(env.status);
                return (
                  <KeysGridRow
                    key={env.id}
                    cols={KEYS_LIST_COLS}
                    muted={out}
                    onClick={() => openEnvelope(env.id)}
                    onContextMenu={(e) => {
                      if (!canRegisterEnvelope) return;
                      e.preventDefault();
                      setPendingDelete(env);
                    }}
                  >
                    <KeysTd>
                      <span className="text-[13.5px] font-bold text-gold-d">
                        {envelopeDisplayRef(env.id, env.createdAtUtc)}
                      </span>
                    </KeysTd>
                    <KeysTd col>
                      <span className="text-[13px] font-semibold text-heading">
                        {env.court || "—"}
                      </span>
                      <span className="text-[11px] text-text-3">
                        {env.circuit || "—"}
                      </span>
                    </KeysTd>
                    <KeysTd align="center">
                      <span className="inline-flex items-center text-[14px] font-extrabold tabular-nums text-heading">
                        {env.keysCountActual}
                        {env.countMismatch ? <MismatchIcon /> : null}
                      </span>
                    </KeysTd>
                    <KeysTd>
                      <span className="font-semibold text-text-2">
                        {env.requestNumber || "—"}
                      </span>
                    </KeysTd>
                    <KeysTd align="center">
                      <span className="text-[13.5px] font-bold tabular-nums text-text-2">
                        {env.assignments.length}
                      </span>
                    </KeysTd>
                    <KeysTd>
                      <KeysStatusPill
                        label={scenarioLabel(env.receiveScenario)}
                        color={scenarioColor(env.receiveScenario)}
                      />
                    </KeysTd>
                    <KeysTd>
                      <KeysStatusPill
                        label={envelopeStatusLabel(env.status)}
                        color={envelopeStatusColor(env.status)}
                      />
                    </KeysTd>
                    <KeysTd align="center" className="text-text-3">
                      <ChevronIcon />
                    </KeysTd>
                  </KeysGridRow>
                );
              })
            )}
          </div>

          {/* Mobile cards — لغة المعاين */}
          <div className="lg:hidden">
            <ActiveQueueMobileCards
              items={mobileCardItems}
              pending={!ready}
              emptyMessage="لا توجد ظروف مطابقة"
            />
          </div>
        </div>
      </div>

      {canRegisterEnvelope && filtered.length > 0 ? (
        <p className="m-0 mt-3 hidden text-[11px] text-text-3 lg:block">
          زر يمين على الصف لفتح تأكيد حذف الظرف.
        </p>
      ) : null}

      <RegisterKeyEnvelopeModal
        open={registerOpen}
        busy={false}
        onClose={closeRegisterModal}
        initialRequestNumber={registerRequestPrefill}
        operationsTaskId={registerTaskId}
        onRegistered={(id) => {
          invalidateEnvelopes();
          openEnvelope(id);
        }}
      />
      {pendingDelete ? (
        <ModalOverlay onClick={() => setPendingDelete(null)}>
          <ModalCard
            onClick={(e) => e.stopPropagation()}
            className="max-w-[420px] p-0"
          >
            <ModalHeader>
              <ModalTitle>حذف الظرف</ModalTitle>
              <ModalClose onClick={() => setPendingDelete(null)}>×</ModalClose>
            </ModalHeader>
            <ModalBody className="space-y-2 p-5 text-[13px] text-text-2">
              <p>
                هل تريد حذف الظرف{" "}
                <span className="font-bold text-heading">
                  {envelopeDisplayRef(
                    pendingDelete.id,
                    pendingDelete.createdAtUtc,
                  )}
                </span>
                ؟
              </p>
              <p className="text-[12px] text-text-3">لا يمكن التراجع عن الحذف.</p>
            </ModalBody>
            <ModalFooter className="justify-start gap-2">
              <Button
                variant="danger"
                loading={deletingId === pendingDelete.id}
                disabled={deletingId !== null}
                showActionToast={false}
                onClick={() => void confirmDeleteEnvelope()}
              >
                حذف
              </Button>
              <Button
                variant="outline"
                disabled={deletingId !== null}
                showActionToast={false}
                onClick={() => setPendingDelete(null)}
              >
                إلغاء
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </PageShell>
  );
}
