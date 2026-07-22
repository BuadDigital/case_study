"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, cn, useToast } from "@platform/design-system";
import { loadWorkOrderDtos } from "@platform/app-shared/prototype/work-orders-read";
import {
  fetchLinkedPropertiesByRequestNumber,
  registerKeyEnvelope,
  uploadEnvelopeAttachment,
} from "../lib/keys-envelope-api";
import type { KeyEnvelopeLinkedProperty } from "../lib/keys-envelope-types";

type SourceKind = "court" | "party";

type RequestSuggestion = {
  requestNumber: string;
  court: string;
  circuit: string;
  deedCount: number;
  sampleDeed: string;
};

type FilePick = { file: File; attachmentId?: string };

/** Exact HTML `.fld input/textarea` tokens — avoid design-system formControlClassName conflicts. */
const fldControlClassName =
  "box-border w-full rounded-[9px] border border-border-md bg-surface-2 px-3 py-[9px] font-[inherit] text-[13px] text-text outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_20%,transparent)]";

function Fld({
  full,
  className,
  children,
}: {
  full?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5", /* 6px — HTML .fld gap */
        full && "col-span-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="m-0 text-[12px] font-semibold text-text-2"
    >
      {children}
    </label>
  );
}

function CameraIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <circle cx="12" cy="13" r="3.2" />
      <path d="M8 6l1.5-2h5L16 6" />
    </svg>
  );
}

function FeeIcon({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
        aria-hidden
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="m9 11 3 3L22 4" />
      </svg>
    );
  }
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0"
      aria-hidden
    >
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export function RegisterKeyEnvelopeModal({
  open,
  busy,
  onClose,
  onRegistered,
  initialRequestNumber = "",
  operationsTaskId,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onRegistered: (envelopeId: string) => void;
  /** Prefill رقم الطلب when opening from a court-visit task. */
  initialRequestNumber?: string;
  /** Link envelope to the court_visit operations task (from ?task=). */
  operationsTaskId?: string;
}) {
  const { showToast } = useToast();
  const [source, setSource] = useState<SourceKind>("court");
  const [requestNumber, setRequestNumber] = useState("");
  const [court, setCourt] = useState("");
  const [circuit, setCircuit] = useState("");
  const [keysCount, setKeysCount] = useState("1");
  const [notes, setNotes] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyOrg, setPartyOrg] = useState("");
  const [partyRole, setPartyRole] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [photo, setPhoto] = useState<FilePick | null>(null);
  const [linked, setLinked] = useState<KeyEnvelopeLinkedProperty[]>([]);
  const [suggestions, setSuggestions] = useState<RequestSuggestion[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSource("court");
    setRequestNumber(initialRequestNumber.trim());
    setCourt("");
    setCircuit("");
    setKeysCount("1");
    setNotes("");
    setPartyName("");
    setPartyOrg("");
    setPartyRole("");
    setPartyPhone("");
    setPhoto(null);
    setLinked([]);
    setListOpen(false);
    setDragOver(false);
    setFormError("");
  }, [open, initialRequestNumber]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const orders = await loadWorkOrderDtos();
        if (cancelled) return;
        const byRequest = new Map<string, RequestSuggestion>();
        for (const order of orders) {
          for (const prop of order.properties ?? []) {
            if (prop.isRemoved) continue;
            const req = (prop.requestNumber ?? "").trim();
            if (!req) continue;
            const existing = byRequest.get(req);
            if (existing) {
              existing.deedCount += 1;
              continue;
            }
            byRequest.set(req, {
              requestNumber: req,
              court: (prop.court ?? "").trim(),
              circuit: (prop.circuit ?? "").trim(),
              deedCount: 1,
              sampleDeed: (prop.deedNumber ?? "").trim(),
            });
          }
        }
        setSuggestions(
          [...byRequest.values()].sort((a, b) =>
            a.requestNumber.localeCompare(b.requestNumber, "ar", {
              numeric: true,
            }),
          ),
        );
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = requestNumber.trim();
    if (trimmed.length < 2) {
      setLinked([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await fetchLinkedPropertiesByRequestNumber(trimmed);
        if (cancelled) return;
        if (result.ok) {
          setLinked(result.data);
          const first = result.data[0];
          if (first) {
            setCourt((prev) => prev.trim() || first.court);
            setCircuit((prev) => prev.trim() || first.circuit);
          }
        } else {
          setLinked([]);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, requestNumber]);

  const filteredSuggestions = useMemo(() => {
    const q = requestNumber.trim();
    const list = !q
      ? suggestions
      : suggestions.filter((s) => s.requestNumber.includes(q));
    return list.slice(0, 12);
  }, [suggestions, requestNumber]);

  if (!open) return null;

  const count = Number.parseInt(keysCount, 10);
  const photoReady = Boolean(photo?.attachmentId);
  const photoPicked = Boolean(photo);
  const locked = saving || busy || uploading;

  function pickSuggestion(s: RequestSuggestion) {
    setRequestNumber(s.requestNumber);
    setCourt(s.court);
    setCircuit(s.circuit);
    setListOpen(false);
    setFormError("");
  }

  async function handlePhotoFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("يُقبل ملف صورة فقط.", "error");
      return;
    }
    setUploading(true);
    setPhoto({ file });
    setFormError("");
    const upload = await uploadEnvelopeAttachment(
      "photo",
      requestNumber.trim() || "draft",
      file,
    );
    setUploading(false);
    if (!upload.ok) {
      showToast(upload.error, "error");
      setPhoto(null);
      return;
    }
    setPhoto({ file, attachmentId: upload.data.id });
  }

  async function handleSave() {
    if (locked) return;
    const request = requestNumber.trim();
    const actual = Number.isFinite(count) ? count : 0;
    if (!request) {
      setFormError("رقم طلب إنفاذ مطلوب.");
      return;
    }
    if (source === "party" && !partyName.trim()) {
      setFormError("يلزم إدخال اسم الطرف المسلِّم.");
      return;
    }
    if (source === "party" && !partyPhone.trim()) {
      setFormError("يلزم إدخال رقم جوال الطرف المسلِّم.");
      return;
    }
    if (actual < 1) {
      setFormError("عدد المفاتيح يجب أن يكون ١ على الأقل.");
      return;
    }
    if (source === "court" && !photo?.attachmentId) {
      setFormError("صورة الظرف مطلوبة لإثبات أتعاب الاستلام.");
      return;
    }

    setSaving(true);
    setFormError("");
    const contact =
      source === "party"
        ? [
            partyName.trim(),
            partyOrg.trim() ? `ممثل ${partyOrg.trim()}` : "",
            partyRole.trim() ? `بصفتها ${partyRole.trim()}` : "",
            partyPhone.trim(),
          ]
            .filter(Boolean)
            .join(" — ")
        : "";
    const result = await registerKeyEnvelope({
      requestNumber: request,
      court: court.trim() || "—",
      circuit: circuit.trim() || "—",
      keysCountLabeled: actual,
      keysCountActual: actual,
      receiveScenario: source === "court" ? "court" : "third_party",
      photoAttachmentId: photo?.attachmentId,
      contactPhones: contact,
      notes,
      operationsTaskId: operationsTaskId?.trim() || undefined,
      assignments: linked.map((p) => ({
        deedNumber: p.deedNumber,
        propertyId: p.propertyId,
      })),
    });
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      showToast(result.error, "error");
      return;
    }
    const fee = result.data.feeGenerated;
    showToast(
      `تم تسجيل الظرف ${request}${fee ? " وتوليد بند الأتعاب." : "."}`,
      "success",
    );
    onRegistered(result.data.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-[rgba(16,43,78,0.42)] px-4 py-[6vh] backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <style>{`@keyframes keyModalIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}`}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kf-register-title"
        className="w-full max-w-[640px] overflow-hidden rounded-[16px] border border-border bg-surface shadow-[0_24px_60px_-18px_rgba(16,43,78,0.5)] [animation:keyModalIn_0.22s_ease_both]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* .modal-head */}
        <div className="flex items-center justify-between border-b border-border px-[22px] py-4">
          <h2
            id="kf-register-title"
            className="m-0 text-[16px] font-extrabold text-heading"
          >
            تسجيل ظرف مفاتيح
          </h2>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-[9px] border-none bg-surface-2 text-[15px] leading-none text-text-2 transition-[background,color] duration-150 hover:bg-row-hover hover:text-heading"
            onClick={onClose}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* .modal-body */}
        <div className="px-[22px] py-5">
          {formError ? (
            <div className="mb-4 rounded-[10px] border border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] px-[13px] py-2.5 text-[12.5px] font-semibold text-[#a32d2d]">
              {formError}
            </div>
          ) : null}

          {/* .form-grid */}
          <div className="grid grid-cols-2 gap-3.5">
            <Fld full>
              <FldLabel htmlFor="kf-request">رقم الطلب *</FldLabel>
              <div className="relative">
                <input
                  id="kf-request"
                  value={requestNumber}
                  autoComplete="off"
                  placeholder="اكتب للبحث في طلبات المعاملات المفتوحة..."
                  className={fldControlClassName}
                  onChange={(e) => {
                    setRequestNumber(e.target.value);
                    setListOpen(true);
                  }}
                  onFocus={() => setListOpen(true)}
                  onBlur={() => {
                    if (blurTimer.current)
                      window.clearTimeout(blurTimer.current);
                    blurTimer.current = window.setTimeout(
                      () => setListOpen(false),
                      150,
                    );
                  }}
                />
                {listOpen && filteredSuggestions.length > 0 ? (
                  <div className="absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-[220px] overflow-y-auto rounded-[10px] border border-border-md bg-surface p-1 shadow-[0_12px_30px_-8px_rgba(18,40,76,0.3)]">
                    {filteredSuggestions.map((s) => (
                      <button
                        key={s.requestNumber}
                        type="button"
                        className="flex w-full items-center gap-2.5 rounded-lg border-none bg-transparent px-[11px] py-2 text-start hover:bg-row-hover"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickSuggestion(s)}
                      >
                        <span className="shrink-0 text-[13px] font-bold text-[var(--gold-d)]">
                          {s.requestNumber}
                        </span>
                        <span className="min-w-0 truncate text-[11.5px] text-text-2">
                          {s.court || "—"}
                          {" · "}
                          {s.deedCount > 1
                            ? `${s.deedCount} صكوك`
                            : `صك ${s.sampleDeed || "—"}`}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Fld>

            <Fld full>
              <FldLabel>
                مصدر استلام الظرف *
              </FldLabel>
              <div className="flex gap-2">
                {(
                  [
                    { id: "court" as const, label: "المحكمة" },
                    { id: "party" as const, label: "طرف آخر" },
                  ] as const
                ).map((opt) => {
                  const on = source === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={cn(
                        "h-[38px] flex-1 cursor-pointer rounded-[10px] border-[1.5px] font-[inherit] text-[12.5px] font-bold transition-all duration-150",
                        on
                          ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold-d)]"
                          : "border-border-md bg-surface-2 text-text-2",
                      )}
                      onClick={() => setSource(opt.id)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Fld>

            {source === "party" ? (
              <Fld full>
                <FldLabel>بيانات الطرف المسلِّم *</FldLabel>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    placeholder="الاسم * — مثال: محمد أحمد حسن"
                    value={partyName}
                    className={fldControlClassName}
                    onChange={(e) => setPartyName(e.target.value)}
                  />
                  <input
                    placeholder="الجهة التي يمثلها — مثال: شركة أبعاد للتقييم"
                    value={partyOrg}
                    className={fldControlClassName}
                    onChange={(e) => setPartyOrg(e.target.value)}
                  />
                  <input
                    placeholder="الصفة — مثال: وكيل بيع"
                    value={partyRole}
                    className={fldControlClassName}
                    onChange={(e) => setPartyRole(e.target.value)}
                  />
                  <input
                    dir="ltr"
                    placeholder="* 05xxxxxxxx"
                    value={partyPhone}
                    className={fldControlClassName}
                    onChange={(e) => setPartyPhone(e.target.value)}
                  />
                </div>
              </Fld>
            ) : null}

            <Fld>
              <FldLabel htmlFor="kf-court">المحكمة</FldLabel>
              <input
                id="kf-court"
                placeholder="محكمة التنفيذ ب..."
                value={court}
                className={fldControlClassName}
                onChange={(e) => setCourt(e.target.value)}
              />
            </Fld>

            <Fld>
              <FldLabel htmlFor="kf-circuit">الدائرة</FldLabel>
              <input
                id="kf-circuit"
                placeholder="الدائرة ..."
                value={circuit}
                className={fldControlClassName}
                onChange={(e) => setCircuit(e.target.value)}
              />
            </Fld>

            <Fld>
              <FldLabel htmlFor="kf-count">عدد المفاتيح *</FldLabel>
              <input
                id="kf-count"
                type="number"
                min={1}
                value={keysCount}
                className={fldControlClassName}
                onChange={(e) => setKeysCount(e.target.value)}
              />
            </Fld>

            <Fld full>
              <FldLabel>
                صورة الظرف — اضغط الخانة للالتقاط بالكاميرا أو اسحب الملف إليها
              </FldLabel>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void handlePhotoFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "cursor-pointer rounded-[12px] border-[1.5px] border-dashed px-3 py-3.5 text-center transition-[border-color,background] duration-150",
                  photoPicked
                    ? "border-[#3f8f5f] bg-[color-mix(in_srgb,#3f8f5f_7%,transparent)]"
                    : dragOver
                      ? "border-[var(--gold)] bg-[var(--gold-soft)]"
                      : "border-border-md",
                )}
                onClick={() => {
                  if (uploading) return;
                  photoRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    photoRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void handlePhotoFile(e.dataTransfer.files?.[0]);
                }}
              >
                {photoPicked && photo ? (
                  <div>
                    <div className="flex items-center justify-center gap-2 text-[#2f7a4d]">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span className="text-[12.5px] font-bold text-heading">
                        صورة الظرف
                      </span>
                    </div>
                    <div
                      className="mt-[5px] truncate text-[11px] text-text-2"
                      dir="ltr"
                    >
                      {uploading ? "جاري الرفع…" : photo.file.name}
                    </div>
                    <div className="mt-2 flex justify-center gap-3">
                      <button
                        type="button"
                        className="cursor-pointer border-none bg-transparent text-[11px] font-bold text-[var(--gold-d)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          photoRef.current?.click();
                        }}
                      >
                        استبدال
                      </button>
                      <button
                        type="button"
                        className="cursor-pointer border-none bg-transparent text-[11px] font-bold text-[#d9694f]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhoto(null);
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid place-items-center gap-1.5 text-text-3">
                    <CameraIcon />
                    <span className="text-[12.5px] font-bold text-heading">
                      صورة الظرف *
                    </span>
                    <span className="text-[11px]">
                      التقط الظرف وعليه رقم الطلب
                    </span>
                  </div>
                )}
              </div>
            </Fld>

            <Fld full>
              <FldLabel htmlFor="kf-notes">ملاحظات</FldLabel>
              <textarea
                id="kf-notes"
                rows={2}
                placeholder="اختياري"
                value={notes}
                className={cn(fldControlClassName, "resize-y")}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Fld>
          </div>

          <div
            className="mt-3 flex items-start gap-[9px] rounded-[10px] px-3.5 py-2.5 text-[12.5px] font-semibold leading-[1.7]"
            style={{
              background: photoReady
                ? "color-mix(in srgb, #3f8f5f 12%, transparent)"
                : "color-mix(in srgb, #d9a441 14%, transparent)",
              color: photoReady ? "#2f7a4d" : "#8a5e14",
            }}
          >
            <FeeIcon ok={photoReady} />
            <span>
              {photoReady
                ? "تم إثبات أتعاب استلام المفاتيح — صورة الظرف توثّق استحقاق الشركة لدى مركز الإسناد والتصفية."
                : "صورة الظرف هي إثبات أتعاب استلام المفاتيح التي تستحقها الشركة من مركز الإسناد والتصفية. أتعاب الزيارة نفسها تُستحق عبر إسناد مهمة زيارة المحكمة."}
            </span>
          </div>
        </div>

        {/* .modal-foot */}
        <div className="flex justify-end gap-2.5 border-t border-border bg-surface-2 px-[22px] py-3.5">
          <button
            type="button"
            disabled={locked}
            className="cursor-pointer rounded-[9px] border border-border-md bg-surface px-[18px] py-2.5 text-[13px] font-semibold text-text-2 transition-colors duration-150 hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-65"
            onClick={onClose}
          >
            إلغاء
          </button>
          <Button
            variant="primary"
            loading={saving}
            disabled={locked}
            className="gap-[7px] rounded-lg border-none bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,0.6)] hover:border-none hover:bg-navy-3"
            showActionToast={false}
            onClick={() => void handleSave()}
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
            <span>تسجيل الظرف</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
