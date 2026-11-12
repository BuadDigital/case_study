"use client";

import { useState } from "react";
import {
  AppModal,
  Button,
  Label,
  Note,
  Select,
  Textarea,
  cn,
  useToast,
} from "@platform/ui-kit";
import {
  PROPERTY_CLASSIFICATIONS,
  propertyTypesForClassification,
  propertyUsageValue,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { InspectorPropertyUsageField } from "../field-inspection/InspectorPropertyUsageField";
import { correctInspectedTypeOfWorkspace } from "../../lib/app-data/inspector-workspace-commands";
import {
  inspectedTypeChanged,
  inspectedTypeCrossingNote,
  mapInspectedTypeFieldErrors,
  planInspectedTypeCorrection,
} from "../../lib/app-data/inspected-type-correction";

type Props = {
  /** The field-inspection task whose submitted package holds the type. */
  inspectionTaskId: string;
  /** The type the inspection states now («الأصل محل التقييم»). */
  currentType: string;
  /** «استخدام العقار» as the inspection states it now. */
  currentUsage: string;
  /** The bourse type — shown beside the current one when they differ. */
  bourseType: string;
  /** The viewer may change them (staff who correct the inspector's package, before review approves). */
  canCorrect: boolean;
  /** Called after a saved change, so the host reloads the inspection. */
  onCorrected?: () => void;
};

/**
 * The property's type and usage as the inspection states them, with «تعديل النوع والاستخدام» for
 * case staff (Omar 2026-11-12: the study specialist changes the type too, not only the inspector).
 *
 * How it works: one line — the type (and the bourse type when it differs) and the usage; the button
 * opens `InspectedTypeDialog`. The line replaces the old «النوع المبدئي · النوع المعتمد ميدانياً» note.
 * Edge cases: without the right (or once review approved the study) the line only reads.
 */
export function InspectedTypeCorrection({
  inspectionTaskId,
  currentType,
  currentUsage,
  bourseType,
  canCorrect,
  onCorrected,
}: Props) {
  const [open, setOpen] = useState(false);
  const type = currentType.trim();
  const usage = propertyUsageValue(currentUsage);
  const bourse = bourseType.trim();
  const differs = Boolean(type) && type !== bourse;

  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2 text-[12.5px]",
        differs
          ? "border-[color-mix(in_srgb,var(--amber)_40%,var(--border))] bg-warning-bg text-amber-text"
          : "border-border bg-surface-2/50 text-text-2",
      )}
    >
      <span>
        نوع العقار: <strong className="font-bold text-heading">{type || "—"}</strong>
      </span>
      {differs ? <span>النوع في البورصة: {bourse || "—"}</span> : null}
      <span>
        استخدام العقار: <strong className="font-bold text-heading">{usage || "—"}</strong>
      </span>
      {canCorrect ? (
        <Button
          type="button"
          size="sm"
          className="ms-auto"
          showActionToast={false}
          onClick={() => setOpen(true)}
        >
          تعديل النوع والاستخدام
        </Button>
      ) : null}
      {open ? (
        <InspectedTypeDialog
          inspectionTaskId={inspectionTaskId}
          currentType={type}
          currentUsage={usage}
          onClose={() => setOpen(false)}
          onCorrected={onCorrected}
        />
      ) : null}
    </div>
  );
}

/**
 * «تعديل النوع والاستخدام»: the type from the system's list, the usage, and the reason a new type needs.
 *
 * How it works: the form starts on the current values; `planInspectedTypeCorrection` checks it and
 * builds the request (only what changed); the server's field errors land on their fields. A change
 * between land and a built type says first what happens to the inspector's building answers.
 * Edge cases: nothing changed → the dialog just closes; a type saved under an older list stays
 * selectable as the current value; the reason box shows only while the type differs.
 */
function InspectedTypeDialog({
  inspectionTaskId,
  currentType,
  currentUsage,
  onClose,
  onCorrected,
}: Pick<Props, "inspectionTaskId" | "currentType" | "currentUsage" | "onCorrected"> & {
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [nextType, setNextType] = useState(currentType);
  const [nextUsage, setNextUsage] = useState(currentUsage);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof mapInspectedTypeFieldErrors>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const typeChanged = inspectedTypeChanged(currentType, nextType);
  const crossingNote = inspectedTypeCrossingNote(currentType, nextType);
  const listed = PROPERTY_CLASSIFICATIONS.some((c) =>
    propertyTypesForClassification(c).includes(currentType),
  );

  async function save() {
    if (busy) return;
    setServerError(null);
    const plan = planInspectedTypeCorrection({
      currentType,
      currentUsage,
      nextType,
      nextUsage,
      reason,
    });
    if (!plan.ok) {
      setFieldErrors({ [plan.field]: plan.error });
      return;
    }
    setFieldErrors({});
    if (!plan.request) {
      onClose();
      return;
    }
    setBusy(true);
    const saved = await correctInspectedTypeOfWorkspace(inspectionTaskId, plan.request);
    setBusy(false);
    if (!saved.ok) {
      const mapped = mapInspectedTypeFieldErrors(saved.errors);
      setFieldErrors(mapped);
      setServerError(
        mapped.propertyType || mapped.propertyUsage || mapped.reason ? null : saved.error,
      );
      return;
    }
    showToast(
      plan.request.propertyType ? "تم تعديل نوع العقار" : "تم تعديل استخدام العقار",
      "success",
    );
    onCorrected?.();
    onClose();
  }

  return (
    <AppModal
      open
      title="تعديل النوع والاستخدام"
      subtitle="يظهر النوع الجديد في القوائم وتقرير التقييم، ويُسجَّل التعديل وسببه في الجدول الزمني. يبقى نوع البورصة محفوظًا للسجل."
      onClose={onClose}
      maxWidthPx={520}
      look="ops-html"
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <Button variant="default" showActionToast={false} disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" showActionToast={false} loading={busy} onClick={() => void save()}>
            حفظ التعديل
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="inspected-type-select" className="mb-1.5 text-[11px] font-semibold text-text-2">
            نوع العقار
          </Label>
          <Select
            id="inspected-type-select"
            value={nextType}
            aria-invalid={fieldErrors.propertyType ? true : undefined}
            hasError={Boolean(fieldErrors.propertyType)}
            onChange={(e) => {
              setNextType(e.target.value);
              setFieldErrors((errors) => ({ ...errors, propertyType: undefined }));
            }}
          >
            {currentType && !listed ? <option value={currentType}>{currentType}</option> : null}
            {PROPERTY_CLASSIFICATIONS.map((classification) => (
              <optgroup key={classification} label={classification}>
                {propertyTypesForClassification(classification).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          {fieldErrors.propertyType ? (
            <Note tone="danger" className="mt-2">
              {fieldErrors.propertyType}
            </Note>
          ) : null}
          {crossingNote ? (
            <Note tone="warn" className="mt-2">
              {crossingNote}
            </Note>
          ) : null}
        </div>

        {typeChanged ? (
          <div>
            <Label htmlFor="inspected-type-reason" className="mb-1.5 text-[11px] font-semibold text-text-2">
              سبب تعديل النوع (10 أحرف على الأقل) <span className="text-danger-text">*</span>
            </Label>
            <Textarea
              id="inspected-type-reason"
              rows={2}
              value={reason}
              placeholder="لماذا يختلف النوع عمّا سجّله المعاين؟"
              aria-invalid={fieldErrors.reason ? true : undefined}
              hasError={Boolean(fieldErrors.reason)}
              onChange={(e) => {
                setReason(e.target.value);
                setFieldErrors((errors) => ({ ...errors, reason: undefined }));
              }}
            />
            {fieldErrors.reason ? (
              <Note tone="danger" className="mt-2">
                {fieldErrors.reason}
              </Note>
            ) : null}
          </div>
        ) : null}

        <div>
          <Label htmlFor="inspected-usage-field" className="mb-1.5 text-[11px] font-semibold text-text-2">
            استخدام العقار
          </Label>
          <InspectorPropertyUsageField
            id="inspected-usage-field"
            value={nextUsage}
            invalid={Boolean(fieldErrors.propertyUsage)}
            onChange={(next) => {
              setNextUsage(next);
              setFieldErrors((errors) => ({ ...errors, propertyUsage: undefined }));
            }}
          />
          {fieldErrors.propertyUsage ? (
            <Note tone="danger" className="mt-2">
              {fieldErrors.propertyUsage}
            </Note>
          ) : null}
        </div>

        {serverError ? <Note tone="warn">{serverError}</Note> : null}
      </div>
    </AppModal>
  );
}
