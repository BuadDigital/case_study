"use client";

import { AppModal, Button } from "@platform/ui-kit";
import { UNSAVED_CONFIRM_MSG } from "./registration-utils";

/** In-app stand-in for `window.confirm(UNSAVED_CONFIRM_MSG)` — stacked above an open form modal. */
export function UnsavedChangesDialog({
  open,
  onStay,
  onLeave,
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <AppModal
      open={open}
      stacked
      title="لم يتم الحفظ"
      onClose={onStay}
      footer={
        <>
          <Button type="button" onClick={onStay}>
            البقاء
          </Button>
          <Button type="button" variant="primary" onClick={onLeave}>
            الخروج دون حفظ
          </Button>
        </>
      }
    >
      <p className="m-0 text-[13px] leading-6 text-text-2">{UNSAVED_CONFIRM_MSG}</p>
    </AppModal>
  );
}
