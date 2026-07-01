"use client";



import { useState } from "react";

import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";

import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";

import {

  Badge,

  Button,

  EmptyState,

  OperationalPanel,

  PageShell,

  StatCard,

  StatGrid,

  StatLabel,

  StatSkeleton,

  StatValue,

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

    const updated = await markPropertyKeyReceived(id);

    setReceivingId(null);

    if (updated) {

      invalidate();

      showToast("تم تسجيل استلام المفتاح.", "success");

    } else {

      showToast("تعذّر تسجيل الاستلام.", "error");

    }

  }



  return (

    <PageShell variant="canvas" className="min-h-0 flex-1">

      <StatGrid cols={4}>

        {ready ? (

          <>

            <StatCard accent="blue">

              <StatLabel>إجمالي المفاتيح</StatLabel>

              <StatValue value={kp.length} countUp />

            </StatCard>

            <StatCard accent="green">

              <StatLabel>مستلمة</StatLabel>

              <StatValue value={received} countUp />

            </StatCard>

            <StatCard accent="warn">

              <StatLabel>بانتظار الاستلام</StatLabel>

              <StatValue value={pending} countUp />

            </StatCard>

            <StatCard accent="red">

              <StatLabel>تعذرات مفاتيح</StatLabel>

              <StatValue value={keyObstructions} countUp />

            </StatCard>

          </>

        ) : (

          Array.from({ length: 4 }, (_, index) => (

            <StatCard key={index} accent="gray">

              <StatSkeleton />

            </StatCard>

          ))

        )}

      </StatGrid>



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

                  <Td className="text-[11px] font-semibold text-primary">{p.deedNumber}</Td>

                  <Td>
                    {p.deedStatus && p.deedStatus !== "—" ? (
                      <Badge
                        tone={deedStatusTone(p.deedStatus)}
                        className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal"
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

                      <Badge

                        tone="success"

                        className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal"

                      >

                        مستلم

                      </Badge>

                    ) : (

                      <Badge

                        tone="warning"

                        className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal"

                      >

                        بانتظار الاستلام

                      </Badge>

                    )}

                  </Td>

                  <Td>
                    <Badge
                      tone={keyFailureTone(p.keyFailureState)}
                      className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal"
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

