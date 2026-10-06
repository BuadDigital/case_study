"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getValuationReconciliation,
  getValuationValueDocuments,
  saveValuationValueDocuments,
  type ValuationReconciliationDto,
  type ValuationValueDocumentsDto,
} from "@platform/api-client";
import { cn, useToast } from "@platform/ui-kit";
import { requestDocumentPreview } from "@platform/app-shared/app-data/document-preview-store";
import { ValuedDocumentUploadButton } from "@platform/app-shared/components/ValuedDocumentUploadButton";

import { Card, CardPad, GhostBtn } from "./atoms";
import { apiConfig } from "./lib/shell-utils";
import {
  VALUE_DOCUMENT_STATUS_LABELS,
  availableDocumentApproaches,
  draftsFromDocuments,
  valueDocumentDraftErrors,
  valueDocumentsSavePayload,
  type ValueDocumentDraft,
  type ValueDocumentDrafts,
} from "./lib/value-documents-state";

const inputClass =
  "rounded-[7px] border border-border-md bg-surface px-2.5 py-1.5 text-[12.5px] text-heading";

/**
 * «مستندات ذات قيمة» — the appraiser alone decides each document's effect: none, an approach
 * indicator (joins the reconciliation below), or an amount added after the liquidation
 * discount. Issuance needs every used document approved by the case specialist.
 */
export function ValueDocumentsPanel({
  valuationRequestId,
  poNumber,
  propertyId,
  disabled,
  onReconSaved,
}: {
  valuationRequestId: string | null;
  poNumber?: string;
  propertyId?: string;
  disabled?: boolean;
  onReconSaved: (dto: ValuationReconciliationDto) => void;
}) {
  const { showToast } = useToast();
  const [data, setData] = useState<ValuationValueDocumentsDto | null>(null);
  const [drafts, setDrafts] = useState<ValueDocumentDrafts>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const apply = useCallback((dto: ValuationValueDocumentsDto) => {
    setData(dto);
    setDrafts(draftsFromDocuments(dto.documents));
    setDirty(false);
  }, []);

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    let cancelled = false;
    void getValuationValueDocuments(config, valuationRequestId).then((res) => {
      if (!cancelled && res.ok) apply(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [valuationRequestId, apply, reloadKey]);

  const internal = useMemo(() => data?.internalApproachKinds ?? [], [data]);
  const approaches = useMemo(() => availableDocumentApproaches(internal), [internal]);
  const errors = useMemo(
    () => (data ? valueDocumentDraftErrors(data.documents, drafts, internal) : {}),
    [data, drafts, internal],
  );

  // Not loaded, or not the specialist / appraiser (the server answers 403) — nothing to show.
  if (!data) return null;
  const uploadButton = (
    <ValuedDocumentUploadButton
      poNumber={poNumber ?? ""}
      propertyId={propertyId ?? ""}
      disabled={disabled}
      showOwnList={false}
      onUploaded={() => setReloadKey((k) => k + 1)}
    />
  );
  if (data.documents.length === 0) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-dashed border-border px-3 py-2">
        <span className="text-[11.5px] text-text-3">
          لا توجد مستندات ذات قيمة على العقار — مستند يحمل قيمة (تقييم آلات، دراسة دخل…) يُرفع هنا
          ويعتمده الأخصائي.
        </span>
        {uploadButton}
      </div>
    );
  }

  function patch(id: string, next: Partial<ValueDocumentDraft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id]!, ...next } }));
    setDirty(true);
  }

  async function save() {
    const config = apiConfig();
    if (!config || !valuationRequestId || !data) return;
    if (Object.keys(errors).length > 0) {
      showToast(Object.values(errors)[0]!, "error");
      return;
    }
    setSaving(true);
    const res = await saveValuationValueDocuments(
      config,
      valuationRequestId,
      valueDocumentsSavePayload(data.documents, drafts),
    );
    if (!res.ok) {
      setSaving(false);
      showToast(res.message ?? "تعذّر حفظ أثر المستندات", "error");
      return;
    }
    apply(res.data);
    // Indicators change the reconciliation rows and additions change the final value.
    const recon = await getValuationReconciliation(config, valuationRequestId);
    setSaving(false);
    if (recon.ok) onReconSaved(recon.data);
    showToast("تم حفظ أثر المستندات ذات القيمة", "success");
  }

  return (
    <Card className="mb-6">
      <CardPad>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 text-[15px] font-extrabold text-heading">مستندات ذات قيمة</h2>
          <span className="text-[11px] text-text-3">
            الأثر يحدده المقيّم · الإصدار يتطلب اعتماد الأخصائي لكل مستند مستخدم
          </span>
        </div>
        <p className="mt-0 mb-3 text-[11.5px] leading-relaxed text-text-3">
          «مؤشر أسلوب» يدخل الترجيح بوزن كبقية الأساليب. «قيمة تُضاف» تُجمع على قيمة العقار بعد خصم
          التصفية كما هي، بلا ترجيح ولا خصم، ثم تُقرَّب القيمة الإجمالية مرة واحدة.
        </p>
        <div className="flex flex-col gap-2.5">
          {data.documents.map((doc) => {
            const draft = drafts[doc.attachmentId];
            if (!draft) return null;
            const error = errors[doc.attachmentId];
            return (
              <div
                key={doc.attachmentId}
                className={cn(
                  "rounded-[var(--radius)] border bg-surface-2 px-3 py-2.5",
                  error ? "border-red" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-heading">{doc.labelAr}</div>
                    <div className="text-[10.5px] text-text-3">
                      {doc.missing
                        ? "لم يعد على العقار"
                        : (VALUE_DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status)}
                      {doc.status === "rejected" && doc.reviewNote ? ` — ${doc.reviewNote}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!doc.missing ? (
                      <GhostBtn
                        onClick={() =>
                          requestDocumentPreview({
                            fileName: doc.fileName,
                            title: doc.labelAr,
                            kind: doc.contentType.startsWith("image/") ? "image" : "pdf",
                            attachmentId: doc.attachmentId,
                          })
                        }
                      >
                        معاينة
                      </GhostBtn>
                    ) : null}
                    <select
                      aria-label={`أثر ${doc.labelAr}`}
                      value={draft.effect}
                      disabled={disabled}
                      onChange={(e) =>
                        patch(doc.attachmentId, {
                          effect: e.target.value as ValueDocumentDraft["effect"],
                        })
                      }
                      className={inputClass}
                    >
                      <option value="none">لا يؤثر</option>
                      <option value="indicator" disabled={approaches.length === 0}>
                        مؤشر أسلوب
                      </option>
                      <option value="addition">قيمة تُضاف</option>
                    </select>
                  </div>
                </div>
                {draft.effect !== "none" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {draft.effect === "indicator" ? (
                      <>
                        <select
                          aria-label="الأسلوب"
                          value={draft.approachKey}
                          disabled={disabled}
                          onChange={(e) =>
                            patch(doc.attachmentId, {
                              approachKey: e.target.value as ValueDocumentDraft["approachKey"],
                            })
                          }
                          className={inputClass}
                        >
                          <option value="">— الأسلوب —</option>
                          {approaches.map((a) => (
                            <option key={a.key} value={a.key}>
                              {a.labelAr}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label="الطريقة"
                          value={draft.methodName}
                          disabled={disabled}
                          maxLength={128}
                          placeholder="الطريقة — مثال: الطريقة المتبقية"
                          onChange={(e) => patch(doc.attachmentId, { methodName: e.target.value })}
                          className={cn(inputClass, "min-w-[220px] flex-1")}
                        />
                      </>
                    ) : null}
                    <input
                      aria-label="القيمة"
                      dir="ltr"
                      inputMode="decimal"
                      value={draft.value}
                      disabled={disabled}
                      placeholder="القيمة (ر.س)"
                      onChange={(e) => patch(doc.attachmentId, { value: e.target.value })}
                      className={cn(inputClass, "w-[160px] text-center font-bold")}
                    />
                  </div>
                ) : null}
                {error ? <p className="mt-1.5 mb-0 text-[11px] text-danger-text">{error}</p> : null}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <GhostBtn disabled={disabled || saving || !dirty} onClick={() => void save()}>
            {saving ? "جارٍ الحفظ…" : "حفظ أثر المستندات"}
          </GhostBtn>
          {dirty ? <span className="text-[11px] text-text-3">تغييرات غير محفوظة</span> : null}
          <span className="ms-auto">{uploadButton}</span>
        </div>
      </CardPad>
    </Card>
  );
}
