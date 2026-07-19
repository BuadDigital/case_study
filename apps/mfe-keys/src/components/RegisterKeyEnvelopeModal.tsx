"use client";

import { useEffect, useRef, useState } from "react";
import {
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
  Note,
  Select,
  Textarea,
  useToast,
} from "@platform/design-system";
import {
  fetchLinkedPropertiesByRequestNumber,
  registerKeyEnvelope,
  uploadEnvelopeAttachment,
} from "../lib/keys-envelope-api";
import type { KeyEnvelopeLinkedProperty } from "../lib/keys-envelope-types";

type FilePick = { file: File; attachmentId?: string };

export function RegisterKeyEnvelopeModal({
  open,
  busy,
  onClose,
  onRegistered,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const { showToast } = useToast();
  const [scenario, setScenario] = useState("court");
  const [requestNumber, setRequestNumber] = useState("");
  const [court, setCourt] = useState("");
  const [circuit, setCircuit] = useState("");
  const [keysLabeled, setKeysLabeled] = useState("0");
  const [keysActual, setKeysActual] = useState("1");
  const [contactPhones, setContactPhones] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<FilePick | null>(null);
  const [photo, setPhoto] = useState<FilePick | null>(null);
  const [thirdParty, setThirdParty] = useState<FilePick | null>(null);
  const [linked, setLinked] = useState<KeyEnvelopeLinkedProperty[]>([]);
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const receiptRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const thirdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setScenario("court");
    setRequestNumber("");
    setCourt("");
    setCircuit("");
    setKeysLabeled("0");
    setKeysActual("1");
    setContactPhones("");
    setNotes("");
    setReceipt(null);
    setPhoto(null);
    setThirdParty(null);
    setLinked([]);
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
        setLinkedLoading(true);
        const result = await fetchLinkedPropertiesByRequestNumber(trimmed);
        if (cancelled) return;
        setLinkedLoading(false);
        if (result.ok) {
          setLinked(result.data);
          const first = result.data[0];
          if (first) {
            setCourt((prev) => prev.trim() || first.court);
            setCircuit((prev) => prev.trim() || first.circuit);
          }
        } else setLinked([]);
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, requestNumber]);

  if (!open) return null;

  const labeled = Number.parseInt(keysLabeled, 10);
  const actual = Number.parseInt(keysActual, 10);
  const countMismatch =
    scenario === "court" &&
    Number.isFinite(labeled) &&
    Number.isFinite(actual) &&
    labeled !== actual;

  const canSave =
    requestNumber.trim().length > 0 &&
    court.trim().length > 0 &&
    circuit.trim().length > 0 &&
    !saving &&
    !busy &&
    (scenario === "court"
      ? Number.isFinite(actual) &&
        actual >= 1 &&
        Boolean(receipt?.attachmentId) &&
        Boolean(photo?.attachmentId)
      : scenario === "missing"
        ? contactPhones.trim().length > 0
        : Boolean(thirdParty?.attachmentId));

  async function handleFile(
    kind: "receipt" | "photo" | "third-party",
    file: File | undefined,
  ) {
    if (!file) return;
    const setPick =
      kind === "receipt"
        ? setReceipt
        : kind === "photo"
          ? setPhoto
          : setThirdParty;
    setPick({ file });
    const upload = await uploadEnvelopeAttachment(
      kind,
      requestNumber.trim() || "draft",
      file,
    );
    if (!upload.ok) {
      showToast(upload.error, "error");
      setPick(null);
      return;
    }
    setPick({ file, attachmentId: upload.data.id });
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const result = await registerKeyEnvelope({
      requestNumber,
      court,
      circuit,
      keysCountLabeled: Number.isFinite(labeled) ? Math.max(0, labeled) : 0,
      keysCountActual:
        scenario === "court" && Number.isFinite(actual) ? actual : 0,
      receiveScenario: scenario,
      receiptAttachmentId: receipt?.attachmentId,
      photoAttachmentId: photo?.attachmentId,
      thirdPartyLetterAttachmentId: thirdParty?.attachmentId,
      contactPhones,
      notes,
      assignments: linked.map((p) => ({
        deedNumber: p.deedNumber,
        propertyId: p.propertyId,
      })),
    });
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast("تم تسجيل الظرف بنجاح.", "success");
    onRegistered();
    onClose();
  }

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard wide onClick={(e) => e.stopPropagation()} className="p-0">
        <ModalHeader className="border-0 bg-ink text-white">
          <ModalTitle className="text-start text-white">
            تسجيل ظرف مفاتيح
          </ModalTitle>
          <ModalClose
            className="text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <div>
            <Label htmlFor="env-scenario">سيناريو الاستلام</Label>
            <Select
              id="env-scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              <option value="court">أ — المفاتيح موجودة بالمحكمة</option>
              <option value="missing">ب — المفاتيح غير موجودة</option>
              <option value="third_party">ج — المفاتيح عند طرف آخر</option>
            </Select>
          </div>
          <FormRow>
            <div>
              <Label htmlFor="env-request">
                رقم الطلب (إنفاذ) <span className="text-danger-text">*</span>
              </Label>
              <Input
                id="env-request"
                value={requestNumber}
                maxLength={128}
                onChange={(e) => setRequestNumber(e.target.value)}
              />
            </div>
          </FormRow>
          <FormRow>
            <div>
              <Label htmlFor="env-court">
                المحكمة <span className="text-danger-text">*</span>
              </Label>
              <Input
                id="env-court"
                value={court}
                maxLength={256}
                onChange={(e) => setCourt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="env-circuit">
                الدائرة <span className="text-danger-text">*</span>
              </Label>
              <Input
                id="env-circuit"
                value={circuit}
                maxLength={150}
                onChange={(e) => setCircuit(e.target.value)}
              />
            </div>
          </FormRow>

          {scenario === "court" ? (
            <>
              <FormRow>
                <div>
                  <Label htmlFor="env-labeled">العدد المكتوب *</Label>
                  <Input
                    id="env-labeled"
                    type="number"
                    min={0}
                    value={keysLabeled}
                    onChange={(e) => setKeysLabeled(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="env-actual">العدد الفعلي *</Label>
                  <Input
                    id="env-actual"
                    type="number"
                    min={1}
                    value={keysActual}
                    onChange={(e) => setKeysActual(e.target.value)}
                  />
                </div>
              </FormRow>
              {countMismatch ? (
                <Note tone="warn">
                  تعارض بين العدد المكتوب ({labeled}) والفعلي ({actual}). سجّل
                  الرقمين معاً واطلب تعديل خطاب الاستلام إن أمكن.
                </Note>
              ) : null}
              <FormRow>
                <div>
                  <Label>خطاب الاستلام *</Label>
                  <input
                    ref={receiptRef}
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    className="hidden"
                    onChange={(e) =>
                      void handleFile("receipt", e.target.files?.[0])
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-1 w-full"
                    onClick={() => receiptRef.current?.click()}
                  >
                    {receipt?.file.name ?? "اختيار ملف الخطاب"}
                  </Button>
                </div>
                <div>
                  <Label>صورة الظرف *</Label>
                  <input
                    ref={photoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      void handleFile("photo", e.target.files?.[0])
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-1 w-full"
                    onClick={() => photoRef.current?.click()}
                  >
                    {photo?.file.name ?? "اختيار صورة الظرف"}
                  </Button>
                </div>
              </FormRow>
            </>
          ) : null}

          {scenario === "missing" ? (
            <Note tone="info">
              لا يُولَّد بند أتعاب تلقائياً. سجّل أرقام التواصل مع طالب التنفيذ
              أو وكيله.
            </Note>
          ) : null}

          {scenario === "third_party" ? (
            <div>
              <Label>خطاب حامل المفتاح *</Label>
              <input
                ref={thirdRef}
                type="file"
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={(e) =>
                  void handleFile("third-party", e.target.files?.[0])
                }
              />
              <Button
                type="button"
                variant="outline"
                className="mt-1 w-full"
                onClick={() => thirdRef.current?.click()}
              >
                {thirdParty?.file.name ?? "اختيار الخطاب الرسمي"}
              </Button>
              <Note tone="info" className="mt-2">
                لا يُولَّد بند أتعاب تلقائياً لسيناريو الطرف الثالث.
              </Note>
            </div>
          ) : null}

          <div>
            <Label htmlFor="env-phones">
              أرقام التواصل
              {scenario === "missing" ? (
                <span className="text-danger-text"> *</span>
              ) : null}
            </Label>
            <Input
              id="env-phones"
              value={contactPhones}
              maxLength={1000}
              onChange={(e) => setContactPhones(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="env-notes">ملاحظات</Label>
            <Textarea
              id="env-notes"
              value={notes}
              maxLength={4000}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <p className="text-xs font-semibold text-text">
              عقارات مرتبطة برقم الطلب
            </p>
            {linkedLoading ? (
              <p className="mt-2 text-[11px] text-text-3">جاري البحث…</p>
            ) : linked.length === 0 ? (
              <p className="mt-2 text-[11px] text-text-3">
                لا توجد عقارات بهذا الرقم بعد.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {linked.map((p) => (
                  <li key={p.propertyId} className="text-[11px] text-text-2">
                    صك {p.deedNumber || "—"} · {p.poNumber || "—"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="justify-start">
          <Button
            variant="primary"
            loading={saving}
            disabled={!canSave}
            showActionToast={false}
            onClick={() => void handleSave()}
          >
            تسجيل الظرف
          </Button>
          <Button variant="outline" disabled={saving || busy} onClick={onClose}>
            إلغاء
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
