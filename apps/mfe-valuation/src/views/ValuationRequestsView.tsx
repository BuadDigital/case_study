"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { listWorkflowTasks } from "@platform/api-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import { loadPropertyListItems } from "@platform/app-shared/prototype/work-orders-read";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/prototype/work-orders-api-config";
import {
  StatusBadge,
  Button,
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiCheckIcon,
  KpiClipboardIcon,
  KpiClockIcon,
  MobileKpiStatCards,
  Note,
  ReportPageBody,
  SubpageHeader,
  SubpagePanel,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
  cn,
} from "@platform/ui-kit";
import type { RoleId } from "@platform/types";
import {
  useSubmitValuationImpedimentMutation,
  useSubmitValuationReportMutation,
  useValuationRequestsQuery,
} from "../query/valuation-queries";

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}

function isValuationMgr(role: RoleId) {
  return isSuperAdmin(role) || role === "general-manager";
}

const mobileLoadingSkeleton = (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className="h-[100px] animate-pulse rounded-[14px] border border-border bg-surface-2"
      />
    ))}
  </div>
);

type StatusFilter = "all" | "progress" | "done" | "fail";

export function ValuationRequestsView() {
  const router = useRouter();
  const { role } = usePrototype();
  const { showToast } = useToast();
  const mgr = isValuationMgr(role);
  const isApp = role === "real-estate-appraiser";
  const { data: vr = [], isPending } = useValuationRequestsQuery();
  const submitReport = useSubmitValuationReportMutation();
  const submitImpediment = useSubmitValuationImpedimentMutation();
  const [openingPropId, setOpeningPropId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const { done, prog, failed } = useMemo(() => {
    let done = 0;
    let prog = 0;
    let failed = 0;
    for (const v of vr) {
      if (v.status === "done") done += 1;
      else if (v.status === "progress") prog += 1;
      else if (v.status === "fail") failed += 1;
    }
    return { done, prog, failed };
  }, [vr]);
  const ready = !isPending;

  const rows = useMemo(() => {
    const q = search.trim();
    return vr.filter((v) => {
      const okS = status === "all" || v.status === status;
      const okQ =
        !q ||
        [v.id, v.propId, v.area, v.type, v.appraiser]
          .join(" ")
          .includes(q);
      return okS && okQ;
    });
  }, [vr, search, status]);

  const handleSubmitReport = async (recordId: string) => {
    const ok = window.confirm("تأكيد رفع تقرير التقييم وإرساله لدراسة الحالة؟");
    if (!ok) return;
    const result = await submitReport.mutateAsync(recordId);
    if (result.ok) {
      showToast("تم إرسال تقرير التقييم بنجاح", "success");
      return;
    }
    showToast(result.message, "error");
  };

  const handleImpediment = async (recordId: string) => {
    const reason = window.prompt("سبب التعذّر (مطلوب):");
    if (reason === null) return;
    const result = await submitImpediment.mutateAsync({ recordId, reason });
    if (result.ok) {
      showToast("تم تسجيل تعذّر التقييم", "success");
      return;
    }
    showToast(result.message, "error");
  };

  const handleViewRequest = async (propId: string) => {
    setOpeningPropId(propId);
    try {
      const config = requireWorkOrdersApiConfig();
      const result = await listWorkflowTasks(config);
      const tasks = unwrapApiResult(result, "تعذّر تحميل مهام التقييم");
      const appraisal = tasks.find(
        (t) => t.kind === "property-appraisal" && t.propertyId === propId,
      );
      if (appraisal) {
        router.push(`/property-appraisal/${encodeURIComponent(appraisal.id)}`);
        return;
      }

      const items = await loadPropertyListItems();
      const item = items.find((row) => row.propertyId === propId);
      if (item) {
        router.push(
          `/po/${encodeURIComponent(item.poNumber)}/property/${encodeURIComponent(item.propertyId)}`,
        );
        return;
      }

      showToast("تعذّر فتح تفاصيل الطلب", "error");
    } catch {
      showToast("تعذّر فتح تفاصيل الطلب — حاول مرة أخرى", "error");
    } finally {
      setOpeningPropId(null);
    }
  };

  return (
    <ReportPageBody>
      <KpiBand className="mb-0 hidden lg:flex">
        <KpiCell
          first
          icon={<KpiClipboardIcon />}
          iconClass="bg-info-bg text-info-text"
          label="طلبات نشطة"
          value={ready ? vr.length : "—"}
          sub="واردة من دراسة الحالة"
          dot
        />
        <KpiCell
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success-text"
          label="مكتملة"
          value={ready ? done : "—"}
          valueClass="!text-success-text"
          sub="تقارير تقييم منتهية"
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]"
          label="قيد التنفيذ"
          value={ready ? prog : "—"}
          sub="بانتظار المقيم"
        />
        <KpiCell
          last
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
          label="متعذرة"
          value={ready ? failed : "—"}
          valueClass="!text-red"
          sub="تحتاج معالجة"
        />
      </KpiBand>

      <MobileKpiStatCards
        className="mb-6"
        items={[
          {
            key: "active",
            label: "طلبات نشطة",
            sub: "واردة من دراسة الحالة",
            value: ready ? vr.length : "—",
            icon: <KpiClipboardIcon />,
            iconClass: "bg-info-bg text-info-text",
            tone: "ink",
          },
          {
            key: "done",
            label: "مكتملة",
            sub: "تقارير تقييم منتهية",
            value: ready ? done : "—",
            icon: <KpiCheckIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
            valueClass: "!text-ink",
          },
          {
            key: "prog",
            label: "قيد التنفيذ",
            sub: "بانتظار المقيم",
            value: ready ? prog : "—",
            icon: <KpiClockIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]",
            tone: "gold",
          },
          {
            key: "failed",
            label: "متعذرة",
            sub: "تحتاج معالجة",
            value: ready ? failed : "—",
            icon: <KpiAlertIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red",
            tone: "red",
            valueClass: "!text-red",
          },
        ]}
      />
      <Note tone="info">
        هذه الطلبات واردة من قسم دراسة الحالة — تُعرض هنا لمتابعة مسار التقييم
      </Note>
      <SubpagePanel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <SubpageHeader title="سجل طلبات التقييم" className="!mb-0 !border-0 !p-0" />
            <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] px-2.5 py-0.5 text-[12px] font-bold text-[color-mix(in_srgb,var(--gold)_70%,#000)]">
              {ready ? rows.length : "—"}
              <span>نتيجة</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute inset-inline-start-3 text-text-3">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="رقم الطلب أو العقار أو المنطقة..."
                className={cn(
                  "w-[240px] rounded-lg border border-border-md bg-surface py-[9px] pe-3.5 ps-9 text-[13px] outline-none transition",
                  "focus:border-gold focus:shadow-[0_0_0_3px_rgba(164,144,111,.22)]",
                )}
              />
            </div>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                className="appearance-none rounded-lg border border-border-md bg-surface px-3.5 py-[9px] pe-9 text-[13px] outline-none"
              >
                <option value="all">جميع الحالات</option>
                <option value="progress">قيد التنفيذ</option>
                <option value="done">مكتمل</option>
                <option value="fail">متعذر</option>
              </select>
            </div>
          </div>
        </div>

        <Table pending={!ready} wrapClassName="hidden lg:block">
          <THead>
            <Tr hoverable={false}>
              <Th>رقم الطلب</Th>
              <Th>العقار</Th>
              <Th>المنطقة</Th>
              <Th>النوع</Th>
              <Th>المقيم المُسند</Th>
              <Th>الحالة</Th>
              <Th>التاريخ</Th>
              <Th>إجراء</Th>
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={5} cols={8} />
            ) : rows.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={8} className="!py-12 text-center text-text-3">
                  <div className="text-[14px] font-bold text-text-2">لا توجد نتائج مطابقة</div>
                  <div className="mt-1 text-[13px]">جرّب تعديل كلمة البحث أو الفلتر</div>
                </Td>
              </Tr>
            ) : (
              rows.map((v) => (
                <Tr key={v.recordId} hoverable={false}>
                  <Td className="font-bold text-[color-mix(in_srgb,var(--gold)_55%,#12284C)]">
                    {v.id}
                  </Td>
                  <Td className="text-primary-light">{v.propId}</Td>
                  <Td>{v.area}</Td>
                  <Td>
                    <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-2.5 py-0.5 text-[12px] font-medium text-text-2">
                      {v.type}
                    </span>
                  </Td>
                  <Td>
                    {v.appraiser ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-heading text-[12px] font-bold text-gold">
                          {v.appraiser.trim().charAt(0)}
                        </span>
                        <span className="truncate text-[13px] font-semibold text-heading">
                          {v.appraiser}
                        </span>
                      </div>
                    ) : (
                      <span className="text-text-3">—</span>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={v.status} />
                  </Td>
                  <Td className="text-text-3">{v.date}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {isApp && v.status === "progress" ? (
                        <>
                          <Button
                            size="sm"
                            variant="accent"
                            loading={submitReport.isPending}
                            showActionToast={false}
                            onClick={() => void handleSubmitReport(v.recordId)}
                          >
                            رفع التقرير
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={submitImpediment.isPending}
                            showActionToast={false}
                            onClick={() => void handleImpediment(v.recordId)}
                          >
                            تعذّر
                          </Button>
                        </>
                      ) : null}
                      {mgr && v.status === "progress" ? (
                        <Button
                          size="sm"
                          disabled={openingPropId === v.propId}
                          onClick={() => void handleViewRequest(v.propId)}
                        >
                          عرض
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>

        <div className="p-3 lg:hidden">
          {!ready ? (
            mobileLoadingSkeleton
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-text-3">
              لا توجد نتائج مطابقة
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {rows.map((v) => {
                const tone =
                  v.status === "fail"
                    ? "border-s-red"
                    : v.status === "done"
                      ? "border-s-ink"
                      : "border-s-gold";
                return (
                  <li
                    key={v.recordId}
                    className={cn(
                      "overflow-hidden rounded-[14px] border border-border border-s-[3px] bg-surface px-3.5 py-3.5 shadow-[0_2px_8px_rgba(15,52,96,0.06)]",
                      tone,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[14px] font-bold text-heading">
                          {v.id}
                        </div>
                        <div className="mt-0.5 text-[12px] text-text-2" dir="ltr">
                          {v.propId}
                        </div>
                      </div>
                      <StatusBadge status={v.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-text-2">
                      <span>{v.area || "—"}</span>
                      <span>{v.type || "—"}</span>
                      <span>{v.appraiser || "بدون مقيم"}</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {isApp && v.status === "progress" ? (
                        <>
                          <Button
                            size="sm"
                            variant="accent"
                            className="min-h-11"
                            loading={submitReport.isPending}
                            showActionToast={false}
                            onClick={() => void handleSubmitReport(v.recordId)}
                          >
                            رفع التقرير
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className="min-h-11"
                            loading={submitImpediment.isPending}
                            showActionToast={false}
                            onClick={() => void handleImpediment(v.recordId)}
                          >
                            تعذّر
                          </Button>
                        </>
                      ) : null}
                      {mgr && v.status === "progress" ? (
                        <Button
                          size="sm"
                          className="min-h-11"
                          disabled={openingPropId === v.propId}
                          onClick={() => void handleViewRequest(v.propId)}
                        >
                          عرض
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SubpagePanel>
    </ReportPageBody>
  );
}
