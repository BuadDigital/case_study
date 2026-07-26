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
  KpiBand,
  KpiCell,
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
} from "@platform/design-system";
import type { RoleId } from "@platform/types";
import {
  useSubmitValuationImpedimentMutation,
  useSubmitValuationReportMutation,
  useValuationRequestsQuery,
} from "../query/valuation-queries";

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

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}

function isValuationMgr(role: RoleId) {
  return (
    isSuperAdmin(role) ||
    role === "general-manager" ||
    role === "valuation-coordinator"
  );
}

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

  const done = vr.filter((v) => v.status === "done").length;
  const prog = vr.filter((v) => v.status === "progress").length;
  const failed = vr.filter((v) => v.status === "fail").length;
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
      <KpiBand>
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
      <Note tone="info">
        هذه الطلبات واردة من قسم دراسة الحالة — يتولى منسق التقييم توزيعها على المقيمين المؤهلين
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

        <Table pending={!ready}>
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
                            disabled={submitReport.isPending}
                            onClick={() => void handleSubmitReport(v.recordId)}
                          >
                            رفع التقرير
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={submitImpediment.isPending}
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
      </SubpagePanel>
    </ReportPageBody>
  );
}
