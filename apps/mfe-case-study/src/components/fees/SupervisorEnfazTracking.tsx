"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadEnfazTracking } from "@platform/app-shared/prototype/enfaz-billing-api";
import {
  Badge,
  EmptyState,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/design-system";
import { inspectorFeeWorkStatusTone } from "@platform/api-client";
import type { EnfazTrackingRowDto } from "@platform/api-client";

export function SupervisorEnfazTracking() {
  const { data = [], isPending } = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "tracking"],
    queryFn: loadEnfazTracking,
  });

  if (isPending) {
    return (
      <Table pending>
        <TBody>
          <SkeletonTableRows rows={5} cols={4} />
        </TBody>
      </Table>
    );
  }

  if (data.length === 0) {
    return <EmptyState line="لا بيانات متابعة حالياً." />;
  }

  return (
    <>
      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th>أمر العمل</Th>
            <Th>المعاملة</Th>
            <Th>حالة العمل</Th>
            <Th>فوترة إنفاذ</Th>
          </Tr>
        </THead>
        <TBody>
          {data.map((row: EnfazTrackingRowDto) => (
            <Tr
              key={`${row.poNumber}-${row.propertyId}`}
              hoverable={false}
              className={row.workStatus === "cancelled" ? "opacity-55" : ""}
            >
              <Td className="font-medium text-primary-light">{row.poNumber}</Td>
              <Td>{row.propertyLabel}</Td>
              <Td>
                <Badge
                  tone={inspectorFeeWorkStatusTone(
                    row.workStatus as "in_progress",
                  )}
                >
                  {row.workStatusLabel}
                </Badge>
              </Td>
              <Td>
                {row.workStatus === "cancelled" ? (
                  <Badge tone="danger">لا تُفوتر</Badge>
                ) : row.enfazFilled ? (
                  <Badge tone="success">
                    مُفوترة {row.enfazFeeSar.toLocaleString("ar-SA")} ر.س
                  </Badge>
                ) : (
                  <Badge tone="warning">بانتظار التعبئة</Badge>
                )}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <p className="mt-3 text-xs text-text-3">
        متابعة فقط — التعبئة الفعلية من سطح المالية.
      </p>
    </>
  );
}
