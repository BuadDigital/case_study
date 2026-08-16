"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listInspectorFees,
  type InspectorFeeRowDto,
} from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { supervisingDepartmentLabel } from "@platform/app-shared/users/admin-staff-roles";
import { getAuthSession } from "@platform/auth-client";
import { Badge, Spinner, Table, TBody, Td, Th, THead, Tr } from "@platform/design-system";
import { PartyOfficeBillingStatementsPanel } from "@case-study/mfe/components/fees/PartyOfficeBillingStatementsPanel";
import { ProfileInspectorDuesPanel } from "./ProfileInspectorDuesPanel";

type ProfileTab =
  | "basic"
  | "login"
  | "activity"
  | "eng_statements"
  | "inspector_dues"
  | "financial";

function statusTone(status: string | undefined): "success" | "danger" | "default" {
  if (status === "Active") return "success";
  if (status === "Disabled" || status === "Locked") return "danger";
  return "default";
}

function statusLabel(status: string | undefined): string {
  if (status === "Active") return "فعّال";
  if (status === "Disabled") return "معطّل";
  if (status === "PendingActivation") return "بانتظار التفعيل";
  if (status === "Locked") return "مقفول";
  return status || "—";
}

function typeLabel(type: StaffUser["type"]): string {
  if (type === "internal") return "داخلي";
  if (type === "freelance") return "متعاون";
  return "خارجي";
}

/** حساب مكتب هندسي — تظهر له تبويبة مسيرات الصرف */
function isEngineeringOfficeProfile(user: StaffUser): boolean {
  if ((user.roleId ?? "").trim() === "engineering-office") return true;
  if ((user.distributionAssigneeId ?? "").trim().toLowerCase().startsWith("eo-"))
    return true;
  if ((user.role ?? "").trim() === "مقدم خدمة — جهة") return true;
  if (/مكتب.*مساح|مقدم خدمة\s*[—\-]\s*جهة/i.test(user.role ?? "")) return true;
  return (user.details ?? []).some((d) =>
    /engineering-office/i.test(d.value),
  );
}

/** حساب معاين ميداني — تظهر له تبويبة المستحقات */
function isFieldInspectorProfile(user: StaffUser): boolean {
  if ((user.roleId ?? "").trim() === "field-inspector") return true;
  const assignee = (user.distributionAssigneeId ?? "").trim().toLowerCase();
  if (assignee.startsWith("fi-")) return true;
  if ((user.role ?? "").trim() === "معاين ميداني") return true;
  if (user.inspectorType === "employee" || user.inspectorType === "contractor")
    return true;
  return (user.details ?? []).some((d) =>
    /field-inspector/i.test(d.value),
  );
}

function formatAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
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
    <div className="rounded-[var(--radius)] border border-border bg-surface-2/60 px-3 py-2.5">
      <div className="text-[11px] font-medium text-text-3">{label}</div>
      <div className="mt-1 text-[13px] font-semibold text-heading" dir={dir}>
        {value || "—"}
      </div>
    </div>
  );
}

function completedRows(rows: InspectorFeeRowDto[]): InspectorFeeRowDto[] {
  return rows.filter(
    (row) =>
      row.workStatus === "done" ||
      row.billingStatus === "disbursed" ||
      row.billingStatus === "at-finance" ||
      row.billingStatus === "in-statement" ||
      row.billingStatus === "disb-req",
  );
}

export function UserProfileContent({ user }: { user: StaffUser }) {
  const showFinancial = Boolean(user.hasCompensation);
  const showEngStatements = isEngineeringOfficeProfile(user);
  const showInspectorDues = isFieldInspectorProfile(user);
  const [tab, setTab] = useState<ProfileTab>("basic");
  const [feeRows, setFeeRows] = useState<InspectorFeeRowDto[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesFailed, setFeesFailed] = useState(false);

  const detailSections = useMemo(() => {
    const map = new Map<string, { label: string; value: string }[]>();
    for (const field of user.details ?? []) {
      const list = map.get(field.section) ?? [];
      list.push({ label: field.label, value: field.value });
      map.set(field.section, list);
    }
    return [...map.entries()];
  }, [user.details]);

  const tabs = useMemo(() => {
    const items: { id: ProfileTab; label: string }[] = [
      { id: "basic", label: "البيانات الأساسية" },
      { id: "login", label: "بيانات الدخول" },
      { id: "activity", label: "سجل الأعمال" },
    ];
    // بجانب سجل الأعمال — مسيرات المكتب / مستحقات المعاين
    if (showEngStatements) {
      items.push({ id: "eng_statements", label: "مسيرات الصرف" });
    }
    if (showInspectorDues) {
      items.push({ id: "inspector_dues", label: "المستحقات" });
    }
    if (showFinancial) items.push({ id: "financial", label: "المالية" });
    return items;
  }, [showEngStatements, showInspectorDues, showFinancial]);

  useEffect(() => {
    if (tab === "eng_statements" && !showEngStatements) setTab("basic");
    if (tab === "inspector_dues" && !showInspectorDues) setTab("basic");
    if (tab === "financial" && !showFinancial) setTab("basic");
  }, [tab, showEngStatements, showInspectorDues, showFinancial]);

  useEffect(() => {
    if (tab !== "activity" && tab !== "financial") return;
    const token = getAuthSession()?.token;
    if (!token) return;
    let cancelled = false;
    setFeesLoading(true);
    setFeesFailed(false);
    void listInspectorFees(
      { token },
      user.distributionAssigneeId
        ? { assigneeId: user.distributionAssigneeId }
        : {},
    ).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setFeesFailed(true);
        setFeeRows([]);
      } else {
        const rows = user.distributionAssigneeId
          ? result.data.rows
          : result.data.rows.filter(
              (row) =>
                row.assigneeId &&
                (row.assigneeId === user.id ||
                  row.assigneeId === user.distributionAssigneeId),
            );
        setFeeRows(rows);
      }
      setFeesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, user.distributionAssigneeId, user.id]);

  const activityRows = useMemo(() => completedRows(feeRows), [feeRows]);

  const financialSummary = useMemo(() => {
    let due = 0;
    let paid = 0;
    let suspended = 0;
    for (const row of feeRows) {
      const paidAmt = row.paidAmountSar > 0 ? row.paidAmountSar : 0;
      const net = row.netFeeSar;
      if (row.billingStatus === "disbursed" || paidAmt > 0) {
        paid += paidAmt > 0 ? paidAmt : net;
      } else if (row.billingStatus === "suspended") {
        suspended += net;
      } else {
        due += net;
      }
    }
    return { due, paid, suspended, remaining: Math.max(0, due) };
  }, [feeRows]);

  return (
    <div className="space-y-4 max-lg:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius)] border border-border bg-surface-2/40 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-12 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white"
            >
              {user.name.trim().slice(0, 2) || "؟"}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="m-0 text-[17px] font-extrabold text-heading">
              {user.name}
            </h2>
            <p className="m-0 mt-1 text-[13px] text-text-3">{user.role || "—"}</p>
          </div>
        </div>
        <Badge tone={statusTone(user.status)} dot>
          {statusLabel(user.status)}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2.5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              tab === item.id
                ? "bg-ink text-white"
                : "bg-surface-2 text-text-2 hover:border-border-md hover:text-heading"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "basic" ? (
        <>
          <section>
            <h3 className="m-0 mb-3 text-[13px] font-bold text-heading">
              البيانات الأساسية
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 max-lg:gap-2.5">
              <ProfileField label="الاسم" value={user.name} />
              <ProfileField label="الدور / المسمى" value={user.role} />
              <ProfileField label="البريد الإلكتروني" value={user.email} dir="ltr" />
              <ProfileField label="نوع العقد" value={typeLabel(user.type)} />
              {user.city ? <ProfileField label="المدينة" value={user.city} /> : null}
              {user.department ? (
                <ProfileField
                  label="الإدارة"
                  value={supervisingDepartmentLabel(user.department)}
                />
              ) : null}
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
              {showFinancial ? (
                <>
                  <ProfileField label="يستحق تعويضاً" value="نعم" />
                  <ProfileField
                    label="قيمة الأتعاب (ر.س)"
                    value={
                      user.feeValueSar != null ? String(user.feeValueSar) : "—"
                    }
                    dir="ltr"
                  />
                </>
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
        </>
      ) : null}

      {tab === "login" ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <ProfileField label="الحالة" value={statusLabel(user.status)} />
          <ProfileField
            label="آخر دخول"
            value={formatAt(user.lastLoginAtUtc)}
            dir="ltr"
          />
          <ProfileField
            label="اسم الدخول"
            value={user.userName || "—"}
            dir="ltr"
          />
        </section>
      ) : null}

      {tab === "activity" ? (
        <section>
          {feesLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : feesFailed ? (
            <p className="text-[12px] text-danger">تعذّر تحميل سجل الأعمال.</p>
          ) : activityRows.length === 0 ? (
            <p className="text-[12px] text-text-3">لا توجد أعمال منجزة ظاهرة لهذا المستخدم.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <THead>
                  <Tr hoverable={false}>
                    <Th>أمر العمل</Th>
                    <Th>تاريخ الإنجاز</Th>
                    <Th>نوع المهمة</Th>
                    <Th>الحالة</Th>
                  </Tr>
                </THead>
                <TBody>
                  {activityRows.map((row) => (
                    <Tr key={row.workflowTaskId}>
                      <Td dir="ltr">{row.poNumber || "—"}</Td>
                      <Td dir="ltr">
                        {formatAt(row.accruedAtUtc ?? row.workSubmittedAtUtc ?? row.updatedAtUtc)}
                      </Td>
                      <Td>{row.taskKind || "—"}</Td>
                      <Td>{row.workStatusLabel || row.billingStatusLabel}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "eng_statements" && showEngStatements ? (
        <section className="space-y-3">
          <PartyOfficeBillingStatementsPanel
            assigneeId={user.distributionAssigneeId || undefined}
            issuedOrLaterOnly
          />
        </section>
      ) : null}

      {tab === "inspector_dues" && showInspectorDues ? (
        <section className="space-y-3">
          <p className="m-0 rounded-[10px] border border-dashed border-border-md bg-surface-2 px-[15px] py-[11px] text-[12.5px] leading-[1.7] text-text-3">
            مستحقاتكم كفرد — جاهزة للصرف أو ضمن أمر صرف أو مدفوعة. لا فاتورة
            مورّد لمعاين الميدان.
          </p>
          <ProfileInspectorDuesPanel user={user} />
        </section>
      ) : null}

      {tab === "financial" && showFinancial ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <ProfileField
              label="المستحق"
              value={`${financialSummary.due.toLocaleString("ar-SA")} ر.س`}
            />
            <ProfileField
              label="المدفوع"
              value={`${financialSummary.paid.toLocaleString("ar-SA")} ر.س`}
            />
            <ProfileField
              label="المتبقي"
              value={`${financialSummary.remaining.toLocaleString("ar-SA")} ر.س`}
            />
            <ProfileField
              label="موقوف"
              value={`${financialSummary.suspended.toLocaleString("ar-SA")} ر.س`}
            />
          </div>
          {feesLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : feeRows.length === 0 ? (
            <p className="text-[12px] text-text-3">لا توجد بنود مالية لهذا المستخدم.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <THead>
                  <Tr hoverable={false}>
                    <Th>أمر العمل</Th>
                    <Th>الصافي</Th>
                    <Th>المدفوع</Th>
                    <Th>الحالة</Th>
                    <Th>آخر تحديث</Th>
                  </Tr>
                </THead>
                <TBody>
                  {feeRows.map((row) => (
                    <Tr key={row.workflowTaskId}>
                      <Td dir="ltr">{row.poNumber || "—"}</Td>
                      <Td dir="ltr">{row.netFeeSar.toLocaleString("ar-SA")}</Td>
                      <Td dir="ltr">{row.paidAmountSar.toLocaleString("ar-SA")}</Td>
                      <Td>{row.billingStatusLabel}</Td>
                      <Td dir="ltr">{formatAt(row.updatedAtUtc)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
