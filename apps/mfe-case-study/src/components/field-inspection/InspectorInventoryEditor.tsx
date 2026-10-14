"use client";

/**
 * The «جدول الحصر» editor itself — the lines, the add button, the save status and the empty
 * warning, without any card chrome. Both inspector surfaces mount it so the table is the same
 * on either device: the phone card (`InspectorInventoryCard`) and step 2 of the desktop
 * wizard (`InspectorWorkspaceWizard`). Saves itself a pause after typing and queues on the
 * device when offline; the queued save is replayed before the inspection's submit.
 */
import { useEffect } from "react";
import { Button, GentleBusy, Note } from "@platform/ui-kit";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import {
  inspectorInventoryWarning,
  inventorySaveStatus,
} from "../../lib/app-data/building-inventory-editor-state";
import { inspectionHasStructures } from "../../lib/app-data/specialist-components";
import { SpecialistComponentsTable } from "../po-intake/SpecialistComponentsTable";
import { useBuildingInventoryEditor } from "../po-intake/useBuildingInventoryEditor";
import { InspectorInventoryLineCards } from "./InspectorInventoryLineCards";
import { registerInspectorInventoryFlusher } from "./inspector-inventory-flush";

export function InspectorInventoryEditor({
  draft,
  mobile,
  poNumber,
  propertyId,
  taskId,
  workLocked,
}: {
  draft: Pick<InspectorWorkspaceDraft, "featureValues" | "landHasValuableStructures">;
  /** Phone layout stacks the lines as cards; the desktop wizard shows the table. */
  mobile: boolean;
  poNumber: string;
  propertyId: string;
  taskId: string;
  workLocked: boolean;
}) {
  const editor = useBuildingInventoryEditor({
    actor: "inspector",
    poNumber,
    propertyId,
    taskId,
    disabled: workLocked,
  });
  const { flush } = editor;

  // The workflow awaits this before the inspection is submitted.
  useEffect(
    () =>
      registerInspectorInventoryFlusher(async () => {
        await flush();
      }),
    [flush],
  );

  const locked = workLocked || editor.saving || Boolean(editor.loadError);
  const status = inventorySaveStatus(editor);
  const warning = inspectorInventoryWarning({
    hasStructures: inspectionHasStructures({
      assetSubject: draft.featureValues.assetSubject,
      landHasValuableStructures: draft.landHasValuableStructures,
    }),
    lines: editor.lines,
    loading: editor.loading || Boolean(editor.loadError) || workLocked,
  });

  return (
    <div id="inspector-inventory" className="space-y-3">
      <p className="m-0 text-[11px] leading-relaxed text-text-2">
        اكتب كل مبنى أو ملحق أو سور في العقار بمساحته (الدور الأرضي، ملحق علوي، غرفة حارس…).
        إلزامي لكل عقار فيه مبانٍ أو ملاحق تستحق التقييم. يُحفظ تلقائياً، وبلا اتصال يُرسل عند عودته.
      </p>

      {editor.loading ? (
        <GentleBusy>
          <p className="text-[12px] text-text-2">جاري التحميل…</p>
        </GentleBusy>
      ) : editor.loadError ? (
        <div className="space-y-2">
          <Note tone="warn">{editor.loadError}</Note>
          <Button type="button" size="sm" onClick={() => void editor.reload()}>
            إعادة المحاولة
          </Button>
        </div>
      ) : (
        <>
          {editor.lines.length === 0 ? (
            <p className="m-0 text-[12px] text-text-3">لا توجد بنود بعد.</p>
          ) : mobile ? (
            <InspectorInventoryLineCards
              lines={editor.lines}
              disabled={locked}
              onPatch={editor.patchLine}
              onRemove={editor.removeLine}
            />
          ) : (
            <SpecialistComponentsTable
              lines={editor.lines}
              disabled={locked}
              onPatch={editor.patchLine}
              onRemove={editor.removeLine}
            />
          )}

          {!workLocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" disabled={locked} onClick={editor.addLine}>
                إضافة بند
              </Button>
              {status ? (
                <span className="text-[11px] text-text-3" role="status">
                  {status}
                </span>
              ) : null}
            </div>
          ) : null}

          {warning ? <Note tone="warn">{warning}</Note> : null}
          {editor.error ? <Note tone="warn">{editor.error}</Note> : null}
        </>
      )}
    </div>
  );
}
