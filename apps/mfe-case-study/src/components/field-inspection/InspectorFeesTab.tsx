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
import { sortInspectorFeeRowsNewestFirst } from "@platform/app-shared/fees/party-fee-meta";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { InspectorFeesBillingTable } from "./InspectorFeesBillingTable";
import { PartyFeeWorkflowTable } from "../fees/PartyFeeWorkflowTable";

export type PartyFeesVariant =
  | "field-inspection"
  | "engineering-survey"
  | "government-review";

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
      "بعد إنجاز العمل ارفع المعاملة للمشرف. وعند جاهزيتها للصرف أنشئ «أمر صرف» من شاشة الاتعاب.",
    partyTypeColumn: "نوع المعاين",
    partyTypeEmployeeHint: "(عمولة)",
    emptyLine: "لا توجد أتعاب مسجّلة بعد.",
    emptyHint:
      "تظهر بعد اكتمال دراسة الحالة للصك، ثم توزيع/إنجاز المعاينة.",
    tableHint:
      "ملخص أتعاب كل العقارات المسندة إليك — ارفع للمشرف عند الإنجاز.",
    footer:
      "المعاين المتعاون له أتعاب لكل عقار؛ المعاين الموظف له عمولة يمنحها المشرف. كل حسم يتطلب سبباً موضحاً.",
  },
  "engineering-survey": {
    title: "أتعاب المكتب الهندسي",
    intro:
      "تُستحق الأتعاب عند قبول الأخصائي للمخرجات. راجع الكشف المبدئي للموافقة على الحسم أو الاعتراض؛ البنود بسعر الجدول تظهر في الجاهزة للفوترة.",
    partyTypeColumn: "نوع المكتب",
    partyTypeEmployeeHint: "(خارجي)",
    emptyLine: "لا توجد أتعاب مسجّلة بعد.",
    emptyHint:
      "تظهر بعد قبول الأخصائي لمخرجات الرفع المساحي.",
    tableHint:
      "ملخص أتعاب رفوعاتك — الكشف المبدئي للمراجعة، ثم الجاهزة للفوترة.",
    footer:
      "المكتب الهندسي جهة خارجية — الأتعاب مقابل الرفوعات المقبولة. لا يُنشأ أمر صرف من مسار المكتب؛ الفوترة لاحقاً عبر كشف المكتب.",
  },
  "government-review": {
    title: "أتعاب المراجعة الحكومية",
    intro:
      "بعد إنجاز المراجعة ارفع المعاملة للمشرف. وعند جاهزيتها للصرف أنشئ «أمر صرف» من شاشة الاتعاب.",
    partyTypeColumn: "نوع المراجع",
    partyTypeEmployeeHint: "(متعاون فرد)",
    emptyLine: "لا توجد أتعاب مسجّلة بعد.",
    emptyHint:
      "تظهر بعد اكتمال دراسة الحالة للصك، ثم توزيع/إنجاز المراجعة الحكومية.",
    tableHint:
      "ملخص أتعاب كل العقارات المسندة إليك — ارفع للمشرف عند الإنجاز.",
    footer:
      "تصنيف المراجع الحكومي: متعاون فرد فقط. القيمة الافتراضية قابلة للتغيير من إعدادات المالية، ولكل سجل على حدة.",
  },
};

const SUPERVISOR_COPY = {
  title: "مراجعة الأتعاب والصرف",
  intro:
    "راجع الأتعاب والحسومات لكل العقارات. الاعتماد والإرسال للمالية من تبويب «الأمور المالية» في شاشة الاتعاب.",
  emptyLine: "لا توجد أتعاب مسجّلة بعد.",
  emptyHint: "تظهر هنا بعد اكتمال دراسة الحالة وتوزيع مهام الأطراف (معاينة / رفع / مراجعة).",
  tableHint: "جميع أتعاب الأطراف — الحسم هنا؛ الاعتماد من «الأمور المالية».",
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

  const rows = sortInspectorFeeRowsNewestFirst(summary?.rows ?? []);
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
          isSupervisor ? (
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
          ) : (
            <PartyFeeWorkflowTable
              rows={rows}
              role="office"
              pending={queuePending}
            />
          )
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
          <StatLabel>مسودة / مُعاد (ر.س)</StatLabel>
          <StatValue value={summary?.netDraftSar ?? 0} countUp />
        </StatCard>
        {isSupervisor ? (
          <StatCard accent="blue" flush>
            <StatLabel>بانتظار الاعتماد (ر.س)</StatLabel>
            <StatValue value={summary?.supReviewSar ?? 0} countUp />
          </StatCard>
        ) : null}
        <StatCard accent="red" flush>
          <StatLabel>إجمالي الحسومات (ر.س)</StatLabel>
          <StatValue value={summary?.totalDiscountsSar ?? 0} countUp />
        </StatCard>
        <StatCard accent="blue" flush>
          <StatLabel>مصروف (ر.س)</StatLabel>
          <StatValue value={summary?.disbursedSar ?? 0} countUp />
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
        ) : isSupervisor ? (
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
        ) : (
          <PartyFeeWorkflowTable rows={rows} role="office" />
        )}

        <p className="mt-3.5 text-[11px] leading-relaxed text-text-3">
          {copy.footer}
        </p>
      </OperationalPanel>
    </div>
  );
}
