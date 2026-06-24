"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadInspectorFeeTransitions } from "@platform/app-shared/prototype/inspector-fees-api";
import type { InspectorFeeRowDto } from "@platform/api-client";
import { formatFeeDate } from "./party-fee-meta";
import {
  Badge,
  EmptyState,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/design-system";

export function FeeAuditModal({
  open,
  row,
  onClose,
}: {
  open: boolean;
  row: InspectorFeeRowDto | null;
  onClose: () => void;
}) {
  const [at, setAt] = useState<string | null>(null);

  useEffect(() => {
    if (open && row) setAt(row.workflowTaskId);
    if (!open) setAt(null);
  }, [open, row]);

  const { data = [], isPending } = useQuery({
    queryKey: [...prototypeKeys.all, "inspector-fees", "audit", at],
    queryFn: () => loadInspectorFeeTransitions(at!),
    enabled: open && Boolean(at),
  });

  if (!open || !row) return null;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard wide onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>سجل التدقيق — {row.propertyLabel}</ModalTitle>
          <ModalClose onClick={onClose} aria-label="إغلاق">
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody className="pt-2">
          <p className="mb-3 text-xs text-text-3">
            {row.poNumber} · الصافي {row.netFeeSar.toLocaleString("ar-SA")} ر.س
          </p>
          {isPending ? (
            <Table pending>
              <TBody>
                <SkeletonTableRows rows={4} cols={4} />
              </TBody>
            </Table>
          ) : data.length === 0 ? (
            <EmptyState line="لا حركات مسجّلة بعد." />
          ) : (
            <Table>
              <THead>
                <Tr hoverable={false}>
                  <Th>التاريخ</Th>
                  <Th>من → إلى</Th>
                  <Th>السبب</Th>
                  <Th>المُنفّذ</Th>
                </Tr>
              </THead>
              <TBody>
                {data.map((entry) => (
                  <Tr key={entry.id} hoverable={false}>
                    <Td className="text-[11px] text-text-2">
                      {formatFeeDate(entry.createdAtUtc)}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        <Badge tone="default">{entry.fromStatusLabel}</Badge>
                        <span>←</span>
                        <Badge tone="info">{entry.toStatusLabel}</Badge>
                      </div>
                    </Td>
                    <Td className="text-[11px] text-text-2">
                      {entry.reason ?? "—"}
                    </Td>
                    <Td className="text-[11px] text-text-2">
                      {entry.actorLabel ?? entry.actorUserId}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </ModalBody>
      </ModalCard>
    </ModalOverlay>
  );
}
