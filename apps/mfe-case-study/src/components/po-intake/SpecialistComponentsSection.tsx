"use client";

/**
 * «مكونات العقار» — the case specialist's part of the property description:
 * the report text (written from what the inspector sent: text or a photographed sheet) and
 * the components table «جدول الحصر». The table is filled by the field inspector (he writes it
 * on site, offline too); the specialist reviews and corrects it here. It is always listed and
 * printed when filled, and mandatory — at least one line — for anything with buildings or
 * annexes worth valuing before accepting (a land asset only when the inspector said it holds
 * such structures). Whether the
 * components are valued is the appraiser's scope choice. The report text is the specialist's
 * own and is required before accepting.
 */
import type { ReactNode } from "react";
import {
  Button,
  FormGroup,
  GentleBusy,
  Label,
  Note,
  Textarea,
  useToast,
} from "@platform/ui-kit";
import { SPECIALIST_COMPONENTS_TABLE_HINT } from "../../lib/app-data/specialist-components";
import { SpecialistComponentsTable } from "./SpecialistComponentsTable";
import { InsReadField } from "./PropertyDetailInspectionFields";
import { useBuildingInventoryEditor } from "./useBuildingInventoryEditor";

export function SpecialistComponentsSection({
  poNumber,
  propertyId,
  disabled,
  inspectorReference,
  onSaved,
}: {
  poNumber: string;
  propertyId: string;
  disabled?: boolean;
  /** What the inspector sent (text / photo), shown read-only above the specialist's text. */
  inspectorReference?: ReactNode;
  onSaved?: () => void;
}) {
  const { showToast } = useToast();
  const editor = useBuildingInventoryEditor({
    actor: "specialist",
    poNumber,
    propertyId,
    disabled,
    autosave: false,
  });
  const { lines, loading, loadError, text, saving, dirty, error } = editor;

  const locked = Boolean(disabled) || saving || Boolean(loadError);

  async function save() {
    if (disabled) return;
    const outcome = await editor.save();
    if (!outcome.ok) {
      if (outcome.message) showToast(outcome.message, "error");
      return;
    }
    showToast("تم حفظ مكونات العقار", "success");
    onSaved?.();
  }

  if (!propertyId) return null;

  return (
    <div id="specialist-components" className="space-y-3">
      {inspectorReference ? (
        <div className="rounded-lg border border-border bg-surface-2/60 p-3">
          <p className="m-0 mb-2 text-[11px] font-semibold text-text-2">
            ما أرسله المعاين (للمرجعية — لا يُطبع)
          </p>
          {inspectorReference}
        </div>
      ) : null}

      {loading ? (
        <GentleBusy>
          <p className="text-[12px] text-text-2">جاري التحميل…</p>
        </GentleBusy>
      ) : (
        <>
          {disabled ? (
            <InsReadField label="مكونات العقار (تُطبع في التقرير)" value={text} multiline />
          ) : (
            <FormGroup>
              <Label htmlFor={`components-text-${propertyId}`} className="text-[12px] font-semibold">
                مكونات العقار (تُطبع في التقرير)
              </Label>
              <p className="m-0 mb-1.5 text-[11px] text-text-3">
                نسّق وصف المعاين هنا، أو اكتبه من الصورة إذا أرسل صورة فقط.
              </p>
              <Textarea
                id={`components-text-${propertyId}`}
                rows={5}
                disabled={locked}
                value={text}
                onChange={(e) => editor.setText(e.target.value)}
                className="min-h-[110px] resize-y text-[13px]"
              />
            </FormGroup>
          )}

          <div id="specialist-components-table">
            <p className="m-0 text-[12px] font-bold text-heading">جدول الحصر</p>
            {disabled ? null : (
              <p className="m-0 mt-0.5 text-[11px] text-text-3">
                يعبّئه المعاين من الموقع (أدوار، ملاحق، سور…) وتراجعه وتصحّحه هنا.{" "}
                {SPECIALIST_COMPONENTS_TABLE_HINT} يُطبع في التقرير، والمقيّم يقرّر هل يدخل في
                القيمة.
              </p>
            )}
          </div>
          {lines.length > 0 ? (
            <SpecialistComponentsTable
              lines={lines}
              disabled={locked}
              readView={Boolean(disabled)}
              onPatch={editor.patchLine}
              onRemove={editor.removeLine}
            />
          ) : (
            <p className="m-0 text-[12px] text-text-3">{disabled ? "لا توجد بنود." : "لا توجد بنود بعد."}</p>
          )}

          {!disabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" disabled={locked} onClick={editor.addLine}>
                إضافة بند
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={saving}
                disabled={locked}
                onClick={() => void save()}
              >
                حفظ مكونات العقار
              </Button>
              {dirty ? <span className="text-[11px] text-warn-text">تعديلات غير محفوظة</span> : null}
            </div>
          ) : null}

          {error || loadError ? <Note tone="warn">{error ?? loadError}</Note> : null}
        </>
      )}
    </div>
  );
}
