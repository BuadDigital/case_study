"use client";

import { Button } from "@platform/design-system";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import {
  registrationSuccessLabel,
  type RegistrationFormData,
} from "../prototype/map-registration-to-staff";
import type { RegistrationSource } from "../prototype/registration-data";

export function RegistrationSuccess({
  source,
  data,
  user,
  onBackToList,
  onAddAnother,
}: {
  source: RegistrationSource;
  data: RegistrationFormData;
  user: StaffUser;
  onBackToList: () => void;
  onAddAnother: () => void;
}) {
  const typeLabel = registrationSuccessLabel(source, data);
  const username =
    data.hr_username || data.pc_username || data.crm_username || "—";

  return (
    <div className="w-full max-w-[480px] px-4 py-8 text-center sm:px-6 sm:py-10">
      <div
        className="relative mx-auto mb-4 h-[60px] w-[60px] rounded-full border-2 border-success bg-success-bg after:absolute after:left-1/2 after:top-[46%] after:h-[18px] after:w-[10px] after:-translate-x-1/2 after:rotate-45 after:border-b-[3px] after:border-r-[3px] after:border-solid after:border-success"
        aria-hidden
      />
      <h2 className="mb-2 text-lg font-bold text-text">
        تم إنشاء الحساب بنجاح
      </h2>
      <p className="mb-4 text-[13px] text-text-2">
        تمت إضافة «{user.name}» إلى قائمة المستخدمين.
      </p>
      <div className="mb-4 rounded border border-border bg-surface-2 p-4 text-start text-sm text-text-2">
        <div className="py-1">
          الاسم: <strong className="text-text">{user.name}</strong>
        </div>
        <div className="py-1">
          النوع: <strong className="text-text">{typeLabel}</strong>
        </div>
        <div className="py-1">
          البريد: <strong className="text-text">{user.email}</strong>
        </div>
        <div className="py-1">
          اسم المستخدم: <strong className="text-text">{username}</strong>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="primary" onClick={onBackToList}>
          العودة للقائمة
        </Button>
        <Button type="button" onClick={onAddAnother}>
          + تسجيل مستخدم آخر
        </Button>
      </div>
    </div>
  );
}
