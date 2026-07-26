"use client";

import { useMemo } from "react";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { Badge } from "@platform/design-system";

function statusTone(status: string | undefined): "success" | "danger" | "default" {
  if (status === "Active") return "success";
  if (status === "Inactive") return "danger";
  return "default";
}

function statusLabel(status: string | undefined): string {
  if (status === "Active") return "فعّال";
  if (status === "Inactive") return "معطّل";
  return status || "—";
}

function typeLabel(type: StaffUser["type"]): string {
  if (type === "internal") return "داخلي";
  if (type === "freelance") return "متعاون";
  return "خارجي";
}

function ProfileField({
  label,
  value,
  dir,
}: {
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="text-[11px] font-medium text-text-3">{label}</div>
      <div className="mt-1 text-[13px] font-semibold text-text" dir={dir}>
        {value || "—"}
      </div>
    </div>
  );
}

export function UserProfileContent({ user }: { user: StaffUser }) {
  const detailSections = useMemo(() => {
    const map = new Map<string, { label: string; value: string }[]>();
    for (const field of user.details ?? []) {
      const list = map.get(field.section) ?? [];
      list.push({ label: field.label, value: field.value });
      map.set(field.section, list);
    }
    return [...map.entries()];
  }, [user.details]);

  return (
    <div className="space-y-4 max-lg:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 max-lg:rounded-[12px] max-lg:bg-surface-2 max-lg:px-3.5 max-lg:py-3">
        <div className="min-w-0">
          <h2 className="m-0 text-[18px] font-extrabold text-heading max-lg:text-[17px]">
            {user.name}
          </h2>
          <p className="m-0 mt-1 text-[13px] text-text-3">{user.role || "—"}</p>
        </div>
        <Badge tone={statusTone(user.status)} dot>
          {statusLabel(user.status)}
        </Badge>
      </div>

      <section>
        <h3 className="m-0 mb-3 text-[13px] font-bold text-heading">
          البيانات الأساسية
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 max-lg:gap-2.5">
          <ProfileField label="الاسم" value={user.name} />
          <ProfileField label="الدور / المسمى" value={user.role} />
          <ProfileField label="البريد الإلكتروني" value={user.email} dir="ltr" />
          <ProfileField label="نوع العقد" value={typeLabel(user.type)} />
          {user.phone ? (
            <ProfileField label="الجوال" value={user.phone} dir="ltr" />
          ) : null}
          {user.distributionAssigneeId ? (
            <ProfileField
              label="معرّف التوزيع"
              value={user.distributionAssigneeId}
              dir="ltr"
            />
          ) : null}
        </div>
        {user.reviewerCityCoverage && user.reviewerCityCoverage.length > 0 ? (
          <div className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
            <div className="text-[11px] font-medium text-text-3">
              نطاق المدن (مراجع حكومي)
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {user.reviewerCityCoverage.map((city) => (
                <Badge key={city} tone="info">
                  {city}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {detailSections.map(([section, fields]) => (
        <section key={section}>
          <h3 className="m-0 mb-3 text-[13px] font-bold text-heading">{section}</h3>
          <div className="grid gap-3 sm:grid-cols-2 max-lg:gap-2.5">
            {fields.map((field) => (
              <ProfileField
                key={`${section}-${field.label}`}
                label={field.label}
                value={field.value}
                dir={
                  /إيميل|بريد|جوال|هوية|عضوية|مستخدم|معرّف/i.test(field.label)
                    ? "ltr"
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
