"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  FormRow,
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
  Textarea,
  useToast,
} from "@platform/design-system";
import {
  addEnvelopeAssignment,
  confirmEnvelopeAssignment,
  confirmEnvelopeHandoff,
  createEnvelopeHandoff,
  loadKeyEnvelope,
  savePropertyCourtAccess,
  uploadEnvelopeAttachment,
} from "../lib/keys-envelope-api";
import {
  assignmentStatusLabel,
  envelopeStatusLabel,
  envelopeStatusTone,
  handoffKindLabel,
  scenarioLabel,
  studyHoldLabel,
  type KeyEnvelopeRow,
} from "../lib/keys-envelope-types";

function formatDate(iso: string): string {
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
  const [env, setEnv] = useState<KeyEnvelopeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [deed, setDeed] = useState("");
  const [handoffKind, setHandoffKind] = useState("internal");
  const [fromParty, setFromParty] = useState("");
  const [toParty, setToParty] = useState("");
  const [letterNumber, setLetterNumber] = useState("");
  const [letterId, setLetterId] = useState<string | null>(null);
  const [handoffNotes, setHandoffNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const letterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!envelopeId) {
      setEnv(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const result = await loadKeyEnvelope(envelopeId);
      if (cancelled) return;
      setLoading(false);
      if (result.ok) setEnv(result.data);
      else {
        showToast(result.error, "error");
        onClose();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envelopeId, onClose, showToast]);

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

  async function handleAddAssignment() {
    if (!env || !deed.trim()) return;
    setBusy(true);
    const linked = env.linkedProperties.find(
      (p) => p.deedNumber.trim() === deed.trim(),
    );
    const result = await addEnvelopeAssignment(
      env.id,
      deed.trim(),
      linked?.propertyId,
    );
    setBusy(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    setDeed("");
    showToast("تم إضافة الإسناد.", "success");
    await refresh(result.data);
  }

  async function handleConfirmAssignment(
    assignmentId: string,
    status: "matched" | "unmatched",
  ) {
    if (!env) return;
    setBusy(true);
    const result = await confirmEnvelopeAssignment(
      env.id,
      assignmentId,
      status,
    );
    setBusy(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast("تم تحديث الإسناد.", "success");
    await refresh(result.data);
  }

  async function handleHandoffLetter(file: File | undefined) {
    if (!file || !env) return;
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
  }

  async function handleCreateHandoff() {
    if (!env) return;
    setBusy(true);
    const result = await createEnvelopeHandoff(env.id, {
      kind: handoffKind,
      fromParty,
      toParty,
      letterNumber: letterNumber || null,
      letterAttachmentId: letterId,
      notes: handoffNotes || null,
    });
    setBusy(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    setFromParty("");
    setToParty("");
    setLetterNumber("");
    setLetterId(null);
    setHandoffNotes("");
    showToast("تم تسجيل المناولة.", "success");
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

  async function handleCourtAccess(
    propertyId: string,
    kind: "enabling" | "eviction",
    file: File,
  ) {
    if (!env) return;
    setBusy(true);
    const upload = await uploadEnvelopeAttachment(kind, propertyId, file);
    if (!upload.ok) {
      setBusy(false);
      showToast(upload.error, "error");
      return;
    }
    const result = await savePropertyCourtAccess({
      propertyId,
      hasEnablingLetter: kind === "enabling",
      enablingLetterAttachmentId:
        kind === "enabling" ? upload.data.id : null,
      hasEvictionNotice: kind === "eviction",
      evictionNoticeAttachmentId:
        kind === "eviction" ? upload.data.id : null,
      contactPhones: env.contactPhones ?? null,
    });
    setBusy(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast(
      kind === "enabling"
        ? "تم تسجيل خطاب التمكين."
        : "تم تسجيل محظر الإخلاء — الدراسة معلّقة.",
      "success",
    );
    onChanged();
  }

  const needsLetter = handoffKind !== "internal";

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard
        wide
        onClick={(e) => e.stopPropagation()}
        className="max-w-[720px] p-0"
      >
        <ModalHeader className="border-0 bg-ink text-white">
          <ModalTitle className="text-start text-white">
            تفاصيل الظرف
            {env ? ` — ${env.requestNumber}` : ""}
          </ModalTitle>
          <ModalClose
            className="text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
          {loading || !env ? (
            <p className="text-sm text-text-3">جاري التحميل…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={envelopeStatusTone(env.status)} dot>
                  {envelopeStatusLabel(env.status)}
                </Badge>
                <Badge tone="default">{scenarioLabel(env.receiveScenario)}</Badge>
                {env.feeGenerated ? (
                  <Badge tone="success">
                    أتعاب {env.feeAmountSar?.toLocaleString("ar-SA") ?? "—"} ر.س
                  </Badge>
                ) : null}
                {env.countMismatch ? (
                  <Badge tone="warning" dot>
                    تعارض العدد
                  </Badge>
                ) : null}
              </div>
              <div className="grid gap-2 text-[12px] text-text-2 sm:grid-cols-2">
                <div>المحكمة: {env.court}</div>
                <div>الدائرة: {env.circuit}</div>
                <div>
                  المفاتيح: فعلي {env.keysCountActual} / مكتوب{" "}
                  {env.keysCountLabeled}
                </div>
                <div>المسجّل: {env.createdByName || "—"}</div>
                {env.contactPhones ? (
                  <div className="sm:col-span-2">
                    تواصل: {env.contactPhones}
                  </div>
                ) : null}
                {env.notes ? (
                  <div className="sm:col-span-2">ملاحظات: {env.notes}</div>
                ) : null}
              </div>

              <section>
                <h3 className="mb-2 text-[13px] font-bold text-text">
                  إسناد المفاتيح للصكوك
                </h3>
                {env.assignments.length === 0 ? (
                  <p className="text-[11px] text-text-3">لا إسنادات بعد.</p>
                ) : (
                  <ul className="space-y-2">
                    {env.assignments.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[12px]"
                      >
                        <div>
                          <span className="font-medium">صك {a.deedNumber}</span>
                          <Badge
                            className="ms-2"
                            tone={
                              a.status === "matched"
                                ? "success"
                                : a.status === "unmatched"
                                  ? "danger"
                                  : "warning"
                            }
                            dot
                          >
                            {assignmentStatusLabel(a.status)}
                          </Badge>
                        </div>
                        {canEdit && a.status === "pending" ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={busy}
                              showActionToast={false}
                              onClick={() =>
                                void handleConfirmAssignment(a.id, "matched")
                              }
                            >
                              مطابق
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              showActionToast={false}
                              onClick={() =>
                                void handleConfirmAssignment(a.id, "unmatched")
                              }
                            >
                              غير مطابق
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {canEdit ? (
                  <div className="mt-2 flex gap-2">
                    <Input
                      placeholder="رقم صك جديد"
                      value={deed}
                      onChange={(e) => setDeed(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !deed.trim()}
                      showActionToast={false}
                      onClick={() => void handleAddAssignment()}
                    >
                      إسناد
                    </Button>
                  </div>
                ) : null}
              </section>

              <section>
                <h3 className="mb-2 text-[13px] font-bold text-text">
                  المناولة (العهدة)
                </h3>
                {env.handoffs.length === 0 ? (
                  <p className="mb-2 text-[11px] text-text-3">لا مناولات بعد.</p>
                ) : (
                  <ul className="mb-3 space-y-2">
                    {env.handoffs.map((h) => (
                      <li
                        key={h.id}
                        className="rounded-md border border-border px-3 py-2 text-[12px]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {handoffKindLabel(h.kind)}: {h.fromParty} →{" "}
                            {h.toParty}
                          </span>
                          <Badge
                            tone={
                              h.status === "pending_confirm"
                                ? "warning"
                                : "success"
                            }
                            dot
                          >
                            {h.status === "pending_confirm"
                              ? "بانتظار تأكيد المعاين"
                              : "مكتمل"}
                          </Badge>
                        </div>
                        {canEdit && h.status === "pending_confirm" ? (
                          <Button
                            size="sm"
                            className="mt-2"
                            variant="primary"
                            disabled={busy}
                            showActionToast={false}
                            onClick={() => void handleConfirmHandoff(h.id)}
                          >
                            تأكيد الاستلام
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {canEdit && env.status !== "returned" ? (
                  <div className="space-y-2 rounded-md border border-dashed border-border p-3">
                    <Select
                      value={handoffKind}
                      onChange={(e) => setHandoffKind(e.target.value)}
                    >
                      <option value="internal">تسليم داخلي</option>
                      <option value="external">تسليم خارجي</option>
                      <option value="receive_back">استلام من طرف</option>
                      <option value="return_court">إرجاع للمحكمة</option>
                    </Select>
                    <FormRow>
                      <Input
                        placeholder="من"
                        value={fromParty}
                        onChange={(e) => setFromParty(e.target.value)}
                      />
                      <Input
                        placeholder="إلى"
                        value={toParty}
                        onChange={(e) => setToParty(e.target.value)}
                      />
                    </FormRow>
                    {needsLetter ? (
                      <>
                        <Input
                          placeholder="رقم الخطاب الرسمي"
                          value={letterNumber}
                          onChange={(e) => setLetterNumber(e.target.value)}
                        />
                        <input
                          ref={letterRef}
                          type="file"
                          accept="image/*,.pdf,application/pdf"
                          className="hidden"
                          onChange={(e) =>
                            void handleHandoffLetter(e.target.files?.[0])
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => letterRef.current?.click()}
                        >
                          {letterId
                            ? "تم رفع الخطاب ✓"
                            : "رفع ملف الخطاب الرسمي"}
                        </Button>
                      </>
                    ) : null}
                    <Textarea
                      placeholder="ملاحظات"
                      rows={2}
                      value={handoffNotes}
                      onChange={(e) => setHandoffNotes(e.target.value)}
                    />
                    <Button
                      variant="primary"
                      disabled={
                        busy || !fromParty.trim() || !toParty.trim()
                      }
                      showActionToast={false}
                      onClick={() => void handleCreateHandoff()}
                    >
                      تسجيل مناولة
                    </Button>
                  </div>
                ) : null}
              </section>

              <section>
                <h3 className="mb-2 text-[13px] font-bold text-text">
                  تمكين / محظر إخلاء (مستقل عن الظرف)
                </h3>
                {env.linkedProperties.length === 0 ? (
                  <p className="text-[11px] text-text-3">
                    لا عقارات مرتبطة لتسجيل مسار الدخول.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {env.linkedProperties.map((p) => (
                      <li
                        key={p.propertyId}
                        className="rounded-md border border-border px-3 py-2 text-[12px]"
                      >
                        <div className="mb-2">
                          صك {p.deedNumber} · {p.poNumber}
                        </div>
                        {canEdit ? (
                          <div className="flex flex-wrap gap-2">
                            <label className="cursor-pointer text-[11px] text-primary underline">
                              رفع خطاب تمكين
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f)
                                    void handleCourtAccess(
                                      p.propertyId,
                                      "enabling",
                                      f,
                                    );
                                }}
                              />
                            </label>
                            <label className="cursor-pointer text-[11px] text-danger-text underline">
                              رفع محظر إخلاء
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f)
                                    void handleCourtAccess(
                                      p.propertyId,
                                      "eviction",
                                      f,
                                    );
                                }}
                              />
                            </label>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-[10px] text-text-3">
                  محظر الإخلاء يعلّق الدراسة؛ خطاب التمكين يمكّن الدخول بدون
                  مفتاح. ({studyHoldLabel("enabled_no_key")} /{" "}
                  {studyHoldLabel("suspended_eviction")})
                </p>
              </section>

              <section>
                <h3 className="mb-2 text-[13px] font-bold text-text">
                  سجل الحركات
                </h3>
                {env.timeline.length === 0 ? (
                  <p className="text-[11px] text-text-3">لا أحداث.</p>
                ) : (
                  <ol className="space-y-2 border-s border-border ps-3">
                    {env.timeline.map((t) => (
                      <li key={t.id} className="text-[11px] text-text-2">
                        <div className="font-medium text-text">{t.summary}</div>
                        <div className="text-text-3">
                          {t.actorName || "—"} · {formatDate(t.createdAtUtc)}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </ModalBody>
        <ModalFooter className="justify-start">
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
