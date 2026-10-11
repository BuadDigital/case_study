"use client";

import {
  Badge,
  EmptyState,
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiCheckIcon,
  KpiClipboardIcon,
  KpiClockIcon,
  MobileKpiStatCards,
  OperationalPanel,
  PageShell,
  QueryErrorState,
  SkeletonTableRows,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  cn,
  opsMobileCard,
  opsSkeletonCard,
} from "@platform/ui-kit";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import {
  useSurveyOfficesQuery,
  useSurveyRequestStatsQuery,
} from "../query/survey-queries";

const mobileLoadingSkeleton = (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className={cn(opsSkeletonCard, "h-[88px]")}
      />
    ))}
  </div>
);

export function SurveyView() {
  const officesQuery = useSurveyOfficesQuery();
  const statsQuery = useSurveyRequestStatsQuery();
  const { data: offices = [], isPending: officesPending } = officesQuery;
  const { data: stats, isPending: statsPending } = statsQuery;
  const ready = !officesPending && !statsPending;
  /** KPI tiles read «—» (not 0) when the stats failed to load. */
  const kpiReady = ready && stats !== undefined;
  const officesError = queryLoadFailed(officesQuery) ? (
    <QueryErrorState
      line="تعذّر تحميل المكاتب الهندسية"
      error={officesQuery.error}
      onRetry={() => void officesQuery.refetch()}
      retrying={officesQuery.isFetching}
    />
  ) : null;

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <KpiBand className="mb-0 hidden lg:flex">
        <KpiCell
          first
          icon={<KpiClipboardIcon />}
          iconClass="bg-info-bg text-info-text"
          label="إجمالي طلبات الرفع"
          value={kpiReady ? stats?.total ?? 0 : "—"}
          sub="عبر جميع المكاتب"
          dot
        />
        <KpiCell
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success-text"
          label="مكتملة"
          value={kpiReady ? stats?.completed ?? 0 : "—"}
          valueClass="!text-success-text"
          sub="طلبات منتهية"
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]"
          label="قيد التنفيذ"
          value={kpiReady ? stats?.inProgress ?? 0 : "—"}
          sub="جاري الرفع المساحي"
        />
        <KpiCell
          last
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
          label="لم تُسند"
          value={kpiReady ? stats?.unassigned ?? 0 : "—"}
          valueClass="!text-red"
          sub="بانتظار الإسناد لمكتب"
        />
      </KpiBand>

      <MobileKpiStatCards
        className="mb-3"
        items={[
          {
            key: "total",
            label: "إجمالي طلبات الرفع",
            sub: "عبر جميع المكاتب",
            value: kpiReady ? (stats?.total ?? 0) : "—",
            icon: <KpiClipboardIcon />,
            iconClass: "bg-info-bg text-info-text",
            tone: "ink",
          },
          {
            key: "completed",
            label: "مكتملة",
            sub: "طلبات منتهية",
            value: kpiReady ? (stats?.completed ?? 0) : "—",
            icon: <KpiCheckIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-heading",
            tone: "ink",
            valueClass: "!text-heading",
          },
          {
            key: "inProgress",
            label: "قيد التنفيذ",
            sub: "جاري الرفع المساحي",
            value: kpiReady ? (stats?.inProgress ?? 0) : "—",
            icon: <KpiClockIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]",
            tone: "gold",
          },
          {
            key: "unassigned",
            label: "لم تُسند",
            sub: "بانتظار الإسناد لمكتب",
            value: kpiReady ? (stats?.unassigned ?? 0) : "—",
            icon: <KpiAlertIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red",
            tone: "red",
            valueClass: "!text-red",
          },
        ]}
      />

      <OperationalPanel className="min-h-0 flex-1 max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:rounded-none">
        <div className="hidden lg:block">
          <Table framed pending={!ready}>
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
              ) : officesError ? (
                <Tr hoverable={false}>
                  <Td colSpan={6}>{officesError}</Td>
                </Tr>
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
                      <Badge tone="default" className="">
                        {row.contract}
                      </Badge>
                    </Td>
                    <Td>
                      {row.statusBusy ? (
                        <Badge tone="warning" className="">
                          مشغول
                        </Badge>
                      ) : (
                        <Badge tone="success" className="">
                          نشط
                        </Badge>
                      )}
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>

        <div className="lg:hidden">
          {!ready ? (
            mobileLoadingSkeleton
          ) : officesError ? (
            officesError
          ) : offices.length === 0 ? (
            <EmptyState line="لا توجد مكاتب مسجّلة" />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {offices.map((row) => (
                <li
                  key={row.id}
                  className={cn(opsMobileCard, "relative overflow-hidden border-s-[3px] border-s-ink")}
                >
                  <div className="text-[14px] font-bold text-heading">
                    {row.name}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-text-2">
                    <span>
                      <span className="text-text-3">نشطة: </span>
                      {row.active}
                    </span>
                    <span>
                      <span className="text-text-3">مكتملة: </span>
                      {row.doneMonth}
                    </span>
                    <span>
                      <span className="text-text-3">متوسط: </span>
                      {row.avgDays}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Badge tone="default">{row.contract}</Badge>
                    {row.statusBusy ? (
                      <Badge tone="warning">مشغول</Badge>
                    ) : (
                      <Badge tone="success">نشط</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </OperationalPanel>
    </PageShell>
  );
}
