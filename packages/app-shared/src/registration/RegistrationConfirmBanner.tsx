"use client";

import { Note } from "@platform/design-system";

export function RegistrationConfirmBanner() {
  return (
    <Note tone="info" className="mx-5 mb-2 mt-0 border border-border">
      <strong className="mb-0.5 block text-xs text-info-text">تأكيد الحفظ</strong>
      <p className="m-0 text-[11px] leading-snug text-text-2">
        راجع البيانات أعلاه، ثم اضغط «تأكيد الحفظ» لإنشاء الحساب.
      </p>
    </Note>
  );
}
