"use client";

/**
 * «البيانات المهنية» on a user's card: the seat in the valuation report and the
 * Taqeem credentials that the valuers roster prints. Shown for every role; the
 * credentials unfold once the person is given a seat.
 */

import {
  VALUER_MEMBERSHIP_CATEGORIES,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import { RegField, RegSelect } from "@platform/app-shared/registration/FormFields";
import { Badge, Button } from "@platform/ui-kit";
import { pickImage } from "../lib/org-settings-ui";
import { reportSeatLabel } from "../views/users/report-seat-state";
import {
  REPORT_ROLE_OPTIONS,
  type StaffProfessional,
} from "../views/users/users-organization-state";

const CATEGORY_OPTIONS = [
  { value: "", label: "—" },
  ...VALUER_MEMBERSHIP_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];

export function StaffProfessionalFields({
  value,
  onChange,
  disabled,
  unlinkedRows = [],
  hasRow,
}: {
  value: StaffProfessional;
  onChange: (next: StaffProfessional) => void;
  disabled?: boolean;
  /** Roster rows with no account yet; shown only while this card has no row. */
  unlinkedRows?: OrganizationValuerRosterEntry[];
  hasRow: boolean;
}) {
  const certified = value.reportRole === "certified";
  const seated = value.reportRole !== "none";
  const patch = (p: Partial<StaffProfessional>) => onChange({ ...value, ...p });
  const hasSignature = Boolean(value.signatureUrl.trim());

  return (
    <section className="rounded-lg border border-border bg-surface-2 p-3 sm:p-4">
      <h3 className="m-0 mb-3 text-[13px] font-bold text-heading">البيانات المهنية</h3>
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        {!hasRow && unlinkedRows.length > 0 ? (
          <RegSelect
            id="pro-linkRosterRowId"
            label="ربط بصف قائم في سجل المقيّمين"
            options={unlinkedRows.map((r) => ({
              value: r.id,
              label: `${r.nameAr} — ${reportSeatLabel(r.role)}`,
            }))}
            value={value.linkRosterRowId}
            onChange={(v) => {
              const row = unlinkedRows.find((r) => r.id === v);
              onChange(
                row
                  ? {
                      ...value,
                      linkRosterRowId: v,
                      reportRole:
                        row.role === "certified"
                          ? "certified"
                          : row.role === "reviewer" || row.role === "assistant"
                            ? row.role
                            : "valuer",
                      membershipCategory: row.membershipCategory ?? "",
                      membershipNumber: row.membershipNumber ?? "",
                      membershipExpiresAt: row.membershipExpiresAt ?? "",
                      licenseNumber: row.licenseNumber ?? "",
                      licenseIssuedAt: row.licenseIssuedAt ?? "",
                      licenseExpiresAt: row.licenseExpiresAt ?? "",
                      signatureUrl: row.signatureUrl ?? "",
                    }
                  : { ...value, linkRosterRowId: "" },
              );
            }}
            disabled={disabled}
            hint="الصفوف القديمة التي بلا حساب — اختر صف هذا الشخص ليتبع حسابه."
          />
        ) : null}
        {certified ? (
          <RegSelect
            id="pro-reportRole"
            label="الصفة في تقرير التقييم"
            options={[{ value: "certified", label: "مقيّم معتمد" }]}
            value="certified"
            onChange={() => undefined}
            disabled
            hint="المقيّم المعتمد يُختار من «بيانات المنشأة»."
          />
        ) : (
          <RegSelect
            id="pro-reportRole"
            label="الصفة في تقرير التقييم"
            options={REPORT_ROLE_OPTIONS}
            value={value.reportRole}
            onChange={(v) => patch({ reportRole: v as StaffProfessional["reportRole"] })}
            disabled={disabled}
            hint="من له صفة يُطبع في قسم «المشاركون في إعداد التقرير»."
          />
        )}
        {seated ? (
          <>
            <RegSelect
              id="pro-membershipCategory"
              label="فئة العضوية"
              options={CATEGORY_OPTIONS}
              value={value.membershipCategory}
              onChange={(v) => patch({ membershipCategory: v })}
              disabled={disabled}
            />
            <RegField
              id="pro-membershipNumber"
              label="رقم العضوية"
              dir="ltr"
              value={value.membershipNumber}
              onChange={(v) => patch({ membershipNumber: v })}
              readOnly={disabled}
            />
            <RegField
              id="pro-membershipExpiresAt"
              label="سريان العضوية"
              type="date"
              value={value.membershipExpiresAt}
              onChange={(v) => patch({ membershipExpiresAt: v })}
              readOnly={disabled}
            />
            <RegField
              id="pro-licenseNumber"
              label="رقم الترخيص"
              dir="ltr"
              value={value.licenseNumber}
              onChange={(v) => patch({ licenseNumber: v })}
              readOnly={disabled}
            />
            <RegField
              id="pro-licenseIssuedAt"
              label="تاريخ إصدار الترخيص"
              type="date"
              value={value.licenseIssuedAt}
              onChange={(v) => patch({ licenseIssuedAt: v })}
              readOnly={disabled}
            />
            <RegField
              id="pro-licenseExpiresAt"
              label="انتهاء الترخيص"
              type="date"
              value={value.licenseExpiresAt}
              onChange={(v) => patch({ licenseExpiresAt: v })}
              readOnly={disabled}
            />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[12px] font-semibold text-text-2">
                التوقيع{" "}
                <span className="font-normal text-text-3">
                  — يُطبع في التقرير للمقيّم المعتمد فقط
                </span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {hasSignature ? (
                  <Badge tone="success">مرفوع</Badge>
                ) : (
                  <Badge tone="warning">غير مرفوع</Badge>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => pickImage((dataUrl) => patch({ signatureUrl: dataUrl }))}
                >
                  {hasSignature ? "استبدال" : "رفع التوقيع"}
                </Button>
                {hasSignature ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => patch({ signatureUrl: "" })}
                  >
                    إزالة
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
