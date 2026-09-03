"use client";

/**
 * The four dialogs opened from `KeyEnvelopeDetailPage`: the field match result,
 * the receive/deliver handoff pair, and the court-access editor. Each owns only
 * its own form draft — validation, labels and tiles come from
 * `key-envelope-detail-state`, and results are reported back to the parent.
 */
import { useCallback, useRef, useState } from "react";
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
} from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import {
  confirmEnvelopeHandoff,
  createEnvelopeHandoff,
  savePropertyCourtAccess,
  uploadEnvelopeAttachment,
} from "../lib/keys-envelope-api";
import {
  studyHoldLabel,
  type KeyAssignmentMatchStatus,
  type KeyEnvelopeLinkedProperty,
  type KeyEnvelopeRow,
  type PropertyCourtAccessRow,
} from "../lib/keys-envelope-types";
import { FileIcon } from "./KeyEnvelopeDetailIcons";
import {
  COURT_ACCESS_OPTIONS,
  HANDOFF_NOTES_BY_KIND,
  MATCH_RESULT_TILES,
  buildDeliverHandoffBody,
  courtAccessOptionActive,
  courtAccessPreviewStatus,
  deliverHandoffKindLabel,
  displayPersonName,
  studyHoldColor,
  type DeliverHandoffBody,
} from "./key-envelope-detail-state";

export function MatchResultModal({
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

/** Receive envelope — confirm pending handoff so custody returns to the clerk (status is not «with clerk»). */
export function ReceiveEnvelopeModal({
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

  const { execute: executeReceive, loading: receiving } = useIdempotentAction(
    useCallback(
      async (idempotencyKey: string) => {
        if (!pending) throw new Error("لا توجد مناولة بانتظار التأكيد");
        return confirmEnvelopeHandoff(env.id, pending.id, idempotencyKey);
      },
      [env.id, pending?.id],
    ),
  );

  const buttonBusy = busy || receiving;

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
            disabled={buttonBusy}
            showActionToast={false}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            loading={buttonBusy}
            disabled={!pending}
            showActionToast={false}
            onClick={async () => {
              if (!pending) {
                showToast("لا توجد مناولة بانتظار التأكيد.", "error");
                return;
              }
              onBusy(true);
              try {
                const outcome = await executeReceive();
                if (outcome.status === "skipped") return;
                const result = outcome.value;
                if (!result.ok) {
                  showToast(result.error, "error");
                  return;
                }
                showToast(
                  `تم تأكيد استلام الظرف ${env.requestNumber}.`,
                  "success",
                );
                await onDone(result.data);
              } finally {
                onBusy(false);
              }
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
export function DeliverEnvelopeModal({
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
  const pendingHandoffBody = useRef<DeliverHandoffBody | null>(null);

  const { execute: executeDeliver, loading: delivering } = useIdempotentAction(
    useCallback(
      async (idempotencyKey: string) => {
        const body = pendingHandoffBody.current;
        if (!body) throw new Error("لا توجد بيانات تسليم");
        return createEnvelopeHandoff(env.id, body, idempotencyKey);
      },
      [env.id],
    ),
  );

  const buttonBusy = busy || delivering;

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
            disabled={buttonBusy}
            showActionToast={false}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            loading={buttonBusy}
            showActionToast={false}
            onClick={async () => {
              const built = buildDeliverHandoffBody(
                env,
                {
                  kind,
                  toUserId,
                  partyName,
                  partyOrg,
                  partyRole,
                  partyPhone,
                  letterId,
                },
                inspectors,
              );
              if (!built.ok) {
                setErr(built.error);
                return;
              }

              pendingHandoffBody.current = built.body;
              onBusy(true);
              try {
                const outcome = await executeDeliver();
                if (outcome.status === "skipped") return;
                const result = outcome.value;
                if (!result.ok) {
                  showToast(result.error, "error");
                  return;
                }
                showToast(
                  `تم تسجيل «${deliverHandoffKindLabel(kind)}» على الظرف ${env.requestNumber}.`,
                  "success",
                );
                await onDone(result.data);
              } finally {
                onBusy(false);
              }
            }}
          >
            تسليم
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}

export function CourtAccessModal({
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

  const previewStatus = courtAccessPreviewStatus(
    hasEnablingLetter,
    hasEvictionNotice,
  );
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
                const active = courtAccessOptionActive(
                  opt.id,
                  hasEnablingLetter,
                  hasEvictionNotice,
                );
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
