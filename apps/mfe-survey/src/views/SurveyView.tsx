"use client";

import {
  Badge,
  EmptyState,
  KpiBand,
  KpiCell,
  OperationalPanel,
  PageShell,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/design-system";
import {
  useSurveyOfficesQuery,
  useSurveyRequestStatsQuery,
} from "../query/survey-queries";

function KpiClipboardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function KpiCheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function KpiClockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function KpiAlertIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function SurveyView() {
  const { data: offices = [], isPending: officesPending } = useSurveyOfficesQuery();
  const { data: stats, isPending: statsPending } = useSurveyRequestStatsQuery();
  const ready = !officesPending && !statsPending;

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <KpiBand>
        <KpiCell
          first
          icon={<KpiClipboardIcon />}
          iconClass="bg-info-bg text-info-text"
          label="إجمالي طلبات الرفع"
          value={ready ? stats?.total ?? 0 : "—"}
          sub="عبر جميع المكاتب"
          dot
        />
        <KpiCell
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,#2f9e6b_16%,transparent)] text-[#2f9e6b]"
          label="مكتملة"
          value={ready ? stats?.completed ?? 0 : "—"}
          valueClass="!text-[#2f9e6b]"
          sub="طلبات منتهية"
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]"
          label="قيد التنفيذ"
          value={ready ? stats?.inProgress ?? 0 : "—"}
          sub="جاري الرفع المساحي"
        />
        <KpiCell
          last
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
          label="لم تُسند"
          value={ready ? stats?.unassigned ?? 0 : "—"}
          valueClass="!text-red"
          sub="بانتظار الإسناد لمكتب"
        />
      </KpiBand>

      <OperationalPanel className="min-h-0 flex-1">
        <Table pending={!ready}>
          <THead>
            <Tr hoverable={false}>
              <Th>اسم المكتب</Th>
              <Th>نشطة</Th>
              <Th>مكتملة هذا الشهر</Th>
              <Th>متوسط الإنجاز</Th>
              <Th>آلية التعاقد</Th>
              <Th>الحالة</Th>
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={4} cols={6} />
            ) : offices.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={6}>
                  <EmptyState line="لا توجد مكاتب مسجّلة" />
                </Td>
              </Tr>
            ) : (
              offices.map((row) => (
                <Tr key={row.id} hoverable={false}>
                  <Td className="font-medium">{row.name}</Td>
                  <Td>{row.active}</Td>
                  <Td>{row.doneMonth}</Td>
                  <Td>{row.avgDays}</Td>
                  <Td>
                    <Badge
                      tone="default"
                      className=""
                    >
                      {row.contract}
                    </Badge>
                  </Td>
                  <Td>
                    {row.statusBusy ? (
                      <Badge
                        tone="warning"
                        className=""
                      >
                        مشغول
                      </Badge>
                    ) : (
                      <Badge
                        tone="success"
                        className=""
                      >
                        نشط
                      </Badge>
                    )}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </OperationalPanel>
    </PageShell>
  );
}
