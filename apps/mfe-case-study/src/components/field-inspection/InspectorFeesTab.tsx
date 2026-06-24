"use client";

import {
  Badge,
  EmptyState,
  OperationalPanel,
  QueueTableHint,
  StatCard,
  StatGrid,
  StatLabel,
  StatValue,
} from "@platform/design-system";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { InspectorFeesBillingTable } from "./InspectorFeesBillingTable";

export type PartyFeesVariant = "field-inspection" | "engineering-survey";

const COPY: Record<
  PartyFeesVariant,
  {
    title: string;
    intro: string;
    partyTypeColumn: string;
    partyTypeEmployeeHint: string;
    emptyLine: string;
    emptyHint: string;
    tableHint: string;
    footer: string;
  }
> = {
  "field-inspection": {
    title: "أتعاب المعاين",
    intro:
      "الأتعاب متفق عليها مسبقاً أو تُحدَّد قبل الفوترة — لا تُدخل ضمن المعاينة الميدانية. تُراجَع هنا قبل اعتماد الفاتورة.",
    partyTypeColumn: "نوع المعاين",
    partyTypeEmployeeHint: "(عمولة)",
    emptyLine: "لا توجد أتعاب مسجّلة بعد.",
    emptyHint:
      "تظهر هنا بعد توزيع مهمة المعاينة وإرسال المعاينة الميدانية.",
    tableHint:
      "ملخص أتعاب كل العقارات المسندة إليك — يحددها المشرف قبل الفوترة.",
    footer:
      "المعاين المتعاون له أتعاب لكل عقار؛ المعاين الموظف له عمولة يمنحها المشرف وتكون أقل بكثير. كل حسم يجب أن يكون مصحوباً بسبب موضّح.",
  },
  "engineering-survey": {
    title: "أتعاب المكتب الهندسي",
    intro:
      "الأتعاب متفق عليها مسبقاً أو تُحدَّد قبل الفوترة — لا تُدخل ضمن الرفع المساحي. تُراجَع هنا قبل اعتماد الفاتورة.",
    partyTypeColumn: "نوع المكتب",
    partyTypeEmployeeHint: "(داخلي)",
    emptyLine: "لا توجد أتعاب مسجّلة بعد.",
    emptyHint:
      "تظهر هنا بعد توزيع مهمة الرفع المساحي وإرسال التقرير المساحي.",
    tableHint:
      "ملخص أتعاب كل العقارات المسندة إليك — يحددها المشرف قبل الفوترة.",
    footer:
      "المكتب المتعاقد له أتعاب لكل عقار؛ المكتب الداخلي له أتعاب أقل يحددها المشرف. كل حسم يجب أن يكون مصحوباً بسبب موضّح.",
  },
};

const SUPERVISOR_COPY = {
  title: "مراجعة الأتعاب والفوترة",
  intro:
    "راجع الأتعاب والحسومات لكل العقارات، ثم أرسل الجاهزة للمالية. الاستبعاد المؤقت لا يغيّر حالة الفوترة.",
  emptyLine: "لا توجد أتعاب مسجّلة بعد.",
  emptyHint: "تظهر هنا بعد توزيع مهام المعاينة أو الرفع المساحي.",
  tableHint: "جميع أتعاب المعاينة والرفع المساحي — تعديل الحسم والاستبعاد قبل الإرسال للمالية.",
  footer:
    "بعد الإرسال للمالية تُقفل التعديلات حتى يُعاد السجل باعتراض. كل حسم يتطلب سبباً موضحاً.",
  partyTypeColumn: "نوع الطرف",
  partyTypeEmployeeHint: "",
};

export function InspectorFeesTab({
  tasks,
  variant = "field-inspection",
  assigneeId: assigneeIdProp,
  standalone = false,
  supervisorMode = false,
}: {
  tasks: WorkflowTask[];
  poByNumber?: Map<string, unknown>;
  variant?: PartyFeesVariant;
  assigneeId?: string | null;
  standalone?: boolean;
  supervisorMode?: boolean;
}) {
  const { hasCapability } = usePrototype();
  const isSupervisor =
    supervisorMode || hasCapability("manage-operations");
  const copy = isSupervisor ? SUPERVISOR_COPY : COPY[variant];
  const singleTask = tasks.length === 1 ? tasks[0] : undefined;
  const assigneeId = isSupervisor
    ? undefined
    : assigneeIdProp?.trim() || tasks[0]?.assigneeId?.trim() || undefined;

  const { data: summary, isLoading, isFetched } = useInspectorFeesQuery(
    {
      workflowTaskId: singleTask?.id,
      assigneeId: singleTask ? undefined : assigneeId,
      submittedOnly: !isSupervisor && !standalone && !singleTask,
      taskKind: isSupervisor ? undefined : variant,
    },
    {
      enabled: isSupervisor || Boolean(singleTask?.id || assigneeId),
    },
  );

  const rows = summary?.rows ?? [];
  const queueReady = isFetched;
  const queuePending = !queueReady;
  const billingMode = isSupervisor ? "supervisor" : "readonly";

  if (standalone) {
    return (
      <div className="flex min-h-0 flex-col gap-3 px-4 py-4">
        {isSupervisor ? (
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface-2/50 px-4 py-3">
            <h2 className="text-sm font-semibold text-text">{copy.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-3">{copy.intro}</p>
          </div>
        ) : null}
        {queueReady && rows.length === 0 ? (
          <EmptyState line={copy.emptyLine} hint={copy.emptyHint} />
        ) : (
          <InspectorFeesBillingTable
            rows={rows}
            mode={billingMode}
            pending={queuePending}
            partyTypeColumn={
              isSupervisor
                ? SUPERVISOR_COPY.partyTypeColumn
                : COPY[variant].partyTypeColumn
            }
            partyTypeEmployeeHint={
              isSupervisor ? "" : COPY[variant].partyTypeEmployeeHint
            }
          />
        )}
        <QueueTableHint>{copy.tableHint}</QueueTableHint>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-text">{copy.title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-text-3">{copy.intro}</p>
      </div>

      <StatGrid cols={isSupervisor ? 4 : 3} flush>
        <StatCard accent="green" flush>
          <StatLabel>صافي قبل الفوترة (ر.س)</StatLabel>
          <StatValue value={summary?.netPreBillingSar ?? 0} countUp />
        </StatCard>
        {isSupervisor ? (
          <StatCard accent="blue" flush>
            <StatLabel>جاهزة للفوترة (ر.س)</StatLabel>
            <StatValue value={summary?.readyForBillingSar ?? 0} countUp />
          </StatCard>
        ) : null}
        <StatCard accent="red" flush>
          <StatLabel>إجمالي الحسومات (ر.س)</StatLabel>
          <StatValue value={summary?.totalDiscountsSar ?? 0} countUp />
        </StatCard>
        <StatCard accent="blue" flush>
          <StatLabel>مفوتر (ر.س)</StatLabel>
          <StatValue value={summary?.invoicedSar ?? 0} countUp />
        </StatCard>
      </StatGrid>

      <OperationalPanel className="min-h-0 flex-1">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-text">أتعاب العقارات</h3>
          <Badge tone="default">
            {isSupervisor ? "مراجعة المشرف" : "يحددها المشرف"}
          </Badge>
        </div>

        {isLoading ? (
          <p className="text-xs text-text-3">جاري تحميل الأتعاب…</p>
        ) : rows.length === 0 ? (
          <EmptyState line={copy.emptyLine} hint={copy.emptyHint} />
        ) : (
          <InspectorFeesBillingTable
            rows={rows}
            mode={billingMode}
            partyTypeColumn={
              isSupervisor
                ? SUPERVISOR_COPY.partyTypeColumn
                : COPY[variant].partyTypeColumn
            }
            partyTypeEmployeeHint={
              isSupervisor ? "" : COPY[variant].partyTypeEmployeeHint
            }
          />
        )}

        <p className="mt-3.5 text-[11px] leading-relaxed text-text-3">
          {copy.footer}
        </p>
      </OperationalPanel>
    </div>
  );
}
