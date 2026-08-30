"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Spinner,
  StatusPill,
  TBody,
  THead,
  Table,
  TableFrame,
  Td,
  TdLtr,
  Th,
  Tr,
  cn,
  opsAccentBtnSm,
  opsBtnGhost,
  opsBtnPrimary,
  opsPanelCard,
  opsPanelNote,
  opsPpHeadCard,
  opsSurfaceCard,
  useToast,
} from "@platform/ui-kit";
import { useDistributionAssigneesQuery } from "@settings/mfe/query/settings-queries";
import { displayPersonName as sharedDisplayPersonName } from "@platform/app-shared/prototype/person-display-name";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "@case-study/mfe/lib/prototype/po-intake-data";
import { getFieldInspectors } from "@case-study/mfe/lib/distribution-assignees";
import {
  confirmEnvelopeAssignment,
  confirmEnvelopeHandoff,
  createEnvelopeHandoff,
  loadKeyEnvelope,
  loadPropertyCourtAccess,
  savePropertyCourtAccess,
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
  studyHoldLabel,
  timelineEventLabel,
  type KeyAssignmentMatchStatus,
  type KeyEnvelopeAssignment,
  type KeyEnvelopeHandoff,
  type KeyEnvelopeLinkedProperty,
  type KeyEnvelopeRow,
  type PropertyCourtAccessRow,
} from "../lib/keys-envelope-types";
import { KeyEnvelopeAttachmentPreview } from "./KeyEnvelopeAttachmentPreview";
import {
  KeysBackLink,
  KeysPpCell,
  KeysStatusPill,
  KeysTabBar,
} from "./KeysHtmlPrimitives";

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
  return sharedDisplayPersonName(value, { fallback: "—" });
}

function EnvIcon({ size = 25 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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

type DetailTab = "assign" | "custody" | "timeline" | "court";

/** HTML Case Study.html `keyHold` colors. */
function studyHoldColor(status: string): string {
  switch (status) {
    case "suspended_eviction":
      return "#d9694f";
    case "enabled_no_key":
      return "#b58a3c";
    default:
      return "#8a8d96";
  }
}

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
  const staffLoadError = staffResult?.loadError ?? null;
  const fieldInspectors = useMemo(
    () => getFieldInspectors(staffResult?.users ?? []),
    [staffResult?.users],
  );

  const [env, setEnv] = useState<KeyEnvelopeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DetailTab>("assign");
  const [busy, setBusy] = useState(false);
  const [matchTarget, setMatchTarget] = useState<KeyEnvelopeAssignment | null>(
    null,
  );
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [courtAccess, setCourtAccess] = useState<PropertyCourtAccessRow[]>([]);
  const [courtEditTarget, setCourtEditTarget] =
    useState<KeyEnvelopeLinkedProperty | null>(null);

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
      setCourtAccess([]);
      setCourtEditTarget(null);
      const result = await loadKeyEnvelope(envelopeId);
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setEnv(result.data);
        const access = await loadPropertyCourtAccess(
          result.data.requestNumber,
        );
        if (!cancelled) setCourtAccess(access);
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

  function handleCourtAccessSaved(row: PropertyCourtAccessRow) {
    setCourtAccess((prev) => {
      const idx = prev.findIndex((r) => r.propertyId === row.propertyId);
      if (idx === -1) return [...prev, row];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
    setCourtEditTarget(null);
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
      <KeysBackLink onClick={onBack}>{backLabel}</KeysBackLink>

      {loading || !env ? (
        <div className={cn(opsPpHeadCard, "py-8 text-sm text-text-3")}>
          جاري التحميل…
        </div>
      ) : (
        <>
          {/* pp-head — renderKeyDetail */}
          <div className={cn(opsPpHeadCard, "max-sm:px-4 max-sm:py-4")}>
            <div className="flex flex-wrap items-start justify-between gap-[18px]">
              <div className="flex min-w-0 items-center gap-[15px]">
                <span className="grid size-[50px] shrink-0 place-items-center rounded-[13px] bg-gold-soft text-gold-d max-sm:size-11">
                  <EnvIcon />
                </span>
                <div className="min-w-0">
                  <h1 className="m-0 flex flex-wrap items-center gap-2.5 text-[18px] font-extrabold text-heading max-sm:text-[16px]">
                    <span
                      className="text-[19px] font-bold text-gold-d max-sm:text-[17px]"
                      dir="ltr"
                    >
                      {envelopeDisplayRef(env.id, env.createdAtUtc, env.referenceNumber)}
                    </span>
                    <span className="text-[13px] font-semibold text-text-3">
                      طلب {env.requestNumber}
                    </span>
                    <KeysStatusPill
                      label={envelopeStatusLabel(env.status)}
                      color={stColor}
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
                  className={cn(
                    opsBtnPrimary,
                    "h-[38px] w-full justify-center px-[13px] sm:w-auto",
                  )}
                  onClick={() => setHandoffOpen(true)}
                >
                  <EnvIcon size={15} />
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

            {/* pp-summary */}
            <div className="mt-4 flex flex-wrap border-t border-border pt-3.5 max-lg:grid max-lg:grid-cols-2 max-lg:gap-y-1">
              <KeysPpCell label="سيناريو الاستلام" first>
                <KeysStatusPill
                  label={scenarioLabel(env.receiveScenario)}
                  color={scColor}
                />
              </KeysPpCell>
              <KeysPpCell label="مستلم الظرف">
                {displayPersonName(env.createdByName)}
              </KeysPpCell>
              <KeysPpCell label="عدد المفاتيح">
                <span className="tabular-nums">{env.keysCountActual}</span>
              </KeysPpCell>
              <KeysPpCell label="الصكوك المرتبطة بالطلب">
                <span className="tabular-nums">{env.assignments.length}</span>
              </KeysPpCell>
              <KeysPpCell label="تاريخ التسجيل">
                <span dir="ltr">{formatDate(env.createdAtUtc)}</span>
              </KeysPpCell>
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

          {/* HTML renderKeyDetail tabs: assignment + custody; timeline/court kept for live APIs */}
          <KeysTabBar
            tabs={[
              {
                id: "assign",
                label: "إسناد الصكوك",
                count: env.assignments.length,
              },
              {
                id: "custody",
                label: "سلسلة العهدة",
                count: env.handoffs.length + 1,
              },
              {
                id: "timeline",
                label: "سجل الحركات",
                count: env.timeline.length,
              },
              {
                id: "court",
                label: "التمكين / محظر الإخلاء",
                count: env.linkedProperties.length,
              },
            ]}
            active={tab}
            onChange={(id) => setTab(id as DetailTab)}
          />

          {tab === "assign" ? (
            <AssignmentsPanel
              env={env}
              rows={sortedAssignments}
              canEdit={canEdit}
              busy={busy}
              onMatch={(a) => setMatchTarget(a)}
            />
          ) : null}
          {tab === "custody" ? (
            <CustodyPanel
              env={env}
              canEdit={canEdit}
              busy={busy}
              onConfirm={(id) => void handleConfirmHandoff(id)}
            />
          ) : null}
          {tab === "timeline" ? <TimelinePanel env={env} /> : null}
          {tab === "court" ? (
            <CourtAccessPanel
              env={env}
              rows={courtAccess}
              canEdit={canEdit}
              onEdit={(p) => setCourtEditTarget(p)}
            />
          ) : null}
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
        env.status === "reviewer" ? (
          <DeliverEnvelopeModal
            env={env}
            inspectors={fieldInspectors}
            staffLoadError={staffLoadError}
            busy={busy}
            onClose={() => setHandoffOpen(false)}
            onBusy={setBusy}
            onDone={async (next) => {
              setHandoffOpen(false);
              await refresh(next);
            }}
          />
        ) : (
          <ReceiveEnvelopeModal
            env={env}
            busy={busy}
            onClose={() => setHandoffOpen(false)}
            onBusy={setBusy}
            onDone={async (next) => {
              setHandoffOpen(false);
              await refresh(next);
            }}
          />
        )
      ) : null}

      {courtEditTarget ? (
        <CourtAccessModal
          property={courtEditTarget}
          current={courtAccess.find(
            (r) => r.propertyId === courtEditTarget.propertyId,
          )}
          onClose={() => setCourtEditTarget(null)}
          onSaved={handleCourtAccessSaved}
        />
      ) : null}
    </>
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
      <div className={opsPanelNote}>
        لا توجد إسنادات صكوك لهذا الظرف بعد.
      </div>
    );
  }

  return (
    <>
      <TableFrame className="hidden lg:block">
        <Table className="min-w-[780px]">
          <THead>
            <Tr hoverable={false}>
              <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
              <Th>العقار</Th>
              <Th>أمر العمل</Th>
              <Th>حالة التجربة</Th>
              <Th>ملاحظة</Th>
              <Th className="text-center">تأكيد ميداني</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((a) => {
              const color = assignmentStatusColor(a.status);
              return (
                <Tr key={a.id} hoverable={false}>
                  <TdLtr bare className="text-[13.5px] font-bold text-gold-d">
                    {a.deedNumber}
                  </TdLtr>
                  <Td>
                    <span className="truncate text-[13px] text-text-2">
                      {propertyLabel(env, a)}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-[12px] font-semibold text-text-2">
                      {poForAssignment(env, a)}
                    </span>
                  </Td>
                  <Td>
                    <KeysStatusPill
                      label={assignmentStatusLabel(a.status)}
                      color={color}
                    />
                  </Td>
                  <Td>
                    <span className="truncate text-[13px] text-text-2">
                      {a.notes || "—"}
                    </span>
                  </Td>
                  <Td className="text-center">
                    {a.status === "pending" && canEdit ? (
                      <button
                        type="button"
                        disabled={busy}
                        aria-busy={busy || undefined}
                        className={cn(
                          opsBtnGhost,
                          "inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap px-3.5 text-[12px] text-gold-d",
                        )}
                        onClick={() => onMatch(a)}
                      >
                        {busy ? <Spinner /> : null}
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
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </TableFrame>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
        {rows.map((a) => {
          const color = assignmentStatusColor(a.status);
          return (
            <li
              key={`m-${a.id}`}
              className={cn(opsPanelCard, "px-3.5 py-3")}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="text-[14px] font-bold text-[var(--gold-d)]"
                  dir="ltr"
                >
                  صك {a.deedNumber}
                </span>
                <KeysStatusPill
                  label={assignmentStatusLabel(a.status)}
                  color={color}
                />
              </div>
              <div className="mt-2 space-y-1.5 text-[12.5px]">
                <div className="flex justify-between gap-3">
                  <span className="text-text-3">العقار</span>
                  <span className="text-end text-text-2">
                    {propertyLabel(env, a)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-text-3">أمر العمل</span>
                  <span className="font-semibold text-text-2">
                    {poForAssignment(env, a)}
                  </span>
                </div>
                {a.notes ? (
                  <div className="pt-1 text-text-2">{a.notes}</div>
                ) : null}
              </div>
              <div className="mt-3">
                {a.status === "pending" && canEdit ? (
                  <button
                    type="button"
                    disabled={busy}
                    aria-busy={busy || undefined}
                    className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border-md bg-surface px-3.5 text-[13px] font-semibold text-[var(--gold-d)] transition-colors hover:border-[var(--gold)] disabled:opacity-60"
                    onClick={() => onMatch(a)}
                  >
                    {busy ? <Spinner /> : null}
                    تسجيل نتيجة المطابقة…
                  </button>
                ) : (
                  <span className="text-[12px] text-text-3">
                    {displayPersonName(a.confirmedByName) !== "—"
                      ? `أكّده ${displayPersonName(a.confirmedByName)}`
                      : a.status !== "pending"
                        ? "مؤكّد"
                        : "—"}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
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
      stateLabel: "منجز",
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
      <div className={cn(opsSurfaceCard, "px-[22px] py-1.5")}>
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
                    aria-busy={busy || undefined}
                    className={cn(opsAccentBtnSm, "inline-flex items-center gap-1.5")}
                    onClick={() => onConfirm(item.handoff!.id)}
                  >
                    {busy ? <Spinner /> : null}
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

function timelineEventColor(eventType: string): string {
  const t = eventType.toLowerCase();
  if (t.includes("handoff") || t.includes("transfer")) return "#378add";
  if (
    t.includes("confirm") ||
    t.includes("match") ||
    t.includes("fee") ||
    t.includes("revenue")
  )
    return "#2f7a4d";
  if (t.includes("mismatch") || t.includes("missing") || t.includes("evict"))
    return "#d9694f";
  return "#8a8d96";
}

function TimelinePanel({ env }: { env: KeyEnvelopeRow }) {
  if (env.timeline.length === 0) {
    return (
      <div className={opsPanelNote}>
        لا توجد حركات مسجّلة على هذا الظرف بعد.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 text-[13px] font-extrabold text-heading">
        سجل الحركات
      </div>
      <div className={cn(opsPanelCard, "px-[22px] py-1.5")}>
        {env.timeline.map((item, i) => {
          const color = timelineEventColor(item.eventType);
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-[15px] py-4",
                i > 0 && "border-t border-border",
              )}
            >
              <span
                className="grid size-10 shrink-0 place-items-center rounded-[10px]"
                style={{
                  background: `color-mix(in srgb, ${color} 14%, transparent)`,
                  color,
                }}
              >
                <HandoffIcon size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-heading">
                  {timelineEventLabel(item.eventType)}
                </div>
                <div className="mt-[5px] text-[13px] text-text-2">
                  {item.summary || "—"}
                </div>
                <div className="mt-[3px] text-[12px] text-text-3">
                  {displayPersonName(item.actorName)}
                </div>
              </div>
              <div
                className="shrink-0 whitespace-nowrap text-[12px] text-text-3"
                dir="ltr"
              >
                {formatDate(item.createdAtUtc)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CourtAccessPanel({
  env,
  rows,
  canEdit,
  onEdit,
}: {
  env: KeyEnvelopeRow;
  rows: PropertyCourtAccessRow[];
  canEdit: boolean;
  onEdit: (property: KeyEnvelopeLinkedProperty) => void;
}) {
  if (env.linkedProperties.length === 0) {
    return (
      <div className={opsPanelNote}>
        لا توجد عقارات مرتبطة بهذا الطلب.
      </div>
    );
  }

  // One index instead of a linear scan per linked property (js-index-maps).
  const accessByPropertyId = new Map(rows.map((r) => [r.propertyId, r]));
  return (
    <div className="space-y-2.5">
      {env.linkedProperties.map((p) => {
        const access = accessByPropertyId.get(p.propertyId);
        const status = access?.studyHoldStatus || "none";
        const color = studyHoldColor(status);
        return (
          <div
            key={p.propertyId}
            className={cn(opsPanelCard, "flex flex-wrap items-center justify-between gap-3 px-4 py-3.5")}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className="text-[13.5px] font-bold text-[var(--gold-d)]"
                  dir="ltr"
                >
                  صك {p.deedNumber}
                </span>
                <StatusPill
                  label={studyHoldLabel(status)}
                  style={{ base: color, fg: color }}
                />
              </div>
              <div className="mt-1.5 text-[12.5px] text-text-2">
                {[p.city, p.ownerName].filter(Boolean).join(" · ") ||
                  p.poNumber ||
                  "العقار"}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {access?.enablingLetterAttachmentId ? (
                <KeyEnvelopeAttachmentPreview
                  attachmentId={access.enablingLetterAttachmentId}
                  label="خطاب التمكين"
                  variant="chip"
                  chipColor="#b58a3c"
                />
              ) : null}
              {access?.evictionNoticeAttachmentId ? (
                <KeyEnvelopeAttachmentPreview
                  attachmentId={access.evictionNoticeAttachmentId}
                  label="محضر الإخلاء"
                  variant="chip"
                  chipColor="#d9694f"
                />
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-border-md bg-surface px-3.5 text-[12px] font-medium text-[var(--gold-d)] transition-colors hover:border-[var(--gold)]"
                  onClick={() => onEdit(p)}
                >
                  تحديث مسار الدخول…
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Exact tiles from HTML `openKeyResult` / Case Study.html. */
const MATCH_RESULT_TILES: {
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

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal-2)] flex items-start justify-center overflow-y-auto bg-[rgba(16,43,78,0.42)] px-4 py-[6vh] backdrop-blur-[2px] max-lg:items-stretch max-lg:px-0 max-lg:py-0"
      role="presentation"
      onClick={onClose}
    >
      <style>{`@keyframes keyModalIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}`}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kr-match-title"
        className="w-full max-w-[520px] overflow-hidden rounded-[16px] border border-border bg-surface shadow-[0_24px_60px_-18px_rgba(16,43,78,0.5)] [animation:keyModalIn_0.22s_ease_both] max-lg:min-h-dvh max-lg:max-w-none max-lg:rounded-none max-lg:border-0"
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
              {MATCH_RESULT_TILES.map((t) => {
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

        <div className="flex flex-wrap justify-start gap-2 border-t border-border px-[22px] py-3.5 max-lg:sticky max-lg:bottom-0 max-lg:bg-surface max-lg:pb-[max(0.875rem,env(safe-area-inset-bottom))] max-lg:[&>button]:min-h-11 max-lg:[&>button]:flex-1">
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

const HANDOFF_NOTES_BY_KIND: Record<string, string> = {
  internal:
    "التسليم الداخلي يُسجَّل بحالة «بانتظار التأكيد» ثم يؤكّده المعاين — وتنتقل العهدة إليه.",
  external:
    "التسليم الخارجي يتطلب إثباتاً: صورة/مستند، أو بيانات التواصل للجهة.",
  return_court:
    "المحكمة جهة معرَّفة — لا يلزم إثبات استلام؛ الإرجاع يُنهي دورة الظرف.",
};

/** Receive envelope — confirm pending handoff so custody returns to the clerk (status is not «with clerk»). */
function ReceiveEnvelopeModal({
  env,
  busy,
  onClose,
  onBusy,
  onDone,
}: {
  env: KeyEnvelopeRow;
  busy: boolean;
  onClose: () => void;
  onBusy: (v: boolean) => void;
  onDone: (next: KeyEnvelopeRow) => Promise<void>;
}) {
  const { showToast } = useToast();
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
        className="max-w-[520px] p-0 max-lg:max-h-[min(92dvh,100%)]"
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

/** Deliver envelope — internal/external handoff or return to court (custody with clerk). */
function DeliverEnvelopeModal({
  env,
  inspectors,
  staffLoadError,
  busy,
  onClose,
  onBusy,
  onDone,
}: {
  env: KeyEnvelopeRow;
  inspectors: { id: string; name: string }[];
  staffLoadError: string | null;
  busy: boolean;
  onClose: () => void;
  onBusy: (v: boolean) => void;
  onDone: (next: KeyEnvelopeRow) => Promise<void>;
}) {
  const { showToast } = useToast();
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

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard
        onClick={(e) => e.stopPropagation()}
        className="max-w-[560px] p-0 max-lg:max-h-[min(92dvh,100%)]"
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
        <ModalBody className="max-h-[min(70vh,560px)] space-y-3.5 overflow-y-auto px-5 py-5 max-lg:max-h-none">
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
              <Label htmlFor="kh-user">المعاين الميداني *</Label>
              {staffLoadError ? (
                <div className="mt-1 rounded-[10px] border border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] px-3 py-2.5 text-[12.5px] font-semibold text-[#a32d2d]">
                  {staffLoadError}
                </div>
              ) : null}
              <Select
                id="kh-user"
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                disabled={Boolean(staffLoadError) || inspectors.length === 0}
              >
                <option value="">
                  {inspectors.length === 0 && !staffLoadError
                    ? "— لا يوجد معاينون ميدانيون نشطون —"
                    : "— اختر المعاين —"}
                </option>
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
            {HANDOFF_NOTES_BY_KIND[kind] ?? ""}
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

const COURT_ACCESS_OPTIONS = [
  { id: "none" as const, label: "لا يوجد" },
  { id: "enabling" as const, label: "تمكين" },
  { id: "eviction" as const, label: "محظر إخلاء" },
] as const;

function CourtAccessModal({
  property,
  current,
  onClose,
  onSaved,
}: {
  property: KeyEnvelopeLinkedProperty;
  current?: PropertyCourtAccessRow;
  onClose: () => void;
  onSaved: (row: PropertyCourtAccessRow) => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [hasEnablingLetter, setHasEnablingLetter] = useState(
    current?.hasEnablingLetter ?? false,
  );
  const [enablingLetterId, setEnablingLetterId] = useState<string | null>(
    current?.enablingLetterAttachmentId ?? null,
  );
  const [enablingLetterName, setEnablingLetterName] = useState("");

  const [hasEvictionNotice, setHasEvictionNotice] = useState(
    current?.hasEvictionNotice ?? false,
  );
  const [evictionNoticeId, setEvictionNoticeId] = useState<string | null>(
    current?.evictionNoticeAttachmentId ?? null,
  );
  const [evictionNoticeName, setEvictionNoticeName] = useState("");

  const [contactPhones, setContactPhones] = useState(
    current?.contactPhones ?? "",
  );
  const [notes, setNotes] = useState(current?.notes ?? "");

  const enablingFileRef = useRef<HTMLInputElement>(null);
  const evictionFileRef = useRef<HTMLInputElement>(null);

  const previewStatus: string = hasEvictionNotice
    ? "suspended_eviction"
    : hasEnablingLetter
      ? "enabled_no_key"
      : "none";
  const previewColor = studyHoldColor(previewStatus);

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard
        onClick={(e) => e.stopPropagation()}
        className="max-w-[560px] p-0 max-lg:max-h-[min(92dvh,100%)]"
      >
        <ModalHeader className="relative border-b border-border px-5 py-4">
          <ModalTitle className="text-center text-[16px] font-extrabold text-heading">
            التمكين / محظر الإخلاء — صك {property.deedNumber}
          </ModalTitle>
          <ModalClose
            className="absolute start-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[9px] bg-surface-2"
            onClick={onClose}
          >
            ✕
          </ModalClose>
        </ModalHeader>
        <ModalBody className="max-h-[min(70vh,560px)] space-y-3.5 overflow-y-auto px-5 py-5 max-lg:max-h-none">
          {err ? (
            <div className="rounded-[10px] border border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] px-3 py-2.5 text-[12.5px] font-semibold text-[#a32d2d]">
              {err}
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-[10px] border border-border bg-surface-2/50 px-3.5 py-2.5">
            <span className="text-[12.5px] font-semibold text-text-2">
              الحالة الحالية
            </span>
            <StatusPill
              label={studyHoldLabel(previewStatus)}
              style={{ base: previewColor, fg: previewColor }}
            />
          </div>

          <div>
            <Label>مسار الدخول</Label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {COURT_ACCESS_OPTIONS.map((opt) => {
                const active =
                  opt.id === "none"
                    ? !hasEnablingLetter && !hasEvictionNotice
                    : opt.id === "enabling"
                      ? hasEnablingLetter && !hasEvictionNotice
                      : hasEvictionNotice;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(
                      "min-h-[40px] rounded-[10px] border text-[12.5px] font-extrabold transition-colors",
                      active
                        ? "border-gold bg-gold-soft text-gold-d"
                        : "border-border bg-surface text-text-2 hover:bg-row-hover",
                    )}
                    onClick={() => {
                      if (opt.id === "none") {
                        setHasEnablingLetter(false);
                        setEnablingLetterId(null);
                        setEnablingLetterName("");
                        setHasEvictionNotice(false);
                        setEvictionNoticeId(null);
                        setEvictionNoticeName("");
                      } else if (opt.id === "enabling") {
                        setHasEvictionNotice(false);
                        setEvictionNoticeId(null);
                        setEvictionNoticeName("");
                        if (!hasEnablingLetter && !enablingLetterId) {
                          enablingFileRef.current?.click();
                        } else {
                          setHasEnablingLetter(true);
                        }
                      } else {
                        if (!hasEvictionNotice && !evictionNoticeId) {
                          evictionFileRef.current?.click();
                        } else {
                          setHasEvictionNotice(true);
                        }
                      }
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11.5px] text-text-3">
              «لا يوجد» يلغي التمكين ومحظر الإخلاء ويرفع تعليق الدراسة إن وُجد.
            </p>
          </div>

          <div>
            <Label>خطاب التمكين (بدون مفتاح)</Label>
            <input
              ref={enablingFileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const upload = await uploadEnvelopeAttachment(
                  "enabling",
                  property.propertyId,
                  file,
                );
                if (!upload.ok) {
                  showToast(upload.error, "error");
                  return;
                }
                setEnablingLetterId(upload.data.id);
                setEnablingLetterName(upload.data.fileName);
                setHasEnablingLetter(true);
              }}
            />
            <button
              type="button"
              className={cn(
                "mt-1 flex min-h-[52px] w-full items-center gap-3 rounded-xl border-[1.5px] border-dashed px-3.5 py-2.5 text-start",
                enablingLetterId
                  ? "border-[var(--gold)] bg-[var(--gold-soft)]"
                  : "border-border-md bg-surface-2",
              )}
              onClick={() => enablingFileRef.current?.click()}
            >
              <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-[color-mix(in_srgb,#b58a3c_12%,transparent)] text-[#b58a3c]">
                <FileIcon />
              </span>
              <span>
                <span className="block text-[13px] font-extrabold text-heading">
                  {enablingLetterName
                    ? `تم الإرفاق: ${enablingLetterName}`
                    : current?.enablingLetterAttachmentId
                      ? "استبدال خطاب التمكين المرفق"
                      : "رفع خطاب التمكين"}
                </span>
                <span className="mt-px block text-[11.5px] text-text-3">
                  إثبات السماح بدخول العقار دون تسليم مفتاح
                </span>
              </span>
            </button>
            {hasEnablingLetter || enablingLetterId ? (
              <button
                type="button"
                className="mt-1.5 text-[12px] font-semibold text-[#a32d2d] hover:underline"
                onClick={() => {
                  setHasEnablingLetter(false);
                  setEnablingLetterId(null);
                  setEnablingLetterName("");
                }}
              >
                إزالة خطاب التمكين
              </button>
            ) : null}
          </div>

          <div>
            <Label>محظر الإخلاء (تعليق الدراسة)</Label>
            <input
              ref={evictionFileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const upload = await uploadEnvelopeAttachment(
                  "eviction",
                  property.propertyId,
                  file,
                );
                if (!upload.ok) {
                  showToast(upload.error, "error");
                  return;
                }
                setEvictionNoticeId(upload.data.id);
                setEvictionNoticeName(upload.data.fileName);
                setHasEvictionNotice(true);
              }}
            />
            <button
              type="button"
              className={cn(
                "mt-1 flex min-h-[52px] w-full items-center gap-3 rounded-xl border-[1.5px] border-dashed px-3.5 py-2.5 text-start",
                evictionNoticeId
                  ? "border-[#d9694f] bg-[color-mix(in_srgb,#d9694f_10%,transparent)]"
                  : "border-border-md bg-surface-2",
              )}
              onClick={() => evictionFileRef.current?.click()}
            >
              <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] text-[#d9694f]">
                <FileIcon />
              </span>
              <span>
                <span className="block text-[13px] font-extrabold text-heading">
                  {evictionNoticeName
                    ? `تم الإرفاق: ${evictionNoticeName}`
                    : current?.evictionNoticeAttachmentId
                      ? "استبدال محضر الإخلاء المرفق"
                      : "رفع محظر الإخلاء"}
                </span>
                <span className="mt-px block text-[11.5px] text-text-3">
                  يعلّق الدراسة تلقائياً حتى رفع محظر الإخلاء
                </span>
              </span>
            </button>
            {hasEvictionNotice || evictionNoticeId ? (
              <button
                type="button"
                className="mt-1.5 text-[12px] font-semibold text-[#a32d2d] hover:underline"
                onClick={() => {
                  setHasEvictionNotice(false);
                  setEvictionNoticeId(null);
                  setEvictionNoticeName("");
                }}
              >
                إزالة محظر الإخلاء
              </button>
            ) : null}
          </div>

          <div>
            <Label htmlFor="ca-phones">أرقام تواصل (اختياري)</Label>
            <Input
              id="ca-phones"
              dir="ltr"
              placeholder="05xxxxxxxx"
              value={contactPhones}
              onChange={(e) => setContactPhones(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="ca-notes">ملاحظات (اختياري)</Label>
            <Input
              id="ca-notes"
              value={notes}
              placeholder="ملاحظات إضافية عن مسار الدخول"
              onChange={(e) => setNotes(e.target.value)}
            />
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
              setErr("");
              setBusy(true);
              const result = await savePropertyCourtAccess({
                propertyId: property.propertyId,
                hasEnablingLetter,
                enablingLetterAttachmentId:
                  enablingLetterId ??
                  (hasEnablingLetter
                    ? current?.enablingLetterAttachmentId ?? null
                    : null),
                hasEvictionNotice,
                evictionNoticeAttachmentId:
                  evictionNoticeId ??
                  (hasEvictionNotice
                    ? current?.evictionNoticeAttachmentId ?? null
                    : null),
                contactPhones: contactPhones.trim() || null,
                notes: notes.trim() || null,
              });
              setBusy(false);
              if (!result.ok) {
                setErr(result.error);
                return;
              }
              showToast(
                `تم تحديث مسار الدخول لصك ${property.deedNumber}.`,
                "success",
              );
              onSaved(result.data);
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
            حفظ
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
