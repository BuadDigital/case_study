"use client";

import { useState } from "react";
import { AppModal, Button, useToast } from "@platform/ui-kit";
import { RegField } from "@platform/app-shared/registration/FormFields";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import {
  saveIntakeQuickFill,
  type IntakeQuickFillField,
  type IntakeQuickFillFieldKey,
} from "@platform/app-shared/app-data/intake-field-gap-quick-fill";

/**
 * Opened from a «missing field» notification for one of the short list of simple, ungated
 * intake fields — lets the notified specialist type the value in and save it directly,
 * instead of opening the full PO intake screen for a single-field fix.
 */
export function IntakeFieldGapQuickFillDialog({
  field,
  poNumber,
  propertyId,
  onClose,
  onSaved,
}: {
  field: IntakeQuickFillField;
  poNumber: string;
  propertyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const config = apiConfig();
    if (!config) {
      setError("انتهت الجلسة — سجّل الدخول من جديد ثم أعد المحاولة");
      return;
    }
    const patch: Partial<Record<IntakeQuickFillFieldKey, string>> = {};
    for (const input of field.inputs) {
      const value = (values[input.key] ?? "").trim();
      if (!value) {
        setError(`أدخل ${input.label}`);
        return;
      }
      patch[input.key] = value;
    }

    setSaving(true);
    setError(null);
    const result = await saveIntakeQuickFill(config, poNumber, propertyId, patch);
    setSaving(false);
    if (!result.ok) {
      setError(
        result.kind === "validation"
          ? (Object.values(result.errors ?? {})[0]?.trim() ?? "تعذّر الحفظ")
          : result.kind === "auth"
            ? "انتهت الجلسة — سجّل الدخول من جديد ثم أعد المحاولة"
            : result.kind === "not_found"
              ? "تعذّر إيجاد العقار — قد يكون حُذف من أمر العمل"
              : "تعذّر الحفظ — أعد المحاولة",
      );
      return;
    }
    showToast(`تم حفظ «${field.label}»`, "success");
    onSaved();
  }

  return (
    <AppModal
      open
      title={`إدخال «${field.label}»`}
      subtitle="يُحفظ مباشرة على العقار — بدون فتح شاشة بيانات إنفاذ الكاملة."
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            showActionToast={false}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "جاري الحفظ…" : "حفظ"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        {error ? (
          <p className="m-0 text-[11.5px] text-danger-text" role="alert">
            {error}
          </p>
        ) : null}
        {field.inputs.map((input) => (
          <RegField
            key={input.key}
            id={`quick-fill-${input.key}`}
            label={input.label}
            type={input.type === "date" ? "date" : undefined}
            dir={input.type === "date" ? "ltr" : undefined}
            value={values[input.key] ?? ""}
            onChange={(v) =>
              setValues((prev) => ({ ...prev, [input.key]: v }))
            }
          />
        ))}
      </div>
    </AppModal>
  );
}
