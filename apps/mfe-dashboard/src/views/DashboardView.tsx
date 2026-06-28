"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { TeamCurrentLoadCard } from "../components/dashboard/TeamCurrentLoadCard";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  Badge,
  ProgressBar,
  ReportPageBody,
  StatCard,
  StatGrid,
  StatLabel,
  StatSkeleton,
  StatSub,
  StatValue,
  StatusBadge,
  SubpageHeader,
  SubpagePanel,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
} from "@platform/design-system";
import {
  assignmentTypeBadgeTone,
} from "../lib/po-display";
import {
  usePoListRowsQuery,
  usePropertyListItemsQuery,
  useRecentValuationRequestsQuery,
} from "../query/dashboard-queries";
import { useReportingDashboardQuery } from "../query/reporting-queries";

const MGR_ROLES = new Set(["cdo", "general-manager", "section-supervisor"]);
const TEAM_LOAD_ROLES = new Set([...MGR_ROLES, "cdo"]);

function failureStatusLabel(status: string): string {
  switch (status) {
    case "internal":
      return "داخلي";
    case "review":
      return "مراجعة";
    case "approved":
      return "معتمد";
    case "returned":
      return "مُعاد";
    case "resolved":
      return "محلول";
    default:
      return status;
  }
}

function valuationStatusBadge(status: string): "done" | "progress" | "fail" {
  if (status === "done") return "done";
  if (status === "fail") return "fail";
  return "progress";
}

function panelLink(href: string, label: string) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-DEFAULT)] border border-border-md bg-surface px-2 py-1 text-[11px] font-normal text-text no-underline transition-colors hover:bg-surface-2",
      )}
    >
      {label}
    </Link>
  );
}

export function DashboardView() {
  const router = useRouter();
  const { role } = usePrototype();
  const mgr = MGR_ROLES.has(role);
  const showTeamLoad = TEAM_LOAD_ROLES.has(role);
  const { data: poRows, isPending: poPending } = usePoListRowsQuery();
  const { data: propertyItems, isPending: propertyPending } =
    usePropertyListItemsQuery();
  const { data: valuationRows = [], isPending: valuationPending } =
    useRecentValuationRequestsQuery();
  const { data: reporting, isPending: reportingPending } = useReportingDashboardQuery();
  const reportingReady = !reportingPending && reporting !== undefined;
  /** Always from workflow tasks — same source as «تقييم العقار». */
  const valuationRowsToShow = valuationRows;
  const valuationReady = !valuationPending && valuationRows !== undefined;

  const propertyStats = useMemo(() => {
    if (!propertyItems) return undefined;
    const rows = propertyItems.map((item) => item.row);
    const total = rows.length;
    const done = rows.filter((r) => r.status === "done").length;
    return {
      total,
      progress: rows.filter((r) => r.status === "progress").length,
      done,
      fail: rows.filter((r) => r.status === "fail").length,
      donePct: total > 0 ? `${Math.round((done / total) * 100)}% من الإجمالي` : "—",
    };
  }, [propertyItems]);

  const poActive = (poRows ?? []).filter((p) => p.status === "progress");
  const poReady = !poPending && poRows !== undefined;

  const statCards = propertyPending
    ? Array.from({ length: 4 }, (_, index) => (
        <StatCard key={index} accent="gray">
          <StatSkeleton />
        </StatCard>
      ))
    : [
        <StatCard key="total" accent="blue">
          <StatLabel>عقارات مسجّلة</StatLabel>
          <StatValue value={propertyStats?.total} countUp />
          <StatSub>من استلام أوامر العمل</StatSub>
        </StatCard>,
        <StatCard key="progress" accent="warn">
          <StatLabel>قيد التنفيذ</StatLabel>
          <StatValue value={propertyStats?.progress} countUp />
          <StatSub>بما فيها قيد التحقق</StatSub>
        </StatCard>,
        <StatCard key="done" accent="green">
          <StatLabel>مكتملة</StatLabel>
          <StatValue value={propertyStats?.done} countUp />
          <StatSub>{propertyStats?.donePct ?? "—"}</StatSub>
        </StatCard>,
        <StatCard key="fail" accent="red">
          <StatLabel>تعذرات</StatLabel>
          <StatValue value={propertyStats?.fail} countUp />
          <StatSub>
            {propertyStats && propertyStats.fail > 0
              ? "تحتاج مراجعة"
              : "لا تعذرات مسجّلة"}
          </StatSub>
        </StatCard>,
      ];

  return (
    <ReportPageBody>
      <StatGrid>{statCards}</StatGrid>

      {showTeamLoad ? <TeamCurrentLoadCard /> : null}

      {mgr ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <SubpagePanel>
            <SubpageHeader title="أوامر العمل النشطة">
              {panelLink("/po", "عرض الكل")}
            </SubpageHeader>
            <Table pending={!poReady}>
              <THead>
                <Tr hoverable={false}>
                  <Th>PO</Th>
                  <Th>النوع</Th>
                  <Th>التقدم</Th>
                  <Th>الحالة</Th>
                </Tr>
              </THead>
              <TBody>
                {!poReady ? (
                  <SkeletonTableRows rows={4} cols={4} />
                ) : poActive.length === 0 ? (
                  <Tr hoverable={false}>
                    <Td colSpan={4} className="text-center text-text-3">
                      لا توجد أوامر عمل نشطة
                    </Td>
                  </Tr>
                ) : (
                  poActive.map((p) => (
                      <Tr key={p.id} onClick={() => router.push("/po")}>
                        <Td className="text-[11px] font-semibold text-primary-light">
                          {p.id}
                        </Td>
                        <Td>
                          <Badge
                            tone={assignmentTypeBadgeTone(p.type)}
                            className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal"
                          >
                            {p.type}
                          </Badge>
                        </Td>
                        <Td className="min-w-[100px]">
                          <div className="mb-0.5 text-[10px] text-text-3">
                            {p.done}/{p.count}
                          </div>
                          <ProgressBar
                            value={p.done}
                            max={p.count}
                            tone="primary"
                          />
                        </Td>
                        <Td>
                          <StatusBadge status={p.status} />
                        </Td>
                      </Tr>
                    ))
                )}
              </TBody>
            </Table>
          </SubpagePanel>
          <SubpagePanel>
            <SubpageHeader title="طلبات التقييم الأخيرة">
              {panelLink("/property-appraisal", "عرض الكل")}
            </SubpageHeader>
            <Table pending={!valuationReady}>
              <THead>
                <Tr hoverable={false}>
                  <Th>الطلب</Th>
                  <Th>العقار</Th>
                  <Th>المقيم</Th>
                  <Th>الحالة</Th>
                </Tr>
              </THead>
              <TBody>
                {!valuationReady ? (
                  <SkeletonTableRows rows={4} cols={4} />
                ) : valuationRowsToShow.length === 0 ? (
                  <Tr hoverable={false}>
                    <Td colSpan={4} className="text-center text-text-3">
                      لا توجد طلبات تقييم حديثة
                    </Td>
                  </Tr>
                ) : (
                  valuationRowsToShow.map((v) => (
                  <Tr key={v.displayId} hoverable={false}>
                    <Td className="text-[11px] font-semibold text-primary-light">
                      {v.displayId}
                    </Td>
                    <Td>{v.propId}</Td>
                    <Td className="text-[11px]">{v.appraiser}</Td>
                    <Td>
                      <StatusBadge status={valuationStatusBadge(v.status)} />
                    </Td>
                  </Tr>
                ))
                )}
              </TBody>
            </Table>
          </SubpagePanel>
          <SubpagePanel>
            <SubpageHeader title="المراجعة الحكومية">
              {panelLink("/government-review", "عرض الكل")}
            </SubpageHeader>
            <Table pending={!reportingReady}>
              <THead>
                <Tr hoverable={false}>
                  <Th>PO</Th>
                  <Th>العقار</Th>
                  <Th>المراجع</Th>
                  <Th>الحالة</Th>
                </Tr>
              </THead>
              <TBody>
                {!reportingReady ? (
                  <SkeletonTableRows rows={4} cols={4} />
                ) : (reporting?.recentGovernmentReviews ?? []).length === 0 ? (
                  <Tr hoverable={false}>
                    <Td colSpan={4} className="text-center text-text-3">
                      لا توجد مراجعات حكومية نشطة
                    </Td>
                  </Tr>
                ) : (
                  (reporting?.recentGovernmentReviews ?? []).map((row) => (
                    <Tr
                      key={row.taskId}
                      onClick={() => router.push("/government-review")}
                    >
                      <Td className="text-[11px] font-semibold text-primary-light">
                        {row.poNumber}
                      </Td>
                      <Td className="max-w-[140px] truncate text-[11px]">
                        {row.title}
                      </Td>
                      <Td className="text-[11px]">{row.reviewerName}</Td>
                      <Td>
                        <StatusBadge
                          status={row.status === "done" ? "done" : "progress"}
                        />
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </SubpagePanel>
          <SubpagePanel>
            <SubpageHeader title="التعذرات الأخيرة">
              {panelLink("/failures", "عرض الكل")}
            </SubpageHeader>
            <Table pending={!reportingReady}>
              <THead>
                <Tr hoverable={false}>
                  <Th>PO</Th>
                  <Th>الصك</Th>
                  <Th>الوصف</Th>
                  <Th>الحالة</Th>
                </Tr>
              </THead>
              <TBody>
                {!reportingReady ? (
                  <SkeletonTableRows rows={4} cols={4} />
                ) : (reporting?.recentFailures ?? []).length === 0 ? (
                  <Tr hoverable={false}>
                    <Td colSpan={4} className="text-center text-text-3">
                      لا توجد تعذرات مفتوحة
                    </Td>
                  </Tr>
                ) : (
                  (reporting?.recentFailures ?? []).map((f) => (
                    <Tr key={f.id} onClick={() => router.push("/failures")}>
                      <Td className="text-[11px] font-semibold text-primary-light">
                        {f.poNumber}
                      </Td>
                      <Td className="text-[11px]">{f.deedNumber || "—"}</Td>
                      <Td className="max-w-[140px] truncate text-[11px]">
                        {f.title}
                      </Td>
                      <Td>
                        <Badge tone={f.severity === "internal" ? "danger" : "warning"}>
                          {failureStatusLabel(f.status)}
                        </Badge>
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </SubpagePanel>
        </div>
      ) : null}
    </ReportPageBody>
  );
}
