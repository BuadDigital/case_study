"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { listWorkflowTasks } from "@platform/api-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import { loadPropertyListItems } from "@platform/app-shared/prototype/work-orders-read";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/prototype/work-orders-api-config";
import { StatusBadge, Button, Note, ReportPageBody, StatCard, StatGrid, StatLabel, StatSkeleton, StatValue, SubpageHeader, SubpagePanel, SkeletonTableRows, Table, TBody, Td, Th, THead, Tr, useToast } from "@platform/design-system";
import type { RoleId } from "@platform/types";
import {
  useSubmitValuationImpedimentMutation,
  useSubmitValuationReportMutation,
  useValuationRequestsQuery,
} from "../query/valuation-queries";

function isValuationMgr(role: RoleId) {
  return (
    isSuperAdmin(role) ||
    role === "general-manager" ||
    role === "valuation-coordinator"
  );
}

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
  const done = vr.filter((v) => v.status === "done").length;
  const prog = vr.filter((v) => v.status === "progress").length;
  const failed = vr.filter((v) => v.status === "fail").length;
  const ready = !isPending;

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

  const statCards = ready
    ? [
        <StatCard key="active" accent="blue">
          <StatLabel>طلبات نشطة</StatLabel>
          <StatValue value={vr.length} countUp />
        </StatCard>,
        <StatCard key="done" accent="green">
          <StatLabel>مكتملة</StatLabel>
          <StatValue value={done} countUp />
        </StatCard>,
        <StatCard key="prog" accent="warn">
          <StatLabel>قيد التنفيذ</StatLabel>
          <StatValue value={prog} countUp />
        </StatCard>,
        <StatCard key="fail" accent="red">
          <StatLabel>متعذرة</StatLabel>
          <StatValue value={failed} countUp />
        </StatCard>,
      ]
    : Array.from({ length: 4 }, (_, index) => (
        <StatCard key={index} accent="gray">
          <StatSkeleton />
        </StatCard>
      ));

  return (
    <ReportPageBody>
      <StatGrid>{statCards}</StatGrid>
      <Note tone="info">
        هذه الطلبات واردة من قسم دراسة الحالة — يتولى منسق التقييم توزيعها على المقيمين المؤهلين
      </Note>
      <SubpagePanel>
        <SubpageHeader title="طلبات التقييم الواردة من دراسة الحالة" />
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
            ) : (
              vr.map((v) => (
              <Tr key={v.recordId} hoverable={false}>
                <Td className="font-semibold text-primary-light">{v.id}</Td>
                <Td className="text-primary-light">{v.propId}</Td>
                <Td>{v.area}</Td>
                <Td>{v.type}</Td>
                <Td>{v.appraiser}</Td>
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
