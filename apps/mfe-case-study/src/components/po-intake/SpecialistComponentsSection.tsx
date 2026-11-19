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
 *
 * Saving (Omar 2026-11-19: «what is حفظ مكونات العقار?»): the text and the table save themselves a
 * pause after each edit, as the inspector's table always did, and one line under the title says
 * where that stands — there is no save button to find, and nothing typed is lost on leaving.
 */
import type { ReactNode } from "react";
import {
  Button,
  FormGroup,
  GentleBusy,
  Label,
  Note,
  Textarea,
  useWorkDensity,
} from "@platform/ui-kit";
import { SPECIALIST_COMPONENTS_TABLE_HINT } from "../../lib/app-data/specialist-components";
import { inventorySaveStatus } from "../../lib/app-data/building-inventory-editor-state";
import { SpecialistComponentsTable } from "./SpecialistComponentsTable";
import { InsReadField } from "./PropertyDetailInspectionFields";
import { useBuildingInventoryEditor } from "./useBuildingInventoryEditor";
import { WorkspaceActors } from "@platform/app-shared/app-data/inspector-workspace-data";

export function SpecialistComponentsSection({
  poNumber,
  propertyId,
  disabled,
  textReadOnly = false,
  inspectorReference,
}: {
  poNumber: string;
  propertyId: string;
  disabled?: boolean;
  /**
   * The table is editable but «مكونات العقار» text is read only: the appraiser edits and adds lines,
   * and the text stays the specialist's (Omar 2026-11-18). The server ignores any text he sends.
   */
  textReadOnly?: boolean;
  /** What the inspector sent (text / photo), shown read-only above the specialist's text. */
  inspectorReference?: ReactNode;
}) {
  const work = useWorkDensity(); // the work page's layout: one label size (Omar 2026-11-09)
  const editor = useBuildingInventoryEditor({
    actor: WorkspaceActors.Specialist,
    poNumber,
    propertyId,
    disabled,
    autosave: true,
  });
  const { lines, loading, loadError, text, error } = editor;

  // Not locked while a save is in the air: the save loop takes edits made meanwhile, and disabling
  // the fields would blur the one being typed in.
  const locked = Boolean(disabled) || Boolean(loadError);
  const saveState = inventorySaveStatus(editor) ?? (error ? null : "محفوظ ✓");

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
      ) : loadError ? (
        <div className="space-y-2">
          <Note tone="warn">{loadError}</Note>
          <Button type="button" size="sm" onClick={() => void editor.reload()}>
            إعادة المحاولة
          </Button>
        </div>
      ) : (
        <>
          {disabled || textReadOnly ? (
            <InsReadField label="مكونات العقار (تُطبع في التقرير)" value={text} multiline />
          ) : (
            <FormGroup>
              <Label
                htmlFor={`components-text-${propertyId}`}
                className={work ? "text-[11px] font-semibold text-text-2" : "text-[12px] font-semibold"}
              >
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

          <div id="specialist-components-table" className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="m-0 text-[12px] font-bold text-heading">جدول الحصر</p>
              {!disabled && saveState ? (
                <span className="text-[11px] text-text-3" role="status">
                  {saveState} — يُحفظ تلقائياً
                </span>
              ) : null}
            </div>
            {disabled ? null : (
              <>
                <p className="m-0 text-[11px] leading-relaxed text-text-3">
                  المباني والملاحق والأسوار في العقار بمساحاتها — يعبّئه المعاين وتصحّحه هنا، ويُطبع في التقرير.
                </p>
                <details className="text-[11px] text-text-3">
                  <summary className="w-fit cursor-pointer text-text-2">متى يُعبّأ؟</summary>
                  <p className="m-0 mt-1 leading-relaxed">
                    {SPECIALIST_COMPONENTS_TABLE_HINT} والمقيّم يقرّر هل يدخل في القيمة.
                  </p>
                </details>
              </>
            )}

            {lines.length > 0 ? (
              <SpecialistComponentsTable
                lines={lines}
                disabled={locked}
                readView={Boolean(disabled)}
                rowKey={editor.rowKey}
                onPatch={editor.patchLine}
                onRemove={editor.removeLine}
              />
            ) : disabled ? (
              <p className="m-0 text-[12px] text-text-3">لا توجد بنود.</p>
            ) : (
              <div className="rounded-lg border border-dashed border-border-md px-4 py-4 text-center">
                <p className="m-0 mb-2 text-[12px] text-text-2">لم يُضَف أي مبنى أو ملحق بعد.</p>
                <Button type="button" size="sm" variant="outline" onClick={editor.addLine}>
                  إضافة أول مبنى أو ملحق
                </Button>
              </div>
            )}

            {!disabled && lines.length > 0 ? (
              <Button type="button" size="sm" variant="outline" disabled={locked} onClick={editor.addLine}>
                إضافة مبنى أو ملحق
              </Button>
            ) : null}
          </div>

          {error ? <Note tone="warn">{error}</Note> : null}
        </>
      )}
    </div>
  );
}
