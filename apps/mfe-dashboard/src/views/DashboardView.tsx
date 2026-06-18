"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { TeamCurrentLoadCard } from "../components/dashboard/TeamCurrentLoadCard";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  Badge,
  Note,
  ProgressBar,
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
  Skeleton,
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
} from "../query/dashboard-queries";
import { useReportingDashboardQuery } from "../query/reporting-queries";

const MGR_ROLES = new Set(["cdo", "general-manager", "section-supervisor"]);
const TEAM_LOAD_ROLES = new Set([...MGR_ROLES, "cdo"]);

function teamTint(t: string): { bg: string; fg: string } {
  if (t === "internal") return { bg: "bg-info-bg", fg: "text-info-text" };
  if (t === "freelance") return { bg: "bg-warning-bg", fg: "text-warning" };
  return { bg: "bg-success-bg", fg: "text-success-text" };
}

export function DashboardView() {
  const router = useRouter();
  const { role } = usePrototype();
  const mgr = MGR_ROLES.has(role);
  const showTeamLoad = TEAM_LOAD_ROLES.has(role);
  const { data: poRows, isPending: poPending } = usePoListRowsQuery();
  const { data: propertyItems, isPending: propertyPending } =
    usePropertyListItemsQuery();
  const { data: reporting, isPending: reportingPending } = useReportingDashboardQuery();
  const reportingReady = !reportingPending && reporting !== undefined;

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
    <>
      <StatGrid>{statCards}</StatGrid>

      {showTeamLoad ? <TeamCurrentLoadCard /> : null}

      {mgr ? (
        <div className="grid grid-cols-2 gap-3">
          <SubpagePanel>
            <SubpageHeader title="أوامر العمل النشطة">
              <Link
                href="/po"
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-DEFAULT)] border border-border-md bg-surface px-2 py-1 text-[11px] font-normal text-text no-underline transition-colors hover:bg-surface-2",
                )}
              >
                عرض الكل
              </Link>
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
              <Link
                href="/valuation-requests"
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-DEFAULT)] border border-border-md bg-surface px-2 py-1 text-[11px] font-normal text-text no-underline transition-colors hover:bg-surface-2",
                )}
              >
                عرض الكل
              </Link>
            </SubpageHeader>
            <Table pending={!reportingReady}>
              <THead>
                <Tr hoverable={false}>
                  <Th>الطلب</Th>
                  <Th>العقار</Th>
                  <Th>المقيم</Th>
                  <Th>الحالة</Th>
                </Tr>
              </THead>
              <TBody>
                {!reportingReady ? (
                  <SkeletonTableRows rows={4} cols={4} />
                ) : (
                  (reporting?.recentValuationRequests ?? []).map((v) => (
                  <Tr key={v.displayId} hoverable={false}>
                    <Td className="text-[11px] font-semibold text-primary-light">
                      {v.displayId}
                    </Td>
                    <Td>{v.propId}</Td>
                    <Td className="text-[11px]">{v.appraiser}</Td>
                    <Td>
                      <StatusBadge status={v.status === "done" ? "done" : "progress"} />
                    </Td>
                  </Tr>
                ))
                )}
              </TBody>
            </Table>
          </SubpagePanel>
        </div>
      ) : null}

      <h3 className="mb-2.5 text-[13px] font-semibold text-text">
        الفريق الميداني — مزودو الخدمة الداخليين
      </h3>
      <Note tone="info">
        المعاينون والمقيمون يتبعون قسم التقييم العقاري ويخدمون القسمين كمورد
        مشترك
      </Note>
      {reportingPending ? (
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="rounded-[var(--radius-lg)] border border-border bg-surface p-3"
            >
              <Skeleton className="mb-2 size-[34px] rounded-full" />
              <Skeleton className="mb-1 h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : (reporting?.teamFieldMembers ?? []).length === 0 ? (
        <p className="text-xs text-text-3">لا توجد بيانات فريق ميداني بعد.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {(reporting?.teamFieldMembers ?? []).map((member) => {
            const tint = teamTint(member.teamKind);
            return (
              <div
                key={member.name}
                className="flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-border bg-surface p-3"
              >
                <div
                  className={`flex size-[34px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${tint.bg} ${tint.fg}`}
                >
                  {member.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text">{member.name}</div>
                  <div className="text-[11px] text-text-2">{member.roleLine}</div>
                </div>
                <div className="text-lg font-bold text-text">{member.activeCount}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
