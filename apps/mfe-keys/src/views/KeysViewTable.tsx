"use client";

/** The envelope list: desktop table (`keyDrawList`) and the mobile card stack. */
import {
  SkeletonTableRows,
  Table,
  TableFrame,
  TBody,
  Td,
  TdAction,
  TdLtr,
  Th,
  ThAction,
  THead,
  Tr,
  cn,
} from "@platform/ui-kit";
import {
  ActiveQueueMobileCards,
  type ActiveQueueMobileCardItem,
} from "@platform/app-shared/components/ActiveQueueMobileCards";
import { KeysEmpty, KeysStatusPill } from "../components/KeysHtmlPrimitives";
import {
  envelopeDisplayRef,
  envelopeStatusColor,
  envelopeStatusLabel,
  isEnvelopeOutOfCustody,
  scenarioColor,
  scenarioLabel,
  type KeyEnvelopeRow,
} from "../lib/keys-envelope-types";

function ChevronIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function MismatchIcon() {
  return (
    <span
      title="تعارض في العدد"
      className="ms-1.5 inline-grid size-[18px] place-items-center rounded-full"
      style={{
        background: "color-mix(in srgb, #d9694f 15%, transparent)",
        color: "#c0553d",
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
    </span>
  );
}

export function KeysViewTable({
  ready,
  rows,
  canRegisterEnvelope,
  onOpen,
  onRequestDelete,
}: {
  ready: boolean;
  rows: KeyEnvelopeRow[];
  canRegisterEnvelope: boolean;
  onOpen: (id: string) => void;
  onRequestDelete: (env: KeyEnvelopeRow) => void;
}) {
  return (
    <TableFrame className="hidden lg:block">
      <Table className="min-w-[960px]" pending={!ready}>
        <THead>
          <Tr hoverable={false}>
            <Th>الرقم المرجعي</Th>
            <Th>المحكمة / الدائرة</Th>
            <Th className="text-center">عدد المفاتيح</Th>
            <Th>رقم الطلب</Th>
            <Th className="text-center">الصكوك</Th>
            <Th>سيناريو الاستلام</Th>
            <Th>العهدة</Th>
            <ThAction aria-hidden />
          </Tr>
        </THead>
        <TBody>
          {!ready ? (
            <SkeletonTableRows rows={6} cols={8} />
          ) : rows.length === 0 ? (
            <Tr hoverable={false}>
              <Td colSpan={8} className="!border-b-0 !p-0">
                <KeysEmpty
                  title="لا توجد ظروف مطابقة"
                  sub="جرّب تعديل البحث أو الفلاتر"
                />
              </Td>
            </Tr>
          ) : (
            rows.map((env) => {
              const out = isEnvelopeOutOfCustody(env.status);
              return (
                <Tr
                  key={env.id}
                  className={cn(
                    "[content-visibility:auto] [contain-intrinsic-size:auto_120px]",
                    out && "opacity-55 saturate-[0.6]",
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(env.id)}
                  onContextMenu={(e) => {
                    if (!canRegisterEnvelope) return;
                    e.preventDefault();
                    onRequestDelete(env);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(env.id);
                    }
                  }}
                >
                  <TdLtr bare className="text-[13.5px] font-bold text-gold-d">
                    {envelopeDisplayRef(
                      env.id,
                      env.createdAtUtc,
                      env.referenceNumber,
                    )}
                  </TdLtr>
                  <Td>
                    <div className="flex min-w-0 flex-col items-start gap-0.5">
                      <span className="text-[13px] font-semibold text-heading">
                        {env.court || "—"}
                      </span>
                      <span className="text-[11px] text-text-3">
                        {env.circuit || "—"}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-center">
                    <span className="inline-flex items-center text-[14px] font-extrabold tabular-nums text-heading">
                      {env.keysCountActual}
                      {env.countMismatch ? <MismatchIcon /> : null}
                    </span>
                  </Td>
                  <TdLtr bare className="font-semibold text-text-2">
                    {env.requestNumber || "—"}
                  </TdLtr>
                  <Td className="text-center">
                    <span className="text-[13.5px] font-bold tabular-nums text-text-2">
                      {env.assignments.length}
                    </span>
                  </Td>
                  <Td>
                    <KeysStatusPill
                      label={scenarioLabel(env.receiveScenario)}
                      color={scenarioColor(env.receiveScenario)}
                    />
                  </Td>
                  <Td>
                    <KeysStatusPill
                      label={envelopeStatusLabel(env.status)}
                      color={envelopeStatusColor(env.status)}
                    />
                  </Td>
                  <TdAction className="text-text-3">
                    <ChevronIcon />
                  </TdAction>
                </Tr>
              );
            })
          )}
        </TBody>
      </Table>
    </TableFrame>
  );
}

/** Mobile cards — inspector wording. */
export function KeysViewMobileCards({
  ready,
  items,
}: {
  ready: boolean;
  items: ActiveQueueMobileCardItem[];
}) {
  return (
    <div className="lg:hidden">
      <ActiveQueueMobileCards
        items={items}
        pending={!ready}
        emptyMessage="لا توجد ظروف مطابقة"
      />
    </div>
  );
}
