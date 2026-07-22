"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Button,
  Input,
  Label,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
  StatusPill,
  cn,
  useToast,
} from "@platform/design-system";
import { useDistributionAssigneesQuery } from "@settings/mfe/query/settings-queries";
import {
  confirmEnvelopeAssignment,
  confirmEnvelopeHandoff,
  createEnvelopeHandoff,
  loadKeyEnvelope,
  uploadEnvelopeAttachment,
} from "../lib/keys-envelope-api";
import {
  assignmentStatusColor,
  assignmentStatusLabel,
  envelopeDisplayRef,
  envelopeStatusColor,
  envelopeStatusLabel,
  handoffKindColor,
  handoffKindLabel,
  handoffStateColor,
  handoffStateLabel,
  scenarioColor,
  scenarioLabel,
  type KeyAssignmentMatchStatus,
  type KeyEnvelopeAssignment,
  type KeyEnvelopeHandoff,
  type KeyEnvelopeRow,
} from "../lib/keys-envelope-types";
import { KeyEnvelopeAttachmentPreview } from "./KeyEnvelopeAttachmentPreview";

/** Exact JobTitle — same allowlist as distribution assignees. */
const FIELD_INSPECTOR_JOB_TITLE = "معاين ميداني";

/** HTML detail dates show as DD/MM/YYYY (screenshot + sample data). */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Hide raw user ids that were wrongly stored as display names. */
function displayPersonName(value: string | null | undefined): string {
  const v = value?.trim() || "";
  if (!v) return "—";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
    return "—";
  }
  return v;
}

function EnvIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 7 12 13 2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
    </svg>
  );
}

function HandoffIcon({ size = 15 }: { size?: number }) {
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
      <path d="M16 3h5v5M21 3l-8 8M8 21H3v-5M3 21l8-8" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function BackChevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="-scale-x-100"
      aria-hidden
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function propertyLabel(
  env: KeyEnvelopeRow,
  a: KeyEnvelopeAssignment,
): string {
  const linked = env.linkedProperties.find(
    (p) =>
      p.deedNumber === a.deedNumber ||
      (a.propertyId && p.propertyId === a.propertyId),
  );
  if (!linked) return "العقار";
  const parts = [linked.city, linked.ownerName].filter(Boolean);
  return parts.length ? parts.join(" · ") : linked.poNumber || "العقار";
}

function poForAssignment(
  env: KeyEnvelopeRow,
  a: KeyEnvelopeAssignment,
): string {
  const linked = env.linkedProperties.find(
    (p) =>
      p.deedNumber === a.deedNumber ||
      (a.propertyId && p.propertyId === a.propertyId),
  );
  return linked?.poNumber || "—";
}

type DetailTab = "assign" | "custody";

const ASSIGN_COLS =
  "minmax(112px,1fr) minmax(118px,1fr) minmax(105px,.95fr) 128px minmax(85px,.75fr) 218px";

export function KeyEnvelopeDetailPage({
  envelopeId,
  canEdit,
  onBack,
  onChanged,
  backLabel = "محفظة المفاتيح",
}: {
  envelopeId: string;
  canEdit: boolean;
  onBack: () => void;
  onChanged: () => void;
  backLabel?: string;
}) {
  const { showToast } = useToast();
  const { data: staffResult } = useDistributionAssigneesQuery();
  const fieldInspectors = useMemo(() => {
    const users = staffResult?.users ?? [];
    return users
      .filter(
        (u) =>
          u.status !== "Inactive" &&
          u.role.trim() === FIELD_INSPECTOR_JOB_TITLE &&
          (u.id.trim() || u.distributionAssigneeId?.trim()),
      )
      .map((u) => ({
        id: u.id.trim() || u.distributionAssigneeId!.trim(),
        name: u.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [staffResult?.users]);

  const [env, setEnv] = useState<KeyEnvelopeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DetailTab>("assign");
  const [busy, setBusy] = useState(false);
  const [matchTarget, setMatchTarget] = useState<KeyEnvelopeAssignment | null>(
    null,
  );
  const [handoffOpen, setHandoffOpen] = useState(false);

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setTab("assign");
      setMatchTarget(null);
      setHandoffOpen(false);
      const result = await loadKeyEnvelope(envelopeId);
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setEnv(result.data);
      } else {
        showToastRef.current(result.error, "error");
        onBackRef.current();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envelopeId]);

  const sortedAssignments = useMemo(() => {
    if (!env) return [];
    return [...env.assignments].sort((a, b) => {
      const ap = a.status === "pending" ? 0 : 1;
      const bp = b.status === "pending" ? 0 : 1;
      return ap - bp;
    });
  }, [env]);

  async function refresh(next?: KeyEnvelopeRow) {
    if (next) {
      setEnv(next);
      onChanged();
      return;
    }
    const result = await loadKeyEnvelope(envelopeId);
    if (result.ok) {
      setEnv(result.data);
      onChanged();
    }
  }

  async function handleConfirmAssignment(
    assignmentId: string,
    status: KeyAssignmentMatchStatus,
    notes?: string,
  ) {
    if (!env) return;
    const deed =
      env.assignments.find((a) => a.id === assignmentId)?.deedNumber ?? "";
    setBusy(true);
    const result = await confirmEnvelopeAssignment(
      env.id,
      assignmentId,
      status,
      notes,
    );
    setBusy(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    setMatchTarget(null);
    showToast(
      `سُجّلت نتيجة الصك ${deed} — ${assignmentStatusLabel(status)}.`,
      "success",
    );
    await refresh(result.data);
  }

  async function handleConfirmHandoff(handoffId: string) {
    if (!env) return;
    setBusy(true);
    const result = await confirmEnvelopeHandoff(env.id, handoffId);
    setBusy(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast("تم تأكيد استلام المناولة.", "success");
    await refresh(result.data);
  }

  const stColor = env ? envelopeStatusColor(env.status) : "#8a8d96";
  const scColor = env ? scenarioColor(env.receiveScenario) : "#8a8d96";
  const handoffBtnLabel =
    env?.status === "reviewer"
      ? "تسليم الظرف"
      : env?.status === "returned"
        ? "مناولة"
        : "استلام الظرف";

  const hasAttachments = Boolean(
    env?.photoAttachmentId ||
      env?.receiptAttachmentId ||
      env?.thirdPartyLetterAttachmentId ||
      env?.contactPhones,
  );

  return (
    <>
      <button
        type="button"
        className="mb-2 inline-flex items-center gap-[7px] border-none bg-transparent p-0 py-1.5 font-[inherit] text-[12.5px] font-semibold text-text-2 transition-colors hover:text-[var(--gold-d)]"
        onClick={onBack}
      >
        <BackChevron />
        <span>{backLabel}</span>
      </button>

      {loading || !env ? (
        <div className="rounded-[14px] border border-border bg-surface px-5 py-8 text-sm text-text-3 shadow-[var(--shadow)]">
          جاري التحميل…
        </div>
      ) : (
        <>
          {/* pp-head — summary card */}
          <div className="mb-[18px] rounded-[14px] border border-border bg-surface px-[22px] py-[18px] shadow-[var(--shadow)]">
            <div className="flex flex-wrap items-start justify-between gap-[18px]">
              <div className="flex min-w-0 items-center gap-[15px]">
                <span className="grid size-[50px] shrink-0 place-items-center rounded-[13px] bg-[var(--gold-soft)] text-[var(--gold-d)]">
                  <EnvIcon />
                </span>
                <div className="min-w-0">
                  <h1 className="m-0 flex flex-wrap items-center gap-2.5 text-[18px] font-extrabold text-heading">
                    <span
                      className="text-[19px] font-bold text-[var(--gold-d)]"
                      dir="ltr"
                    >
                      {envelopeDisplayRef(env.id, env.createdAtUtc)}
                    </span>
                    <span className="text-[13px] font-semibold text-text-3">
                      طلب {env.requestNumber}
                    </span>
                    <StatusPill
                      label={envelopeStatusLabel(env.status)}
                      style={{ base: stColor, fg: stColor }}
                    />
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[12.5px] text-text-2">
                    <span>{env.court || "—"}</span>
                    <span className="text-text-3">·</span>
                    <span>{env.circuit || "—"}</span>
                  </div>
                </div>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  className="inline-flex h-[38px] items-center gap-[7px] rounded-lg border border-border-md bg-surface px-[13px] text-[13px] font-medium text-text-2 transition-colors hover:border-[var(--gold)] hover:text-[var(--gold-d)]"
                  onClick={() => setHandoffOpen(true)}
                >
                  <HandoffIcon />
                  <span>{handoffBtnLabel}</span>
                </button>
              ) : null}
            </div>

            {env.countMismatch ? (
              <div
                className="mt-3.5 flex items-center gap-[11px] rounded-[10px] px-[22px] py-3 text-[12.5px] font-semibold leading-relaxed"
                style={{
                  background: "color-mix(in srgb, #d9694f 9%, transparent)",
                  color: "#a32d2d",
                }}
              >
                <AlertIcon />
                <span>
                  تعارض في العدد: المكتوب على الظرف {env.keysCountLabeled}{" "}
                  والفعلي بعد العد {env.keysCountActual}. يلزم تعديل خطاب
                  الاستلام في المحكمة.
                </span>
              </div>
            ) : null}

            {/* pp-summary — divider cells */}
            <div className="mt-4 flex flex-wrap border-t border-border pt-3.5">
              <SummaryCell label="سيناريو الاستلام">
                <StatusPill
                  label={scenarioLabel(env.receiveScenario)}
                  style={{ base: scColor, fg: scColor }}
                />
              </SummaryCell>
              <SummaryCell label="مستلم الظرف">
                {displayPersonName(env.createdByName)}
              </SummaryCell>
              <SummaryCell label="عدد المفاتيح">
                <span className="tabular-nums">{env.keysCountActual}</span>
              </SummaryCell>
              <SummaryCell label="الصكوك المرتبطة بالطلب">
                <span className="tabular-nums">{env.assignments.length}</span>
              </SummaryCell>
              <SummaryCell label="تاريخ التسجيل" last>
                <span dir="ltr">{formatDate(env.createdAtUtc)}</span>
              </SummaryCell>
            </div>

            {hasAttachments ? (
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-border pt-3.5">
                <span className="text-[12px] font-semibold text-text-3">
                  المرفقات:
                </span>
                {env.receiptAttachmentId ? (
                  <KeyEnvelopeAttachmentPreview
                    attachmentId={env.receiptAttachmentId}
                    label="خطاب الاستلام"
                    variant="chip"
                    attKind="receipt"
                  />
                ) : null}
                {env.photoAttachmentId ? (
                  <KeyEnvelopeAttachmentPreview
                    attachmentId={env.photoAttachmentId}
                    label="صورة الظرف"
                    variant="chip"
                    attKind="photo"
                  />
                ) : null}
                {env.thirdPartyLetterAttachmentId ? (
                  <KeyEnvelopeAttachmentPreview
                    attachmentId={env.thirdPartyLetterAttachmentId}
                    label="خطاب الطرف الثالث"
                    variant="chip"
                    attKind="letter"
                  />
                ) : null}
                {env.contactPhones ? (
                  <span className="inline-flex items-center gap-[7px] rounded-lg border border-border-md bg-surface-2 px-[11px] py-1.5 text-[12px] font-semibold text-text-2">
                    <PhoneIcon />
                    <span dir="ltr">{env.contactPhones}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* tabs */}
          <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
            {(
              [
                {
                  id: "assign" as const,
                  label: "إسناد الصكوك",
                  count: env.assignments.length,
                },
                {
                  id: "custody" as const,
                  label: "سلسلة العهدة",
                  count: env.handoffs.length + 1,
                },
              ] as const
            ).map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    "relative -mb-px border-b-2 px-[15px] py-2.5 text-[13px] font-semibold transition-colors",
                    on
                      ? "border-[var(--gold)] text-[var(--gold-d)]"
                      : "border-transparent text-text-2 hover:text-heading",
                  )}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  <span className="ms-[5px] inline-flex rounded-full border border-border-md bg-surface-2 px-[7px] py-px text-[11px] text-text-3">
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {tab === "assign" ? (
            <AssignmentsPanel
              env={env}
              rows={sortedAssignments}
              canEdit={canEdit}
              busy={busy}
              onMatch={(a) => setMatchTarget(a)}
            />
          ) : (
            <CustodyPanel
              env={env}
              canEdit={canEdit}
              busy={busy}
              onConfirm={(id) => void handleConfirmHandoff(id)}
            />
          )}
        </>
      )}

      {matchTarget && env ? (
        <MatchResultModal
          deed={matchTarget.deedNumber}
          busy={busy}
          onClose={() => setMatchTarget(null)}
          onSave={(status, note) =>
            void handleConfirmAssignment(matchTarget.id, status, note)
          }
        />
      ) : null}

      {handoffOpen && env ? (
        <HandoffModal
          env={env}
          inspectors={fieldInspectors}
          busy={busy}
          onClose={() => setHandoffOpen(false)}
          onBusy={setBusy}
          onDone={async (next) => {
            setHandoffOpen(false);
            await refresh(next);
          }}
        />
      ) : null}
    </>
  );
}

/** @deprecated Use KeyEnvelopeDetailPage — kept for import compatibility. */
export const KeyEnvelopeDetailModal = KeyEnvelopeDetailPage;

function SummaryCell({
  label,
  children,
  last,
}: {
  label: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-2.5 min-w-[140px] flex-1 border-s border-border px-[18px] first:border-s-0 first:ps-0",
        last && "pe-0",
      )}
    >
      <div className="mb-[3px] text-[11px] text-text-3">{label}</div>
      <div className="min-h-[22px] text-[13.5px] font-semibold text-heading">
        {children}
      </div>
    </div>
  );
}

function AssignmentsPanel({
  env,
  rows,
  canEdit,
  busy,
  onMatch,
}: {
  env: KeyEnvelopeRow;
  rows: KeyEnvelopeAssignment[];
  canEdit: boolean;
  busy: boolean;
  onMatch: (a: KeyEnvelopeAssignment) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-md bg-surface px-[26px] py-[26px] text-center text-[13px] text-text-3">
        لا توجد إسنادات صكوك لهذا الظرف بعد.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-[var(--shadow)]">
      <div className="min-w-[780px]">
        <div
          className="grid border-b-2 border-[var(--gold)] bg-surface-2 text-[12px] font-bold text-heading"
          style={{ gridTemplateColumns: ASSIGN_COLS }}
        >
          <div className="flex items-center justify-start px-4 py-3.5 text-start">
            رقم الصك
          </div>
          <div className="flex items-center justify-start px-4 py-3.5 text-start">
            العقار
          </div>
          <div className="flex items-center justify-start px-4 py-3.5 text-start">
            أمر العمل
          </div>
          <div className="flex items-center justify-start px-4 py-3.5 text-start">
            حالة التجربة
          </div>
          <div className="flex items-center justify-start px-4 py-3.5 text-start">
            ملاحظة
          </div>
          <div className="flex items-center justify-center px-4 py-3.5">
            تأكيد ميداني
          </div>
        </div>
        {rows.map((a) => {
          const color = assignmentStatusColor(a.status);
          return (
            <div
              key={a.id}
              className="grid min-h-[52px] items-center border-b border-border transition-colors hover:bg-[var(--row-hover)] last:border-b-0"
              style={{ gridTemplateColumns: ASSIGN_COLS }}
            >
              <div className="px-4 py-3.5">
                <span className="text-[13.5px] font-bold text-[var(--gold-d)]">
                  {a.deedNumber}
                </span>
              </div>
              <div className="truncate px-4 py-3.5 text-[13px] text-text-2">
                {propertyLabel(env, a)}
              </div>
              <div className="flex flex-col items-start justify-center gap-[3px] px-4 py-3.5">
                <span className="text-[12px] font-semibold text-text-2">
                  {poForAssignment(env, a)}
                </span>
              </div>
              <div className="px-4 py-3.5">
                <StatusPill
                  label={assignmentStatusLabel(a.status)}
                  style={{ base: color, fg: color }}
                />
              </div>
              <div className="truncate px-4 py-3.5 text-[13px] text-text-2">
                {a.notes || "—"}
              </div>
              <div className="flex items-center justify-center px-4 py-3.5">
                {a.status === "pending" && canEdit ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex h-[30px] items-center whitespace-nowrap rounded-lg border border-border-md bg-surface px-3.5 text-[12px] font-medium text-[var(--gold-d)] transition-colors hover:border-[var(--gold)] disabled:opacity-60"
                    onClick={() => onMatch(a)}
                  >
                    تسجيل نتيجة المطابقة…
                  </button>
                ) : (
                  <span className="text-[11.5px] text-text-3">
                    {displayPersonName(a.confirmedByName) !== "—"
                      ? `أكّده ${displayPersonName(a.confirmedByName)}`
                      : a.status !== "pending"
                        ? "مؤكّد"
                        : "—"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustodyPanel({
  env,
  canEdit,
  busy,
  onConfirm,
}: {
  env: KeyEnvelopeRow;
  canEdit: boolean;
  busy: boolean;
  onConfirm: (handoffId: string) => void;
}) {
  const initialFrom =
    env.receiveScenario === "third_party" || env.receiveScenario === "party"
      ? `طرف آخر${env.contactPhones ? `: ${env.contactPhones}` : ""}`
      : env.court || "المحكمة";

  type ChainItem = {
    key: string;
    title: string;
    color: string;
    person: string;
    role: string;
    date: string;
    letter?: string | null;
    letterId?: string | null;
    stateLabel: string;
    stateColor: string;
    handoff?: KeyEnvelopeHandoff;
  };

  const chain: ChainItem[] = [
    {
      key: "initial",
      title: `استلام الظرف — بداية العهدة (من ${initialFrom})`,
      color: "#378add",
      person: displayPersonName(env.createdByName),
      role: "مراجع حكومي",
      date: formatDate(env.createdAtUtc),
      stateLabel: "مكتمل",
      stateColor: "#2f7a4d",
    },
    ...env.handoffs.map((h) => {
      const hc = handoffKindColor(h.kind);
      const sc = handoffStateColor(h.status);
      return {
        key: h.id,
        title: handoffKindLabel(h.kind),
        color: hc,
        person: displayPersonName(h.toParty || h.fromParty),
        role:
          h.kind === "internal"
            ? "معاين ميداني"
            : h.kind === "return_court"
              ? "محكمة"
              : h.kind === "external"
                ? "طرف خارجي"
                : handoffKindLabel(h.kind),
        date: formatDate(h.createdAtUtc),
        letter: h.letterNumber,
        letterId: h.letterAttachmentId,
        stateLabel: handoffStateLabel(h.status),
        stateColor: sc,
        handoff: h,
      };
    }),
  ];

  return (
    <div>
      <div className="mb-3 text-[13px] font-extrabold text-heading">
        سلسلة العهدة (من استلم ومن سلّم)
      </div>
      <div className="rounded-xl border border-border bg-surface px-[22px] py-1.5 shadow-[var(--shadow)]">
        {chain.map((item, i) => (
          <div
            key={item.key}
            className={cn(
              "flex items-start gap-[15px] py-4",
              i > 0 && "border-t border-border",
            )}
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-[10px]"
              style={{
                background: `color-mix(in srgb, ${item.color} 14%, transparent)`,
                color: item.color,
              }}
            >
              <HandoffIcon size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[14px] font-bold text-heading">
                  {item.title}
                </span>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={{
                    background: `color-mix(in srgb, ${item.stateColor} 15%, transparent)`,
                    color: item.stateColor,
                  }}
                >
                  {item.stateLabel}
                </span>
              </div>
              <div className="mt-[5px] text-[13px] text-text-2">
                {item.person} — {item.role}
              </div>
              {item.handoff?.status === "pending_confirm" && canEdit ? (
                <div className="mt-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex h-8 items-center gap-2 rounded-[9px] border-none bg-[var(--gold-d)] px-3.5 text-[12px] font-bold text-white shadow-[0_6px_16px_-6px_color-mix(in_srgb,var(--gold-d)_60%,transparent)] transition-[background,transform] hover:enabled:-translate-y-px hover:enabled:bg-[var(--gold)] disabled:opacity-60"
                    onClick={() => onConfirm(item.handoff!.id)}
                  >
                    تأكيد استلام المعاين
                  </button>
                </div>
              ) : null}
              {item.letter || item.letterId ? (
                <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--gold-d)]">
                  <FileIcon />
                  {item.letterId ? (
                    <KeyEnvelopeAttachmentPreview
                      attachmentId={item.letterId}
                      label={item.letter || "خطاب المناولة"}
                      variant="chip"
                      chipColor="var(--gold-d)"
                      className="!m-0 !border-0 !bg-transparent !p-0"
                    />
                  ) : (
                    item.letter
                  )}
                </div>
              ) : null}
            </div>
            <div
              className="shrink-0 whitespace-nowrap text-[12px] text-text-3"
              dir="ltr"
            >
              {item.date}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchResultModal({
  deed,
  busy,
  onClose,
  onSave,
}: {
  deed: string;
  busy: boolean;
  onClose: () => void;
  onSave: (status: KeyAssignmentMatchStatus, note?: string) => void;
}) {
  const [sel, setSel] = useState<KeyAssignmentMatchStatus | "">("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  /** Exact tiles from HTML `openKeyResult` / Case Study.html. */
  const tiles: {
    id: KeyAssignmentMatchStatus;
    label: string;
    hint: string;
    color: string;
  }[] = [
    {
      id: "matched",
      label: "مطابق",
      hint: "فُتح العقار بالمفاتيح",
      color: "#2f7a4d",
    },
    {
      id: "partial",
      label: "مطابقة جزئية",
      hint: "بعض الوحدات فقط",
      color: "#b58a3c",
    },
    {
      id: "unmatched",
      label: "غير مطابق",
      hint: "لا مفتاح مناسب",
      color: "#d9694f",
    },
    {
      id: "unmatched_inspected",
      label: "غير مطابق — تمت المعاينة",
      hint: "عوين العقار بالكامل رغم عدم المطابقة",
      color: "#8a5e14",
    },
    {
      id: "missing",
      label: "مفقود",
      hint: "لم يُعثر على المفتاح",
      color: "#c0553d",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-[rgba(16,43,78,0.42)] px-4 py-[6vh] backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <style>{`@keyframes keyModalIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}`}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kr-match-title"
        className="w-full max-w-[520px] overflow-hidden rounded-[16px] border border-border bg-surface shadow-[0_24px_60px_-18px_rgba(16,43,78,0.5)] [animation:keyModalIn_0.22s_ease_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center border-b border-border px-[22px] py-4">
          <h2
            id="kr-match-title"
            className="m-0 text-center text-[16px] font-extrabold text-heading"
          >
            تسجيل نتيجة المطابقة
          </h2>
          <button
            type="button"
            className="absolute start-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-[9px] border-none bg-surface-2 text-[15px] leading-none text-text-2 transition-[background,color] duration-150 hover:bg-row-hover hover:text-heading"
            onClick={onClose}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-[22px] py-5">
          {err ? (
            <div className="rounded-[10px] border border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] px-3 py-2.5 text-[12.5px] font-semibold text-[#a32d2d]">
              {err}
            </div>
          ) : null}
          <div className="rounded-[10px] border border-border bg-surface-2/40 px-3.5 py-2.5 text-[12.5px] text-text-2">
            نتيجة المطابقة الميدانية للصك{" "}
            <b className="text-heading">{deed}</b>.
          </div>
          <div>
            <Label>نتيجة تجربة المفاتيح ميدانياً *</Label>
            <div className="mt-1.5 grid gap-2">
              {tiles.map((t) => {
                const on = sel === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      "flex min-h-[52px] items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5 text-start font-[inherit] transition-all duration-100",
                      on
                        ? "border-[var(--gold)] bg-[var(--gold-soft)]"
                        : "border-border-md bg-surface-2",
                    )}
                    onClick={() => {
                      setSel(t.id);
                      setErr("");
                    }}
                  >
                    <span
                      className="size-3.5 shrink-0 rounded-full border-2"
                      style={{
                        borderColor: t.color,
                        background: on ? t.color : "transparent",
                      }}
                    />
                    <span>
                      <span
                        className="block text-[13.5px] font-extrabold"
                        style={{ color: t.color }}
                      >
                        {t.label}
                      </span>
                      <span className="mt-px block text-[11.5px] text-text-3">
                        {t.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {sel && sel !== "matched" ? (
            <div>
              <Label htmlFor="kr-note">ملاحظة *</Label>
              <Input
                id="kr-note"
                value={note}
                placeholder="مثال: عمارة 6 شقق — 5 مفاتيح مطابقة، شقة رقم 3 بدون مفتاح"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-start gap-2 border-t border-border px-[22px] py-3.5">
          <Button
            variant="outline"
            disabled={busy}
            showActionToast={false}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            loading={busy}
            showActionToast={false}
            onClick={() => {
              if (!sel) {
                setErr("اختر نتيجة المطابقة أولاً.");
                return;
              }
              if (sel !== "matched" && !note.trim()) {
                setErr(
                  "الملاحظة إلزامية لغير المطابق الكامل — سجّل تفاصيل الوحدات والمفاتيح.",
                );
                return;
              }
              onSave(
                sel,
                sel === "matched"
                  ? "فُتح العقار بالمفاتيح (تأكيد ميداني)"
                  : note.trim(),
              );
            }}
          >
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
              <path d="M20 6 9 17l-5-5" />
            </svg>
            حفظ النتيجة
          </Button>
        </div>
      </div>
    </div>
  );
}

function HandoffModal({
  env,
  inspectors,
  busy,
  onClose,
  onBusy,
  onDone,
}: {
  env: KeyEnvelopeRow;
  inspectors: { id: string; name: string }[];
  busy: boolean;
  onClose: () => void;
  onBusy: (v: boolean) => void;
  onDone: (next: KeyEnvelopeRow) => Promise<void>;
}) {
  const { showToast } = useToast();
  const deliver = env.status === "reviewer";
  const [kind, setKind] = useState("internal");
  const [toUserId, setToUserId] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyOrg, setPartyOrg] = useState("");
  const [partyRole, setPartyRole] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [letterId, setLetterId] = useState<string | null>(null);
  const [letterName, setLetterName] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const notesByKind: Record<string, string> = {
    internal:
      "التسليم الداخلي يُسجَّل بحالة «بانتظار التأكيد» ثم يؤكّده المعاين — وتنتقل العهدة إليه.",
    external:
      "التسليم الخارجي يتطلب إثباتاً: صورة/مستند، أو بيانات التواصل للجهة.",
    return_court:
      "المحكمة جهة معرَّفة — لا يلزم إثبات استلام؛ الإرجاع يُنهي دورة الظرف.",
  };

  if (!deliver) {
    const pending = [...env.handoffs]
      .reverse()
      .find((h) => h.status === "pending_confirm");
    const rawHolder =
      pending?.toParty ||
      env.handoffs[env.handoffs.length - 1]?.toParty ||
      "";
    const resolvedHolder = displayPersonName(rawHolder);
    const holder =
      resolvedHolder === "—" ? "الطرف الحالي" : resolvedHolder;

    return (
      <ModalOverlay onClick={onClose}>
        <ModalCard
          onClick={(e) => e.stopPropagation()}
          className="max-w-[520px] p-0"
        >
          <ModalHeader className="relative border-b border-border px-5 py-4">
            <ModalTitle className="text-center text-[16px] font-extrabold text-heading">
              استلام الظرف — {env.requestNumber}
            </ModalTitle>
            <ModalClose
              className="absolute start-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[9px] bg-surface-2"
              onClick={onClose}
            >
              ✕
            </ModalClose>
          </ModalHeader>
          <ModalBody className="px-5 py-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[color-mix(in_srgb,#378add_14%,transparent)] text-[#378add]">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <div>
                <div className="mb-1 text-[14px] font-extrabold text-heading">
                  تأكيد استلام الظرف {env.requestNumber}
                </div>
                <div className="text-[12.5px] leading-relaxed text-text-2">
                  الظرف بعهدة <b>{holder}</b> — يكفي تأكيد الاستلام لتعود العهدة
                  إليك ويوثَّق ذلك في السجل.
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="justify-start gap-2 border-t border-border px-5 py-3.5">
            <Button
              variant="outline"
              disabled={busy}
              showActionToast={false}
              onClick={onClose}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!pending}
              showActionToast={false}
              onClick={async () => {
                if (!pending) {
                  showToast("لا توجد مناولة بانتظار التأكيد.", "error");
                  return;
                }
                onBusy(true);
                const result = await confirmEnvelopeHandoff(
                  env.id,
                  pending.id,
                );
                onBusy(false);
                if (!result.ok) {
                  showToast(result.error, "error");
                  return;
                }
                showToast(
                  `تم تأكيد استلام الظرف ${env.requestNumber}.`,
                  "success",
                );
                await onDone(result.data);
              }}
            >
              تأكيد الاستلام
            </Button>
          </ModalFooter>
        </ModalCard>
      </ModalOverlay>
    );
  }

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard
        onClick={(e) => e.stopPropagation()}
        className="max-w-[560px] p-0"
      >
        <ModalHeader className="relative border-b border-border px-5 py-4">
          <ModalTitle className="text-center text-[16px] font-extrabold text-heading">
            تسليم الظرف — {env.requestNumber}
          </ModalTitle>
          <ModalClose
            className="absolute start-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[9px] bg-surface-2"
            onClick={onClose}
          >
            ✕
          </ModalClose>
        </ModalHeader>
        <ModalBody className="max-h-[min(70vh,560px)] space-y-3.5 overflow-y-auto px-5 py-5">
          {err ? (
            <div className="rounded-[10px] border border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] px-3 py-2.5 text-[12.5px] font-semibold text-[#a32d2d]">
              {err}
            </div>
          ) : null}
          <div>
            <Label htmlFor="kh-type">تسليم إلى</Label>
            <Select
              id="kh-type"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setErr("");
              }}
            >
              <option value="internal">تسليم داخلي (مستخدم في النظام)</option>
              <option value="external">تسليم لجهة خارجية</option>
              <option value="return_court">إرجاع للمحكمة</option>
            </Select>
          </div>

          {kind === "internal" ? (
            <div>
              <Label htmlFor="kh-user">مستخدم معرَّف في النظام *</Label>
              <Select
                id="kh-user"
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
              >
                <option value="">— اختر المستخدم —</option>
                {inspectors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {kind === "external" ? (
            <div>
              <Label>بيانات الطرف الخارجي *</Label>
              <div className="mt-1 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Input
                  placeholder="الاسم * — مثال: محمد أحمد حسن"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                />
                <Input
                  placeholder="الجهة — مثال: شركة أبعاد للتقييم"
                  value={partyOrg}
                  onChange={(e) => setPartyOrg(e.target.value)}
                />
                <Input
                  placeholder="الصفة — مثال: وكيل بيع"
                  value={partyRole}
                  onChange={(e) => setPartyRole(e.target.value)}
                />
                <Input
                  dir="ltr"
                  placeholder="* 05xxxxxxxx"
                  value={partyPhone}
                  onChange={(e) => setPartyPhone(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {kind === "return_court" ? (
            <div>
              <Label>جهة المحكمة (من بيانات تسجيل الظرف)</Label>
              <div className="mt-1 flex min-h-11 items-center gap-2.5 rounded-[10px] border-[1.5px] border-border-md bg-surface-2 px-3.5 py-2.5">
                <span className="text-[13px] font-bold text-heading">
                  {env.court || "—"}
                </span>
                <span className="text-[11.5px] text-text-3">
                  {env.circuit || ""}
                </span>
              </div>
            </div>
          ) : null}

          {kind === "external" ? (
            <div>
              <Label>إثبات تسليم المفتاح *</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const upload = await uploadEnvelopeAttachment(
                    "handoff-letter",
                    env.id,
                    file,
                  );
                  if (!upload.ok) {
                    showToast(upload.error, "error");
                    return;
                  }
                  setLetterId(upload.data.id);
                  setLetterName(upload.data.fileName);
                }}
              />
              <button
                type="button"
                className={cn(
                  "mt-1 flex min-h-[52px] w-full items-center gap-3 rounded-xl border-[1.5px] border-dashed px-3.5 py-2.5 text-start",
                  letterId
                    ? "border-[var(--gold)] bg-[var(--gold-soft)]"
                    : "border-border-md bg-surface-2",
                )}
                onClick={() => fileRef.current?.click()}
              >
                <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-[color-mix(in_srgb,#378add_12%,transparent)] text-[#378add]">
                  <FileIcon />
                </span>
                <span>
                  <span className="block text-[13px] font-extrabold text-heading">
                    {letterName
                      ? `تم الإرفاق: ${letterName}`
                      : "تصوير بالهاتف أو رفع مستند"}
                  </span>
                  <span className="mt-px block text-[11.5px] text-text-3">
                    محضر تسليم، إيصال، أو صورة أثناء التسليم
                  </span>
                </span>
              </button>
            </div>
          ) : null}

          <div className="rounded-[10px] border border-border bg-surface-2/50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-text-2">
            {notesByKind[kind] ?? ""}
          </div>
        </ModalBody>
        <ModalFooter className="justify-start gap-2 border-t border-border px-5 py-3.5">
          <Button
            variant="outline"
            disabled={busy}
            showActionToast={false}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            loading={busy}
            showActionToast={false}
            onClick={async () => {
              let toParty = "";
              let toUserIdVal: string | null = null;
              if (kind === "internal") {
                if (!toUserId.trim()) {
                  setErr("اختر المستخدم من القائمة.");
                  return;
                }
                const match = inspectors.find((i) => i.id === toUserId);
                toParty = match?.name ?? "";
                toUserIdVal = toUserId.trim();
              } else if (kind === "external") {
                if (!partyName.trim()) {
                  setErr("اسم الطرف مطلوب.");
                  return;
                }
                if (!partyPhone.trim()) {
                  setErr("رقم جوال الطرف الخارجي مطلوب.");
                  return;
                }
                if (!letterId) {
                  setErr(
                    "يلزم إثبات التسليم: صوّر/ارفع مستنداً للتسليم.",
                  );
                  return;
                }
                toParty = [
                  partyName.trim(),
                  partyOrg.trim(),
                  partyRole.trim() ? `(${partyRole.trim()})` : "",
                  partyPhone.trim(),
                ]
                  .filter(Boolean)
                  .join(" — ");
              } else {
                toParty = env.court || "المحكمة";
              }

              onBusy(true);
              const result = await createEnvelopeHandoff(env.id, {
                kind,
                fromParty: env.createdByName || "المراجع الحكومي",
                toParty,
                toUserId: toUserIdVal,
                letterAttachmentId: letterId,
                notes: null,
              });
              onBusy(false);
              if (!result.ok) {
                showToast(result.error, "error");
                return;
              }
              const typeTxt =
                kind === "internal"
                  ? "تسليم داخلي"
                  : kind === "external"
                    ? "تسليم خارجي"
                    : "إرجاع للمحكمة";
              showToast(
                `تم تسجيل «${typeTxt}» على الظرف ${env.requestNumber}.`,
                "success",
              );
              await onDone(result.data);
            }}
          >
            تسليم
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
