"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { TeamCurrentLoadCard } from "../components/dashboard/TeamCurrentLoadCard";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  isPoListStatusTerminal,
  normalizePoListStatus,
  poListStatusMeta,
} from "@platform/app-shared/prototype/po-list-status";
import {
  Badge,
  KpiBand,
  KpiCell,
  ProgressBar,
  ReportPageBody,
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
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
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

function KpiClipboardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
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

function KpiCheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
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

function PoListStatusBadge({ status }: { status: string }) {
  const { tone, label } = poListStatusMeta(normalizePoListStatus(status));
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
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
  const { data: propertyItems, isPending: propertyPending } = usePropertyListItemsQuery();
  const { data: valuationRows = [], isPending: valuationPending } = useRecentValuationRequestsQuery();
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

  const poActive = (poRows ?? []).filter(
    (p) => !isPoListStatusTerminal(p.status) && p.status !== "partially_billed",
  );
  const poReady = !poPending && poRows !== undefined;

  return (
    <ReportPageBody>
      <KpiBand>
        <KpiCell
          first
          icon={<KpiClipboardIcon />}
          iconClass="bg-info-bg text-info-text"
          label="عقارات مسجّلة"
          value={propertyPending ? "—" : propertyStats?.total}
          sub="من استلام أوامر العمل"
          dot
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]"
          label="قيد التنفيذ"
          value={propertyPending ? "—" : propertyStats?.progress}
          sub="بما فيها قيد التحقق"
        />
        <KpiCell
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success-text"
          label="مكتملة"
          value={propertyPending ? "—" : propertyStats?.done}
          valueClass="!text-success-text"
          sub={propertyStats?.donePct ?? "—"}
        />
        <KpiCell
          last
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
          label="تعذرات"
          value={propertyPending ? "—" : propertyStats?.fail}
          valueClass="!text-red"
          sub={
            propertyStats && propertyStats.fail > 0
              ? "تحتاج مراجعة"
              : "لا تعذرات مسجّلة"
          }
        />
      </KpiBand>

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
                      <Tr
                        key={p.id}
                        onClick={() =>
                          router.push(
                            `/po/${encodeURIComponent(p.id)}/property`,
                          )
                        }
                      >
                        <Td>
                          <PoNumber
                            value={p.id}
                            link
                            className="text-[13.5px] !font-bold text-primary"
                          />
                        </Td>
                        <Td>
                          <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-2.5 py-[3px] text-[12px] font-medium text-text-2">
                            {p.type}
                          </span>
                        </Td>
                        <Td className="min-w-[100px]">
                          <div className="mb-0.5 text-[10px] text-text-3">
                            {p.done}/{p.count} دراسة مكتملة
                          </div>
                          <ProgressBar
                            value={p.done}
                            max={Math.max(1, p.count)}
                            tone="primary"
                          />
                        </Td>
                        <Td>
                          <PoListStatusBadge status={p.status} />
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
                  <Tr
                    key={v.displayId}
                    onClick={() =>
                      router.push(
                        `/property-appraisal/${encodeURIComponent(v.id)}`,
                      )
                    }
                  >
                    <Td className="font-medium text-primary-light">
                      {v.displayId}
                    </Td>
                    <Td>{v.propId}</Td>
                    <Td>{v.appraiser}</Td>
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
              {panelLink("/operations-tasks", "عرض الكل")}
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
                      onClick={() => router.push("/operations-tasks")}
                    >
                      <Td className="font-medium text-primary-light">
                        {row.poNumber}
                      </Td>
                      <Td className="max-w-[140px] truncate">
                        {row.title}
                      </Td>
                      <Td>{row.reviewerName}</Td>
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
                    <Tr
                      key={f.id}
                      onClick={() =>
                        router.push(
                          `/failures?highlight=${encodeURIComponent(f.id)}`,
                        )
                      }
                    >
                      <Td className="font-medium text-primary-light">
                        {f.poNumber}
                      </Td>
                      <Td>{f.deedNumber || "—"}</Td>
                      <Td className="max-w-[140px] truncate">
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