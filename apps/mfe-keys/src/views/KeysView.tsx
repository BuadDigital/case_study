"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import {
  Button,
  cn,
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiClockIcon,
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
  opsBtnGhost,
  opsChip,
  PageShell,
  PanelSkeleton,
  type RowMoreMenuItem,
  ShowAllEye,
  SkeletonTableRows,
  Table,
  TableFrame,
  TBody,
  Td,
  TdAction,
  TdLtr,
  Th,
  ThAction,
  THead,
  Tr,
  useShowAllEyeBlink,
  useToast,
} from "@platform/ui-kit";
import {
  ActiveQueueMobileCards,
  type ActiveQueueMobileCardItem,
} from "@platform/app-shared/components/ActiveQueueMobileCards";
import { KeysEmpty, KeysStatusPill } from "../components/KeysHtmlPrimitives";
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
import {
  useInvalidateKeyEnvelopes,
  useKeyEnvelopesQuery,
} from "../query/keys-queries";

type StatusFilter = "all" | "reviewer" | "assessor" | "external" | "returned";
type ListTab = "envelopes" | "fees";

const KeyEnvelopeDetailPage = dynamic(
  () =>
    import("../components/KeyEnvelopeDetailModal").then(
      (m) => m.KeyEnvelopeDetailPage,
    ),
  {
    ssr: false,
    loading: () => <PanelSkeleton className="min-h-[40vh] p-4" />,
  },
);
const KeyEnvelopeFeesPanel = dynamic(
  () =>
    import("../components/KeyEnvelopeFeesPanel").then(
      (m) => m.KeyEnvelopeFeesPanel,
    ),
  {
    loading: () => <PanelSkeleton className="min-h-[40vh] p-4" />,
  },
);
const RegisterKeyEnvelopeModal = dynamic(
  () =>
    import("../components/RegisterKeyEnvelopeModal").then(
      (m) => m.RegisterKeyEnvelopeModal,
    ),
  { ssr: false },
);

// Used to always mount so the chunk loaded on screen open despite splitting — now mounts on
// open only, with prefetch on button hover (bundle-preload).
const preloadRegisterKeyEnvelopeModal = () =>
  void import("../components/RegisterKeyEnvelopeModal");

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
  const { role, hasCapability } = useAppAccess();
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
  // Confirming collection belongs to finance, matching the manage-financial gate on
  // POST /api/key-envelopes/{id}/fee-collected.
  const canCollectFee = !viewOnly && hasCapability("manage-financial");

  const envelopesQuery = useKeyEnvelopesQuery();
  const invalidateEnvelopes = useInvalidateKeyEnvelopes();
  const envelopes = envelopesQuery.data ?? [];
  const ready = !envelopesQuery.isPending;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showOut, setShowOut] = useState(false);
  const { blink: eyeBlink, toggleOpen: toggleShowOut } = useShowAllEyeBlink();
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
    let delivered = 0;
    let pendingMatch = 0;
    let readyToDeliver = 0;
    for (const e of envelopes) {
      if (isEnvelopeOutOfCustody(e.status)) delivered += 1;
      let pendingInEnvelope = 0;
      for (const a of e.assignments) {
        if (a.status === "pending") pendingInEnvelope += 1;
      }
      pendingMatch += pendingInEnvelope;
      if (
        e.status !== "returned" &&
        e.assignments.length > 0 &&
        pendingInEnvelope === 0
      ) {
        readyToDeliver += 1;
      }
    }
    const inCustody = total - delivered;
    const active = inCustody;
    return { total, delivered, inCustody, active, pendingMatch, readyToDeliver };
  }, [envelopes]);

  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return envelopes.filter((e) => {
      if (statusFilter !== "all") {
        if (e.status !== statusFilter) return false;
      } else if (!showOut && isEnvelopeOutOfCustody(e.status)) {
        return false;
      }
      if (!q) return true;
      const deeds = e.assignments.map((a) => a.deedNumber).join(" ");
      const ref = envelopeDisplayRef(e.id, e.createdAtUtc, e.referenceNumber);
      return `${ref} ${e.requestNumber} ${e.court} ${e.circuit} ${deeds}`
        .toLowerCase()
        .includes(q);
    });
  }, [envelopes, deferredSearch, statusFilter, showOut]);

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
        title: envelopeDisplayRef(env.id, env.createdAtUtc, env.referenceNumber),
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
          canCollect={canCollectFee}
          onOpenEnvelope={(id) => openEnvelope(id)}
          onBack={backToList}
        />
        {registerOpen ? (
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
        ) : null}
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
          <span className={opsChip}>
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
              opsBtnGhost,
              "show-all-btn-motion h-[38px] px-3.5 text-[12.5px] max-lg:flex-1",
            )}
            onClick={() => setShowOut(toggleShowOut)}
          >
            <ShowAllEye open={showOut} blink={eyeBlink} />
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
              onMouseEnter={preloadRegisterKeyEnvelopeModal}
              onFocus={preloadRegisterKeyEnvelopeModal}
            >
              <PlusIcon />
              تسجيل ظرف مفاتيح
            </OperationalToolbarPrimaryButton>
          ) : null}
        </div>
      </div>

      {/* Desktop table — keyDrawList */}
      <TableFrame className="hidden lg:block">
        <Table className="min-w-[960px]" pending={!ready}>
          <THead>
            <Tr hoverable={false}>
              <Th>الرقم المرجعي</Th>
              <Th>المحكمة / الدائرة</Th>
              <Th className="text-center">عدد المفاتيح</Th>
              <Th>رقم الطلب</Th>
              <Th className="text-center">الصكوك</Th>
              <Th>سيناريو الاستلام</Th>
              <Th>العهدة</Th>
              <ThAction aria-hidden />
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={6} cols={8} />
            ) : filtered.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={8} className="!border-b-0 !p-0">
                  <KeysEmpty
                    title="لا توجد ظروف مطابقة"
                    sub="جرّب تعديل البحث أو الفلاتر"
                  />
                </Td>
              </Tr>
            ) : (
              filtered.map((env) => {
                const out = isEnvelopeOutOfCustody(env.status);
                return (
                  <Tr
                    key={env.id}
                    className={cn(
                      "[content-visibility:auto] [contain-intrinsic-size:auto_120px]",
                      out && "opacity-55 saturate-[0.6]",
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEnvelope(env.id)}
                    onContextMenu={(e) => {
                      if (!canRegisterEnvelope) return;
                      e.preventDefault();
                      setPendingDelete(env);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openEnvelope(env.id);
                      }
                    }}
                  >
                    <TdLtr
                      bare
                      className="text-[13.5px] font-bold text-gold-d"
                    >
                      {envelopeDisplayRef(
                        env.id,
                        env.createdAtUtc,
                        env.referenceNumber,
                      )}
                    </TdLtr>
                    <Td>
                      <div className="flex min-w-0 flex-col items-start gap-0.5">
                        <span className="text-[13px] font-semibold text-heading">
                          {env.court || "—"}
                        </span>
                        <span className="text-[11px] text-text-3">
                          {env.circuit || "—"}
                        </span>
                      </div>
                    </Td>
                    <Td className="text-center">
                      <span className="inline-flex items-center text-[14px] font-extrabold tabular-nums text-heading">
                        {env.keysCountActual}
                        {env.countMismatch ? <MismatchIcon /> : null}
                      </span>
                    </Td>
                    <TdLtr bare className="font-semibold text-text-2">
                      {env.requestNumber || "—"}
                    </TdLtr>
                    <Td className="text-center">
                      <span className="text-[13.5px] font-bold tabular-nums text-text-2">
                        {env.assignments.length}
                      </span>
                    </Td>
                    <Td>
                      <KeysStatusPill
                        label={scenarioLabel(env.receiveScenario)}
                        color={scenarioColor(env.receiveScenario)}
                      />
                    </Td>
                    <Td>
                      <KeysStatusPill
                        label={envelopeStatusLabel(env.status)}
                        color={envelopeStatusColor(env.status)}
                      />
                    </Td>
                    <TdAction className="text-text-3">
                      <ChevronIcon />
                    </TdAction>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </TableFrame>

      {/* Mobile cards — inspector wording */}
      <div className="lg:hidden">
        <ActiveQueueMobileCards
          items={mobileCardItems}
          pending={!ready}
          emptyMessage="لا توجد ظروف مطابقة"
        />
      </div>

      {canRegisterEnvelope && filtered.length > 0 ? (
        <p className="m-0 mt-3 hidden text-[11px] text-text-3 lg:block">
          زر يمين على الصف لفتح تأكيد حذف الظرف.
        </p>
      ) : null}

      {registerOpen ? (
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
      ) : null}
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
                    pendingDelete.referenceNumber,
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
