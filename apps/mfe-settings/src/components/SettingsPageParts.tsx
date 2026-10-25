/** Page chrome shared by the settings screens: loading shell, access notes and the save bar. */

import { Button, Note, PageLoadingHint, PageShell } from "@platform/ui-kit";

/** The full-page spinner a settings screen shows while its data loads. */
export function SettingsLoadingShell() {
  return (
    <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
      <PageLoadingHint className="py-20" />
    </PageShell>
  );
}

/** The notes at the top of a settings screen: no-permission warning, then the load error. */
export function SettingsAccessNotes({
  canEdit,
  error,
}: {
  canEdit: boolean;
  error: string | null | undefined;
}) {
  return (
    <>
      {!canEdit ? (
        <Note tone="warn" className="mb-3 max-w-[560px]">
          الرابط صحيح، لكن دورك الحالي لا يملك صلاحية هذا البند. اطلب الصلاحية من مسؤول النظام.
        </Note>
      ) : null}
      {error ? <Note tone="warn">{error}</Note> : null}
    </>
  );
}

/** The «حفظ» bar at the bottom of an editable settings screen, with the unsaved-change mark. */
export function SettingsSaveBar({
  dirty,
  saving,
  onSave,
  buttonClassName,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  buttonClassName?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
      {dirty ? (
        <span className="flex items-center gap-1.5 text-[11.5px] text-amber-text">
          <span className="size-1.5 rounded-full bg-warning" />
          تعديل غير محفوظ
        </span>
      ) : null}
      <Button variant="primary" className={buttonClassName} loading={saving} onClick={onSave}>
        حفظ
      </Button>
    </div>
  );
}
