"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import {
  Button,
  KpiBand,
  KpiCell,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  OperationalPanel,
  OperationalToolbarPrimaryButton,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageShell,
  PageToolbar,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  queueTableRowClassName,
  useToast,
} from "@platform/design-system";
import { KeyEnvelopeDetailPage } from "../components/KeyEnvelopeDetailModal";
import { KeyEnvelopeFeesPanel } from "../components/KeyEnvelopeFeesPanel";
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

function SearchEmptyIcon() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-3"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
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
      if (isEnvelopeOutOfCustody(e.status)) return false;
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
      <PageShell variant="canvas" className="min-h-0 flex-1 space-y-4">
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
      <PageShell variant="canvas" className="min-h-0 flex-1 space-y-4">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 border-none bg-transparent p-0 text-[12.5px] font-semibold text-text-2 hover:text-primary"
          onClick={backToList}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          محفظة المفاتيح
        </button>
        <KeyEnvelopeFeesPanel
          canCollect={canRegisterEnvelope || isSuperAdmin(role)}
          onOpenEnvelope={(id) => openEnvelope(id)}
        />
        <RegisterKeyEnvelopeModal
          open={registerOpen}
          busy={false}
          onClose={closeRegisterModal}
          initialRequestNumber={registerRequestPrefill}
          onRegistered={(id) => {
            invalidateEnvelopes();
            openEnvelope(id);
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1 space-y-4">
      <KpiBand>
        <KpiCell
          first
          icon={<KpiEnvIcon />}
          iconClass="bg-[var(--gold-soft)] text-[var(--gold-d)]"
          label="إجمالي الأظرف"
          value={ready ? kpis.total : "—"}
          sub={
            ready ? (
              <>
                <span className="size-1.5 rounded-full bg-gold" />
                {kpis.delivered} مستلمة، المتبقي في العهدة{" "}
                <b className="text-[12.5px] text-[var(--gold-d)]">
                  {kpis.inCustody}
                </b>
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
          sub="صكوك لم تُجرّب مفاتيحها"
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

      <PageToolbar className="mb-0 flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b-0 bg-transparent px-0 py-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h2 className="m-0 text-[17px] font-extrabold text-heading">
            ظروف المفاتيح
          </h2>
          <span className="inline-flex items-center rounded-[6px] bg-[var(--gold-soft)] px-2.5 py-[3px] text-[12px] font-bold text-[var(--gold-d)]">
            {ready ? `${filtered.length} نتيجة` : "…"}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <OperationalToolbarSearch
            type="search"
            placeholder="رقم الطلب، أو المحكمة أو الصك..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث الظروف"
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            className="show-all-btn-motion h-[38px] gap-[7px] border border-border-md bg-surface px-3.5 text-[12.5px] font-medium text-text-2 hover:border-gold hover:bg-surface hover:text-gold-d"
            showActionToast={false}
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
            <span>
              {showOut
                ? "إخفاء المستلمة (خارج العهدة)"
                : "إظهار المستلمة (خارج العهدة)"}
            </span>
          </Button>
          <OperationalToolbarSelect
            className="shrink-0"
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
              onClick={() => setRegisterOpen(true)}
            >
              <PlusIcon />
              تسجيل ظرف مفاتيح
            </OperationalToolbarPrimaryButton>
          ) : null}
        </div>
      </PageToolbar>

      <OperationalPanel className="shrink-0 overflow-visible">
        <Table pending={!ready}>
          <THead>
            <Tr hoverable={false}>
              <Th className="text-start">الرقم المرجعي</Th>
              <Th className="text-start">المحكمة / الدائرة</Th>
              <Th className="text-center">عدد المفاتيح</Th>
              <Th className="text-start">رقم الطلب</Th>
              <Th className="text-center">الصكوك</Th>
              <Th className="text-start">سيناريو الاستلام</Th>
              <Th className="text-start">العهدة</Th>
              <Th className="w-11" aria-label="فتح" />
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={8} cols={8} />
            ) : filtered.length === 0 ? (
              <Tr hoverable={false}>
                <Td
                  colSpan={8}
                  className="cursor-default px-5 py-[54px] text-center text-text-3"
                >
                  <div className="flex flex-col items-center justify-center">
                    <span className="mb-3 opacity-60">
                      <SearchEmptyIcon />
                    </span>
                    <span className="text-[14px] font-bold text-text-2">
                      لا توجد ظروف مطابقة
                    </span>
                    <span className="mt-1 text-[13px]">
                      جرب تعديل البحث أو الفلاتر
                    </span>
                  </div>
                </Td>
              </Tr>
            ) : (
              filtered.map((env) => {
                const out = isEnvelopeOutOfCustody(env.status);
                const scenColor = scenarioColor(env.receiveScenario);
                const stColor = envelopeStatusColor(env.status);
                return (
                  <Tr
                    key={env.id}
                    hoverable={false}
                    className={cn(
                      "group",
                      queueTableRowClassName,
                      out && "opacity-55 saturate-[0.6]",
                    )}
                    onClick={() => openEnvelope(env.id)}
                    onContextMenu={(e) => {
                      if (!canRegisterEnvelope) return;
                      e.preventDefault();
                      setPendingDelete(env);
                    }}
                  >
                    <Td>
                      <span className="text-[13.5px] font-bold text-primary">
                        {envelopeDisplayRef(env.id, env.createdAtUtc)}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-[13px] font-semibold text-heading">
                          {env.court || "—"}
                        </span>
                        <span className="text-[11px] text-text-3">
                          {env.circuit || "—"}
                        </span>
                      </div>
                    </Td>
                    <Td className="text-center">
                      <span className="inline-flex items-center justify-center tabular-nums font-extrabold text-heading">
                        {env.keysCountActual}
                        {env.countMismatch ? <MismatchIcon /> : null}
                      </span>
                    </Td>
                    <Td className="font-semibold text-text-2">
                      {env.requestNumber || "—"}
                    </Td>
                    <Td className="text-center tabular-nums font-bold text-heading">
                      {env.assignments.length}
                    </Td>
                    <Td>
                      <StatusPill
                        label={scenarioLabel(env.receiveScenario)}
                        style={{ base: scenColor, fg: scenColor }}
                      />
                    </Td>
                    <Td>
                      <StatusPill
                        label={envelopeStatusLabel(env.status)}
                        style={{ base: stColor, fg: stColor }}
                      />
                    </Td>
                    <Td className="text-center text-text-3">
                      <ChevronIcon />
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </OperationalPanel>

      {canRegisterEnvelope && filtered.length > 0 ? (
        <p className="m-0 text-[11px] text-text-3">
          زر يمين على الصف لفتح تأكيد حذف الظرف.
        </p>
      ) : null}

      <RegisterKeyEnvelopeModal
        open={registerOpen}
        busy={false}
        onClose={closeRegisterModal}
        initialRequestNumber={registerRequestPrefill}
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
                disabled={deletingId !== null}
                showActionToast={false}
                onClick={() => void confirmDeleteEnvelope()}
              >
                {deletingId === pendingDelete.id ? "جاري الحذف…" : "حذف"}
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
