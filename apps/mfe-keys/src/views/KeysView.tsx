"use client";

import { useState } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import {
  Badge,
  Button,
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
  useToast,
} from "@platform/design-system";
import { markPropertyKeyReceived } from "../lib/keys-api";
import type { PropertyKeyRow } from "../lib/keys-types";
import {
  useInvalidatePropertyKeys,
  usePropertyKeysQuery,
} from "../query/keys-queries";

function deedStatusTone(status: string): "success" | "warning" | "danger" | "default" {
  const value = status.trim();
  if (value === "فعال") return "success";
  if (value === "قيد التحقق") return "warning";
  if (value === "موقوف" || value.includes("موقوف")) return "danger";
  return "default";
}

function keyFailureTone(
  state: PropertyKeyRow["keyFailureState"],
): "success" | "warning" | "danger" | "default" {
  if (state === "active") return "danger";
  if (state === "past") return "warning";
  if (state === "clear") return "success";
  return "default";
}

function KpiKeyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="5" />
      <path d="M11.5 11.5 21 21M17 17l2-2M14 14l2-2" />
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

export function KeysView() {
  const { showToast } = useToast();
  const { role } = usePrototype();
  const viewOnly = !isSuperAdmin(role) && role === "general-manager";
  const { data, isPending } = usePropertyKeysQuery();
  const kp = data?.keys ?? [];
  const courtDelegates = data?.courtDelegates ?? [];
  const invalidate = useInvalidatePropertyKeys();
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const received = kp.filter((p) => p.status === "done").length;
  const pending = Math.max(0, kp.length - received);
  const keyObstructions = kp.filter((p) => p.keyFailureState === "active").length;
  const ready = !isPending;

  async function handleReceive(id: string) {
    setReceivingId(id);
    const result = await markPropertyKeyReceived(id);
    setReceivingId(null);
    if (result.ok) {
      invalidate();
      showToast("تم تسجيل استلام المفتاح.", "success");
    } else {
      showToast(result.error, "error");
    }
  }

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <KpiBand>
        <KpiCell
          first
          icon={<KpiKeyIcon />}
          iconClass="bg-info-bg text-info-text"
          label="إجمالي المفاتيح"
          value={ready ? kp.length : "—"}
          sub="عقارات تحتاج مفاتيح"
          dot
        />
        <KpiCell
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,#2f9e6b_16%,transparent)] text-[#2f9e6b]"
          label="مستلمة"
          value={ready ? received : "—"}
          valueClass="!text-[#2f9e6b]"
          sub="تم تسجيل الاستلام"
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]"
          label="بانتظار الاستلام"
          value={ready ? pending : "—"}
          sub="لم تُستلم بعد"
        />
        <KpiCell
          last
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red"
          label="تعذرات مفاتيح"
          value={ready ? keyObstructions : "—"}
          valueClass="!text-red"
          sub="تحتاج معالجة"
        />
      </KpiBand>

      <OperationalPanel className="min-h-0 flex-1">
        <Table pending={!ready}>
          <THead>
            <Tr hoverable={false}>
              <Th>الصك</Th>
              <Th>حالة الصك</Th>
              <Th>المنطقة</Th>
              <Th>المحكمة</Th>
              <Th>حالة المفتاح</Th>
              <Th>تعذر المفتاح</Th>
              <Th>المندوب</Th>
              <Th>إجراء</Th>
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={5} cols={8} />
            ) : kp.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={8}>
                  <EmptyState line="لا توجد عقارات تحتاج مفاتيح حالياً" />
                </Td>
              </Tr>
            ) : (
              kp.map((p) => (
                <Tr key={p.id} hoverable={false}>
                  <Td className="text-[13px] font-medium text-primary">{p.deedNumber}</Td>
                  <Td>
                    {p.deedStatus && p.deedStatus !== "—" ? (
                      <Badge
                        tone={deedStatusTone(p.deedStatus)}
                        dot
                      >
                        {p.deedStatus}
                      </Badge>
                    ) : (
                      <span className="text-text-3">—</span>
                    )}
                  </Td>
                  <Td className="text-text-2">{p.area}</Td>
                  <Td className="text-text-2">{p.court}</Td>
                  <Td>
                    {p.status === "done" ? (
                      <Badge tone="success" dot>
                        مستلم
                      </Badge>
                    ) : (
                      <Badge tone="warning" dot>
                        بانتظار الاستلام
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <Badge
                      tone={keyFailureTone(p.keyFailureState)}
                      dot
                    >
                      {p.keyFailureLabel}
                    </Badge>
                  </Td>
                  <Td className="text-text-2">{p.delegate}</Td>
                  <Td>
                    {p.status === "done" || viewOnly ? (
                      "—"
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={receivingId === p.id}
                        disabled={receivingId !== null}
                        showActionToast={false}
                        onClick={() => void handleReceive(p.id)}
                      >
                        تسجيل الاستلام
                      </Button>
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
