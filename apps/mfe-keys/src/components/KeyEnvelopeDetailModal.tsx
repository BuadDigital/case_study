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
  type KeyEnvelopeAssignment,
  type KeyEnvelopeHandoff,
  type KeyEnvelopeRow,
} from "../lib/keys-envelope-types";
import { KeyEnvelopeAttachmentPreview } from "./KeyEnvelopeAttachmentPreview";

/** Exact JobTitle — same allowlist as distribution assignees. */
const FIELD_INSPECTOR_JOB_TITLE = "معاين ميداني";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-CA");
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export function KeyEnvelopeDetailModal({
  envelopeId,
  canEdit,
  onClose,
  onChanged,
}: {
  envelopeId: string | null;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
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
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<DetailTab>("assign");
  const [busy, setBusy] = useState(false);
  const [matchTarget, setMatchTarget] = useState<KeyEnvelopeAssignment | null>(
    null,
  );
  const [handoffOpen, setHandoffOpen] = useState(false);

  useEffect(() => {
    if (!envelopeId) {
      setEnv(null);
      setTab("assign");
      setMatchTarget(null);
      setHandoffOpen(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setTab("assign");
      const result = await loadKeyEnvelope(envelopeId);
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setEnv(result.data);
      } else {
        showToast(result.error, "error");
        onClose();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envelopeId, onClose, showToast]);

  const sortedAssignments = useMemo(() => {
    if (!env) return [];
    return [...env.assignments].sort((a, b) => {
      const ap = a.status === "pending" ? 0 : 1;
      const bp = b.status === "pending" ? 0 : 1;
      return ap - bp;
    });
  }, [env]);

  if (!envelopeId) return null;

  async function refresh(next?: KeyEnvelopeRow) {
    if (next) {
      setEnv(next);
      onChanged();
      return;
    }
    if (!envelopeId) return;
    const result = await loadKeyEnvelope(envelopeId);
    if (result.ok) {
      setEnv(result.data);
      onChanged();
    }
  }

  async function handleConfirmAssignment(
    assignmentId: string,
    status: "matched" | "unmatched",
    notes?: string,
  ) {
    if (!env) return;
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
    showToast("سُجّلت نتيجة المطابقة.", "success");
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

  return (
    <>
      <ModalOverlay onClick={onClose}>
        <ModalCard
          wide
          onClick={(e) => e.stopPropagation()}
          className="max-w-[960px] p-0"
        >
          <ModalHeader className="relative border-b border-border px-5 py-3.5">
            <ModalTitle className="text-center text-[16px] font-extrabold text-heading">
              ملف الظرف
            </ModalTitle>
            <ModalClose
              className="absolute start-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[9px] bg-surface-2 text-[15px] text-text-2 hover:bg-row-hover hover:text-heading"
              onClick={onClose}
              aria-label="إغلاق"
            >
              ✕
            </ModalClose>
          </ModalHeader>

          <ModalBody className="max-h-[min(82vh,820px)] space-y-0 overflow-y-auto p-0">
            {loading || !env ? (
              <p className="p-6 text-sm text-text-3">جاري التحميل…</p>
            ) : (
              <>
                {/* pp-head */}
                <div className="border-b border-border px-5 pb-4 pt-5 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span className="grid size-[50px] shrink-0 place-items-center rounded-[13px] bg-[var(--gold-soft)] text-[var(--gold-d)]">
                        <EnvIcon />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-[19px] font-extrabold text-primary">
                            {envelopeDisplayRef(env.id, env.createdAtUtc)}
                          </span>
                          <span className="text-[13px] font-semibold text-text-3">
                            طلب {env.requestNumber}
                          </span>
                          <StatusPill
                            label={envelopeStatusLabel(env.status)}
                            style={{ base: stColor, fg: stColor }}
                          />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-text-2">
                          <span>{env.court || "—"}</span>
                          <span className="text-text-3">·</span>
                          <span>{env.circuit || "—"}</span>
                        </div>
                      </div>
                    </div>
                    {canEdit && env.status !== "returned" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-[38px] gap-1.5 px-3.5 text-[12.5px]"
                        showActionToast={false}
                        onClick={() => setHandoffOpen(true)}
                      >
                        <HandoffIcon />
                        {handoffBtnLabel}
                      </Button>
                    ) : null}
                  </div>

                  {env.countMismatch ? (
                    <div
                      className="mt-3.5 flex items-center gap-2.5 rounded-[10px] px-4 py-3 text-[12.5px] font-semibold leading-relaxed"
                      style={{
                        background:
                          "color-mix(in srgb, #d9694f 9%, transparent)",
                        color: "#a32d2d",
                      }}
                    >
                      <AlertIcon />
                      <span>
                        تعارض في العدد: المكتوب على الظرف{" "}
                        {env.keysCountLabeled} والفعلي بعد العد{" "}
                        {env.keysCountActual}. يلزم تعديل خطاب الاستلام في
                        المحكمة.
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <SummaryCell label="سيناريو الاستلام">
                      <StatusPill
                        label={scenarioLabel(env.receiveScenario)}
                        style={{ base: scColor, fg: scColor }}
                      />
                    </SummaryCell>
                    <SummaryCell label="مستلم الظرف">
                      <span className="text-[13px] font-bold text-heading">
                        {env.createdByName || "—"}
                      </span>
                    </SummaryCell>
                    <SummaryCell label="عدد المفاتيح">
                      <span className="text-[13px] font-bold text-heading tabular-nums">
                        {env.keysCountActual}
                      </span>
                    </SummaryCell>
                    <SummaryCell label="الصكوك المرتبطة بالطلب">
                      <span className="text-[13px] font-bold text-heading tabular-nums">
                        {env.assignments.length}
                      </span>
                    </SummaryCell>
                    <SummaryCell label="تاريخ التسجيل">
                      <span
                        className="text-[13px] font-bold text-heading"
                        dir="ltr"
                      >
                        {formatDate(env.createdAtUtc)}
                      </span>
                    </SummaryCell>
                  </div>

                  {env.photoAttachmentId ||
                  env.receiptAttachmentId ||
                  env.thirdPartyLetterAttachmentId ||
                  env.contactPhones ? (
                    <div className="mt-3.5 space-y-3 border-t border-border pt-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-semibold text-text-3">
                          المرفقات:
                        </span>
                        {env.photoAttachmentId ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold"
                            style={{
                              background:
                                "color-mix(in srgb, #8c7857 12%, transparent)",
                              color: "#8c7857",
                            }}
                          >
                            <FileIcon />
                            صورة الظرف
                          </span>
                        ) : null}
                        {env.receiptAttachmentId ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold"
                            style={{
                              background:
                                "color-mix(in srgb, #8c7857 12%, transparent)",
                              color: "#8c7857",
                            }}
                          >
                            <FileIcon />
                            خطاب الاستلام
                          </span>
                        ) : null}
                        {env.thirdPartyLetterAttachmentId ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold"
                            style={{
                              background:
                                "color-mix(in srgb, #8c7857 12%, transparent)",
                              color: "#8c7857",
                            }}
                          >
                            <FileIcon />
                            خطاب الطرف الثالث
                          </span>
                        ) : null}
                        {env.contactPhones ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-text-2">
                            {env.contactPhones}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {env.photoAttachmentId ? (
                          <KeyEnvelopeAttachmentPreview
                            attachmentId={env.photoAttachmentId}
                            label="صورة الظرف"
                          />
                        ) : null}
                        {env.receiptAttachmentId ? (
                          <KeyEnvelopeAttachmentPreview
                            attachmentId={env.receiptAttachmentId}
                            label="خطاب الاستلام"
                          />
                        ) : null}
                        {env.thirdPartyLetterAttachmentId ? (
                          <KeyEnvelopeAttachmentPreview
                            attachmentId={env.thirdPartyLetterAttachmentId}
                            label="خطاب الطرف الثالث"
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* tabs */}
                <div className="flex gap-1 border-b border-border px-5 pt-2 sm:px-6">
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
                          "relative -mb-px border-b-2 px-3.5 py-2.5 text-[13px] font-bold transition-colors",
                          on
                            ? "border-[var(--gold)] text-heading"
                            : "border-transparent text-text-3 hover:text-text-2",
                        )}
                        onClick={() => setTab(t.id)}
                      >
                        {t.label}
                        <span className="ms-1.5 inline-flex rounded-full border border-border-md bg-surface-2 px-1.5 py-px text-[11px] font-bold text-text-3">
                          {t.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="px-5 py-4 sm:px-6">
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
                </div>
              </>
            )}
          </ModalBody>

          <ModalFooter className="justify-start border-t border-border px-5 py-3.5">
            <Button variant="outline" showActionToast={false} onClick={onClose}>
              إغلاق
            </Button>
          </ModalFooter>
        </ModalCard>
      </ModalOverlay>

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

function SummaryCell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-surface-2/40 px-3 py-2.5">
      <div className="mb-1 text-[11.5px] font-semibold text-text-3">{label}</div>
      <div className="min-h-[22px]">{children}</div>
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
      <div className="rounded-[10px] border border-dashed border-border-md bg-surface-2/30 px-4 py-6 text-center text-[13px] text-text-3">
        لا توجد إسنادات صكوك لهذا الظرف بعد.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[12px] border border-border">
      <div className="min-w-[780px]">
        <div
          className="grid border-b-2 border-[var(--gold)] bg-surface-2/50 text-[12px] font-bold text-text-3"
          style={{
            gridTemplateColumns:
              "minmax(112px,1fr) minmax(118px,1fr) minmax(105px,.95fr) 128px minmax(85px,.75fr) 218px",
          }}
        >
          <div className="px-3 py-2.5 text-start">رقم الصك</div>
          <div className="px-3 py-2.5 text-start">العقار</div>
          <div className="px-3 py-2.5 text-start">أمر العمل</div>
          <div className="px-3 py-2.5 text-start">حالة التجربة</div>
          <div className="px-3 py-2.5 text-start">ملاحظة</div>
          <div className="px-3 py-2.5 text-center">تأكيد ميداني</div>
        </div>
        {rows.map((a) => {
          const color = assignmentStatusColor(a.status);
          return (
            <div
              key={a.id}
              className="grid min-h-[52px] items-center border-b border-border last:border-b-0"
              style={{
                gridTemplateColumns:
                  "minmax(112px,1fr) minmax(118px,1fr) minmax(105px,.95fr) 128px minmax(85px,.75fr) 218px",
              }}
            >
              <div className="px-3 py-2">
                <span className="text-[13.5px] font-bold text-primary">
                  {a.deedNumber}
                </span>
              </div>
              <div className="px-3 py-2 text-[12.5px] text-text-2">
                {propertyLabel(env, a)}
              </div>
              <div className="px-3 py-2 text-[12px] font-semibold text-text-2">
                {poForAssignment(env, a)}
              </div>
              <div className="px-3 py-2">
                <StatusPill
                  label={assignmentStatusLabel(a.status)}
                  style={{ base: color, fg: color }}
                />
              </div>
              <div className="px-3 py-2 text-[12px] text-text-3">
                {a.notes || "—"}
              </div>
              <div className="px-3 py-2 text-center">
                {a.status === "pending" && canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-[30px] px-3.5 text-[12px] text-[var(--gold-d)]"
                    disabled={busy}
                    showActionToast={false}
                    onClick={() => onMatch(a)}
                  >
                    تسجيل نتيجة المطابقة…
                  </Button>
                ) : (
                  <span className="text-[11.5px] text-text-3">
                    {a.confirmedByName
                      ? `أكّده ${a.confirmedByName}`
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
      person: env.createdByName || "—",
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
        person: h.toParty || h.fromParty,
        role: h.kind === "internal" ? "معاين ميداني" : handoffKindLabel(h.kind),
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
      <div className="rounded-[12px] border border-border px-[22px] py-1.5">
        {chain.map((item, i) => (
          <div
            key={item.key}
            className={cn(
              "flex items-start gap-3.5 py-4",
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
              <div className="mt-1 text-[13px] text-text-2">
                {item.person} — {item.role}
              </div>
              {item.handoff?.status === "pending_confirm" && canEdit ? (
                <div className="mt-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3.5 text-[12px]"
                    disabled={busy}
                    showActionToast={false}
                    onClick={() => onConfirm(item.handoff!.id)}
                  >
                    تأكيد استلام المعاين
                  </Button>
                </div>
              ) : null}
              {item.letter || item.letterId ? (
                <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--gold-d)]">
                  <FileIcon />
                  {item.letterId ? (
                    <KeyEnvelopeAttachmentPreview
                      attachmentId={item.letterId}
                      label={item.letter || "خطاب المناولة"}
                      className="!m-0 !border-0 !bg-transparent !p-0 text-[12px]"
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
  onSave: (status: "matched" | "unmatched", note?: string) => void;
}) {
  const [sel, setSel] = useState<"matched" | "unmatched" | "">("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const tiles = [
    {
      id: "matched" as const,
      label: "مطابق",
      hint: "فُتح العقار بالمفاتيح",
      color: "#2f7a4d",
    },
    {
      id: "unmatched" as const,
      label: "غير مطابق",
      hint: "لا مفتاح مناسب",
      color: "#d9694f",
    },
  ];

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard
        onClick={(e) => e.stopPropagation()}
        className="max-w-[520px] p-0"
      >
        <ModalHeader className="relative border-b border-border px-5 py-4">
          <ModalTitle className="text-center text-[16px] font-extrabold text-heading">
            تسجيل نتيجة المطابقة
          </ModalTitle>
          <ModalClose
            className="absolute start-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[9px] bg-surface-2 text-[15px] text-text-2"
            onClick={onClose}
          >
            ✕
          </ModalClose>
        </ModalHeader>
        <ModalBody className="space-y-4 px-5 py-5">
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
                      "flex min-h-[52px] items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5 text-start transition-colors",
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
                placeholder="مثال: لا مفتاح مناسب للوحدة"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          ) : null}
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
            حفظ النتيجة
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
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
    const holder =
      pending?.toParty ||
      env.handoffs[env.handoffs.length - 1]?.toParty ||
      "الطرف الحالي";

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
