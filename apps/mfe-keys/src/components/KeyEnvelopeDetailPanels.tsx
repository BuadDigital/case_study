"use client";

/**
 * The four tab panels of `KeyEnvelopeDetailPage`. Each is presentational: it
 * takes the envelope plus already-derived rows and reports interactions back
 * up — all tab, modal and command state stays in the parent.
 */
import { useState } from "react";
import {
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
  opsPanelCard,
  opsPanelNote,
  opsSurfaceCard,
  ColorStatusPill,
} from "@platform/ui-kit";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "@case-study/mfe/lib/app-data/po-intake-data";
import {
  KeyLocationValues,
  assignmentStatusColor,
  assignmentStatusLabel,
  keyLocationColor,
  keyLocationLabel,
  otherKeysInEnvelope,
  studyHoldLabel,
  timelineEventLabel,
  type KeyEnvelopeAssignment,
  type KeyEnvelopeLinkedProperty,
  type KeyEnvelopeRow,
  type KeyLocation,
  type PropertyCourtAccessRow,
} from "../lib/keys-envelope-types";
import { KeyEnvelopeAttachmentPreview } from "./KeyEnvelopeAttachmentPreview";
import { FileIcon, HandoffIcon } from "./KeyEnvelopeDetailIcons";
import {
  KEY_LOCATION_OPTIONS,
  assignmentConfirmedByText,
  buildCustodyChain,
  custodyNowText,
  displayPersonName,
  formatDate,
  poForAssignment,
  propertyLabel,
  studyHoldColor,
  timelineEventColor,
} from "./key-envelope-detail-state";

export type SetKeyLocationHandler = (
  assignment: KeyEnvelopeAssignment,
  keyLocation: KeyLocation,
  holder?: { userId?: string | null; label?: string | null },
) => void;

/**
 * The reviewer's correction of where a deed's matching key is (decision 2026-10-20):
 * a place, plus the inspector when the key is with someone. Shown once the deed was tried.
 */
function KeyLocationEditor({
  assignment,
  inspectors,
  busy,
  onSave,
  onCancel,
}: {
  assignment: KeyEnvelopeAssignment;
  inspectors: { id: string; name: string }[];
  busy: boolean;
  onSave: SetKeyLocationHandler;
  onCancel: () => void;
}) {
  const [location, setLocation] = useState<KeyLocation>(
    (assignment.keyLocation as KeyLocation | undefined) ??
      KeyLocationValues.InEnvelope,
  );
  const [userId, setUserId] = useState(assignment.keyHolderUserId ?? "");
  const withUser = location === KeyLocationValues.WithUser;
  const chosen = inspectors.find((i) => i.id === userId);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select
        aria-label="مكان المفتاح"
        className="h-[30px] min-w-[130px] py-0 text-[12px]"
        value={location}
        onChange={(e) => setLocation(e.target.value as KeyLocation)}
      >
        {KEY_LOCATION_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
      {withUser ? (
        <Select
          aria-label="من يحمل المفتاح"
          className="h-[30px] min-w-[150px] py-0 text-[12px]"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">اختر المستخدم…</option>
          {inspectors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
      ) : null}
      <button
        type="button"
        disabled={busy || (withUser && !userId)}
        className={cn(opsAccentBtnSm, "inline-flex h-[30px] items-center gap-1")}
        onClick={() =>
          onSave(
            assignment,
            location,
            withUser ? { userId, label: chosen?.name ?? null } : undefined,
          )
        }
      >
        {busy ? <Spinner /> : null}
        حفظ
      </button>
      <button
        type="button"
        disabled={busy}
        className={cn(opsBtnGhost, "h-[30px] px-2.5 text-[12px]")}
        onClick={onCancel}
      >
        إلغاء
      </button>
    </div>
  );
}

function KeyLocationCell({
  assignment,
  canEdit,
  busy,
  inspectors,
  onSetKeyLocation,
}: {
  assignment: KeyEnvelopeAssignment;
  canEdit: boolean;
  busy: boolean;
  inspectors: { id: string; name: string }[];
  onSetKeyLocation?: SetKeyLocationHandler;
}) {
  const [editing, setEditing] = useState(false);
  if (assignment.status === "pending") {
    return <span className="text-[11.5px] text-text-3">— بعد التجربة</span>;
  }
  if (editing && onSetKeyLocation) {
    return (
      <KeyLocationEditor
        assignment={assignment}
        inspectors={inspectors}
        busy={busy}
        onSave={(a, loc, holder) => {
          setEditing(false);
          onSetKeyLocation(a, loc, holder);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <ColorStatusPill
        label={keyLocationLabel(assignment.keyLocation, assignment.keyHolderLabel)}
        color={keyLocationColor(assignment.keyLocation)}
      />
      {canEdit && onSetKeyLocation ? (
        <button
          type="button"
          disabled={busy}
          className="text-[11.5px] font-semibold text-[var(--gold-d)] underline-offset-2 hover:underline disabled:opacity-60"
          onClick={() => setEditing(true)}
        >
          تعديل
        </button>
      ) : null}
    </span>
  );
}

export function AssignmentsPanel({
  env,
  rows,
  canEdit,
  busy,
  inspectors = [],
  onMatch,
  onSetKeyLocation,
}: {
  env: KeyEnvelopeRow;
  rows: KeyEnvelopeAssignment[];
  canEdit: boolean;
  busy: boolean;
  inspectors?: { id: string; name: string }[];
  onMatch: (a: KeyEnvelopeAssignment) => void;
  onSetKeyLocation?: SetKeyLocationHandler;
}) {
  if (rows.length === 0) {
    return (
      <div className={opsPanelNote}>
        لا توجد إسنادات صكوك لهذا الظرف بعد.
      </div>
    );
  }
  const otherKeys = otherKeysInEnvelope(env);

  return (
    <>
      <TableFrame className="hidden lg:block">
        <Table className="min-w-[900px]">
          <THead>
            <Tr hoverable={false}>
              <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
              <Th>العقار</Th>
              <Th>أمر العمل</Th>
              <Th>حالة التجربة</Th>
              <Th>مكان مفتاحه الآن</Th>
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
                    <ColorStatusPill
                      label={assignmentStatusLabel(a.status)}
                      color={color}
                    />
                  </Td>
                  <Td>
                    <KeyLocationCell
                      assignment={a}
                      canEdit={canEdit}
                      busy={busy}
                      inspectors={inspectors}
                      onSetKeyLocation={onSetKeyLocation}
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
                        {assignmentConfirmedByText(a.confirmedByName, a.status)}
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
                <ColorStatusPill
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
                <div className="flex justify-between gap-3">
                  <span className="text-text-3">مكان مفتاحه الآن</span>
                  <KeyLocationCell
                    assignment={a}
                    canEdit={canEdit}
                    busy={busy}
                    inspectors={inspectors}
                    onSetKeyLocation={onSetKeyLocation}
                  />
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
                    {assignmentConfirmedByText(a.confirmedByName, a.status)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {otherKeys > 0 ? (
        <div className={cn(opsPanelNote, "mt-3")}>
          في الظرف {otherKeys} مفاتيح أخرى لم تفتح أيًّا من صكوكنا — تبقى معه
          وتعود مع الظرف إلى المحكمة.
        </div>
      ) : null}
    </>
  );
}

export function CustodyPanel({
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
  const chain = buildCustodyChain(env);
  const now = custodyNowText(env);

  return (
    <div>
      <div
        className={cn(
          opsSurfaceCard,
          "mb-3 flex flex-wrap items-center justify-between gap-3 px-[22px] py-3.5",
        )}
      >
        <div>
          <div className="text-[11.5px] text-text-3">الظرف الآن عند</div>
          <div className="mt-0.5 text-[15px] font-extrabold text-heading">
            {now.title}
          </div>
          {now.since ? (
            <div className="mt-0.5 text-[12px] text-text-3">
              منذ <span dir="ltr">{now.since}</span>
            </div>
          ) : null}
        </div>
        {now.pending ? (
          <div className="rounded-lg bg-[color-mix(in_srgb,#b58a3c_12%,transparent)] px-3 py-2 text-[12.5px] font-semibold text-[#8a5e14]">
            {now.pending}
          </div>
        ) : env.readyForCourtReturn ? (
          <div className="rounded-lg bg-[color-mix(in_srgb,#2f7a4d_12%,transparent)] px-3 py-2 text-[12.5px] font-semibold text-[#2f7a4d]">
            جُرِّبت كل صكوكنا وعادت مفاتيحها — الظرف جاهز للإرجاع إلى المحكمة.
          </div>
        ) : null}
      </div>
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
                    تأكيد الاستلام
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

export function TimelinePanel({ env }: { env: KeyEnvelopeRow }) {
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

export function CourtAccessPanel({
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
