"use client";

/**
 * Valuers roster — a read-only view of who sits in the valuation report. Every
 * row is a user account; the professional data and the report seat are edited
 * on that user's card (المستخدمون), and the certified valuer is chosen in
 * بيانات المنشأة. Nothing is added or deleted here.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getOrganizationSettings,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import { todayIso } from "@platform/app-shared/format/date";
import {
  Badge,
  Card,
  Input,
  Note,
  PageLoadingHint,
  PageShell,
  Table,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
} from "@platform/ui-kit";
import {
  catLabel,
  certBlockMessage,
  filterRoster,
  isIsoDate,
  isLinkedStaffValuer,
  roleLabel,
  ROSTER_TOASTS,
  rosterEditHref,
  rowStatus,
  sigOk,
  sortRoster,
} from "./valuers-roster-state";

function RosterRow({ v, today }: { v: OrganizationValuerRosterEntry; today: string }) {
  const status = rowStatus(v, today);
  const editHref = rosterEditHref(v);
  const expiry = v.membershipExpiresAt?.trim() || "";
  const expired = isIsoDate(expiry) && expiry < today;
  return (
    <Tr>
      <Td className="font-semibold text-heading">
        {v.nameAr}
        {v.role === "certified" ? (
          <Badge tone="info" className="ms-2">
            المقيّم المعتمد
          </Badge>
        ) : null}
      </Td>
      <Td>
        {isLinkedStaffValuer(v) ? (
          <Badge tone="success">مرتبط بحساب</Badge>
        ) : (
          <Badge tone="warning" title="أضف الشخص من «المستخدمون» بنفس الاسم ليرتبط هذا الصف بحسابه">
            بلا حساب
          </Badge>
        )}
      </Td>
      <Td>{roleLabel(v.role)}</Td>
      <Td>{catLabel(v.membershipCategory)}</Td>
      <TdLtr>{v.membershipNumber?.trim() || "—"}</TdLtr>
      <TdLtr className={expired ? "text-danger-text" : undefined}>{expiry || "—"}</TdLtr>
      <Td>
        {v.role === "certified" ? (
          sigOk(v) ? <Badge tone="success">مرفوع</Badge> : <Badge tone="danger">غير مرفوع</Badge>
        ) : (
          <span className="text-text-3">—</span>
        )}
      </Td>
      <Td>
        <Badge tone={status.tone} title={status.blockReason ?? undefined}>
          {status.label}
        </Badge>
      </Td>
      <Td>
        {editHref ? (
          <Link href={editHref} className="text-[12.5px] font-semibold text-primary">
            تعديل
          </Link>
        ) : (
          <span className="text-[12px] text-text-3">من المستخدمون</span>
        )}
      </Td>
    </Tr>
  );
}

export function ValuersRosterView() {
  const [rows, setRows] = useState<OrganizationValuerRosterEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const today = todayIso();

  const reload = useCallback(async () => {
    const config = apiConfig();
    if (!config) {
      setError(ROSTER_TOASTS.loginRequired);
      setRows([]);
      return;
    }
    const res = await getOrganizationSettings(config);
    if (!res.ok) {
      setError(ROSTER_TOASTS.loadFailed);
      setRows([]);
      return;
    }
    setError(null);
    setRows(sortRoster(res.data.valuers));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = useMemo(() => filterRoster(rows ?? [], query), [rows, query]);
  const certMsg = rows ? certBlockMessage(rows, today) : "";

  if (rows === null) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <PageLoadingHint className="py-20" />
      </PageShell>
    );
  }

  return (
    <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
      {error ? <Note tone="warn">{error}</Note> : null}
      {certMsg ? (
        <Note tone="danger" className="mt-0">
          {certMsg}
        </Note>
      ) : null}
      <Note className="mt-0">
        هذه قائمة من يظهر في تقرير التقييم. كل صف حساب مستخدم: الاسم والصفة في التقرير وبيانات
        العضوية والترخيص تُعدَّل من بطاقته في{" "}
        <Link href="/users" className="font-semibold text-primary">
          «المستخدمون»
        </Link>
        ، والمقيّم المعتمد يُختار من{" "}
        <Link href="/organization-settings?tab=company" className="font-semibold text-primary">
          «بيانات المنشأة»
        </Link>
        . التوقيع يُطبع للمقيّم المعتمد فقط.
      </Note>

      <div className="mb-3 mt-3 flex flex-wrap gap-2.5">
        <Input
          className="h-[34px] max-w-[260px] py-0 text-[12.5px] leading-[34px]"
          placeholder="بحث بالاسم…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        <Table className="min-w-[56rem] tabular-nums">
          <THead>
            <Tr hoverable={false}>
              <Th>الاسم</Th>
              <Th>الحساب</Th>
              <Th>الصفة في التقرير</Th>
              <Th>فئة العضوية</Th>
              <Th>رقم العضوية</Th>
              <Th>سريان العضوية</Th>
              <Th>التوقيع</Th>
              <Th>الحالة</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {visible.map((v) => (
              <RosterRow key={v.id} v={v} today={today} />
            ))}
          </TBody>
        </Table>
      </Card>
    </PageShell>
  );
}
