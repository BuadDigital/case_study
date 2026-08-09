"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { QueueTableHint } from "@platform/design-system";
import { KeyEnvelopeFeesPanel } from "@keys/mfe/components/KeyEnvelopeFeesPanel";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadPartyBillingStatements } from "@platform/app-shared/prototype/party-billing-statements-api";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import { InspectorFeesBillingTable } from "../field-inspection/InspectorFeesBillingTable";
import { PartyFeeWorkflowTable } from "./PartyFeeWorkflowTable";
import {
  EngOfficeFeesBillingTable,
  engFeeUiStatus,
} from "./EngOfficeFeesBillingTable";
import { SupervisorEnfazTracking } from "./SupervisorEnfazTracking";
import { CourtVisitFeesPanel } from "./CourtVisitFeesPanel";
import { PartyOfficeBillingStatementsPanel } from "./PartyOfficeBillingStatementsPanel";
import { EngFeesHtmlTabs, EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import { EngFeesHtmlScreen } from "./EngFeesHtmlScreen";
import {
  SUPERVISOR_ENG_SURVEY_PENDING_ACCEPT_KEY,
  SupervisorEngSurveyFeeAcceptPanel,
  loadSupervisorEngSurveyPendingAcceptRows,
} from "./SupervisorEngSurveyFeeAcceptPanel";
import { sortInspectorFeeRowsNewestFirst } from "@platform/app-shared/fees/party-fee-meta";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";

type PartyFeesTab =
  | "action"
  | "ready"
  | "statements"
  | "visit-fees"
  | "key-fees"
  | "financial"
  | "fees";

export function PartyFeesWorkspace({
  variant,
  assigneeId,
  isSupervisor,
}: {
  variant: "field-inspection" | "engineering-survey" | "government-review";
  assigneeId?: string;
  isSupervisor: boolean;
}) {
  const { hasCapability } = usePrototype();
  const [tab, setTab] = useState<PartyFeesTab>(
    isSupervisor ? "financial" : "action",
  );

  const { data: summary, isLoading, isFetched } = useInspectorFeesQuery(
    {
      assigneeId: isSupervisor ? undefined : assigneeId,
      submittedOnly: false,
      taskKind: isSupervisor ? undefined : variant,
    },
    { enabled: isSupervisor || Boolean(assigneeId) },
  );

  const { data: tasks } = useWorkflowTasksQuery();
  const { data: engAcceptPending = [] } = useQuery({
    queryKey: SUPERVISOR_ENG_SURVEY_PENDING_ACCEPT_KEY,
    queryFn: () => loadSupervisorEngSurveyPendingAcceptRows(tasks ?? []),
    enabled: isSupervisor && Boolean(tasks && tasks.length > 0),
    staleTime: 15_000,
  });

  const rows = useMemo(
    () => sortInspectorFeeRowsNewestFirst(summary?.rows ?? []),
    [summary?.rows],
  );

  const supReviewRows = useMemo(
    () => rows.filter((r) => r.billingStatus === "sup-review"),
    [rows],
  );
  const returnedToSup = useMemo(
    () =>
      rows.filter(
        (r) => r.billingStatus === "returned" && r.returnTo === "supervisor",
      ),
    [rows],
  );
  const disputedRows = useMemo(
    () => rows.filter((r) => r.billingStatus === "disputed"),
    [rows],
  );
  const suspendedRows = useMemo(
    () => rows.filter((r) => r.billingStatus === "suspended"),
    [rows],
  );

  const supervisorAttentionCount =
    engAcceptPending.length +
    supReviewRows.length +
    returnedToSup.length +
    disputedRows.length +
    suspendedRows.length;

  const actionCount = useMemo(
    () =>
      rows.filter((r) => {
        const st = engFeeUiStatus(r);
        if (st === "pending_office" || st === "dispute") return true;
        return (
          (r.billingStatus === "returned" || r.billingStatus === "inquiry") &&
          r.returnTo === "office"
        );
      }).length,
    [rows],
  );
  const readyCount = useMemo(
    () =>
      rows.filter((r) => {
        const st = engFeeUiStatus(r);
        return st === "ready" || st === "carried";
      }).length,
    [rows],
  );

  const { data: issuedStatements = [] } = useQuery({
    queryKey: [
      ...prototypeKeys.all,
      "party-billing",
      "statements",
      assigneeId ?? (isSupervisor ? "all" : "none"),
      "issued+",
    ],
    queryFn: () =>
      loadPartyBillingStatements({
        assigneeId: isSupervisor ? undefined : assigneeId,
        issuedOrLaterOnly: true,
      }),
    enabled: isSupervisor || Boolean(assigneeId),
  });

  const showVisitAndKeyFees =
    variant === "government-review" || isSupervisor;

  /* Case Study.html `renderEngFees` — exact port for engineering office */
  if (!isSupervisor && variant === "engineering-survey") {
    return <EngFeesHtmlScreen assigneeId={assigneeId} />;
  }

  if (isSupervisor) {
    const supTab: PartyFeesTab =
      tab === "fees" ||
      tab === "statements" ||
      tab === "visit-fees" ||
      tab === "key-fees"
        ? tab
        : "financial";

    return (
      <div className="px-[30px] pb-11 pt-[26px]">
        <EngFeesHtmlTabs
          className="!mb-4 !mt-0"
          active={supTab}
          onChange={(id) => setTab(id as PartyFeesTab)}
          tabs={[
            {
              id: "financial",
              label: "الأمور المالية",
              count: supervisorAttentionCount,
              countWarnWhenActive: true,
            },
            { id: "fees", label: "الحسم والمراجعة" },
            {
              id: "statements",
              label: "كشوف الفوترة",
              count: issuedStatements.length,
            },
            { id: "visit-fees", label: "أتعاب الزيارة" },
            { id: "key-fees", label: "أتعاب استلام المفاتيح" },
          ]}
        />

        {supTab === "financial" ? (
          <div className="flex flex-col gap-0">
            <section>
              <EngFeesSectionTitle
                title="قبول مخرجات الرفع المساحي"
                sub="استحقاق أتعاب المكتب يبدأ بعد قبول المخرجات المرسلة (سعر جدول التسعير)."
              />
              <SupervisorEngSurveyFeeAcceptPanel />
            </section>

            {supReviewRows.length > 0 ? (
              <section>
                <EngFeesSectionTitle
                  title="الواردة للاعتماد"
                  sub="بنود بانتظار اعتماد المشرف قبل المسار المالي."
                />
                <PartyFeeWorkflowTable
                  rows={supReviewRows}
                  role="supervisor"
                />
              </section>
            ) : null}

            {disputedRows.length > 0 ? (
              <section>
                <EngFeesSectionTitle
                  title="خلاف تسعير (مكتب هندسي)"
                  sub="تحفّظات المكتب قيد المعالجة."
                />
                <PartyFeeWorkflowTable rows={disputedRows} role="supervisor" />
              </section>
            ) : null}

            {suspendedRows.length > 0 ? (
              <section>
                <EngFeesSectionTitle
                  title="الموقوفة"
                  sub="بنود معلّقة بقرار المشرف."
                />
                <PartyFeeWorkflowTable
                  rows={suspendedRows}
                  role="supervisor"
                />
              </section>
            ) : null}

            {returnedToSup.length > 0 ? (
              <section>
                <EngFeesSectionTitle
                  title="المُعاد من المالية"
                  sub="بنود أعادتها المالية للمعالجة."
                />
                <PartyFeeWorkflowTable
                  rows={returnedToSup}
                  role="supervisor"
                />
              </section>
            ) : null}

            <section>
              <EngFeesSectionTitle
                title="متابعة فوترة إنفاذ"
                sub="حالة أوامر العمل لدى إنفاذ."
              />
              <SupervisorEnfazTracking />
            </section>
          </div>
        ) : null}

        {supTab === "fees" ? (
          <>
            <EngFeesSectionTitle
              title="الحسم والمراجعة"
              sub="الحسم هنا — للمكتب الهندسي: الخصم يُرسل لموافقة المكتب قبل المالية."
            />
            <div className="hidden lg:block">
              <InspectorFeesBillingTable
                rows={rows}
                mode="supervisor"
                pending={isLoading && !isFetched}
              />
            </div>
            <div className="lg:hidden">
              <PartyFeeWorkflowTable
                rows={rows}
                role="supervisor"
                pending={isLoading && !isFetched}
              />
            </div>
          </>
        ) : null}

        {supTab === "statements" ? (
          <PartyOfficeBillingStatementsPanel issuedOrLaterOnly />
        ) : null}

        {supTab === "visit-fees" ? (
          <CourtVisitFeesPanel creditAssigneeId={undefined} />
        ) : null}

        {supTab === "key-fees" ? (
          <>
            <KeyEnvelopeFeesPanel
              canCollect={hasCapability("manage-financial")}
              onOpenEnvelope={(envelopeId) => {
                window.location.assign(
                  `/keys?envelope=${encodeURIComponent(envelopeId)}`,
                );
              }}
            />
            <QueueTableHint className="mt-3">
              أتعاب استلام ظرف المفاتيح (سيناريو المحكمة + صورة). التفاصيل من{" "}
              <Link
                href="/keys?tab=fees"
                className="font-semibold text-primary underline underline-offset-2"
              >
                إدارة المفاتيح → تقرير الأتعاب
              </Link>
              .
            </QueueTableHint>
          </>
        ) : null}
      </div>
    );
  }

  const partyTab: PartyFeesTab =
    tab === "ready" ||
    tab === "statements" ||
    tab === "visit-fees" ||
    tab === "key-fees"
      ? tab
      : "action";

  const partyTabs = [
    {
      id: "action",
      label: "تتطلب إجراءكم",
      count: actionCount,
      countWarnWhenActive: true,
    },
    {
      id: "ready",
      label: "جاهزة للفوترة",
      count: readyCount,
    },
    {
      id: "statements",
      label: "كشوف الفوترة الصادرة",
      count: issuedStatements.length,
    },
    ...(showVisitAndKeyFees
      ? [
          { id: "visit-fees", label: "أتعاب الزيارة" },
          { id: "key-fees", label: "أتعاب استلام المفاتيح" },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-0 px-3 pb-3 sm:px-4 sm:pb-4">
      <EngFeesHtmlTabs
        active={partyTab}
        onChange={(id) => setTab(id as PartyFeesTab)}
        tabs={partyTabs}
      />

      {partyTab === "action" ? (
        <EngOfficeFeesBillingTable
          rows={rows}
          tab="action"
          pending={isLoading && !isFetched}
        />
      ) : null}

      {partyTab === "ready" ? (
        <>
          <EngFeesSectionTitle
            title="المعاملات الجاهزة للفوترة"
            sub="بنود مستحقة بانتظار كشف المحاسب نهاية الشهر — تشمل المرحَّلة من أشهر سابقة."
          />
          <EngOfficeFeesBillingTable
            rows={rows}
            tab="ready"
            pending={isLoading && !isFetched}
          />
        </>
      ) : null}

      {partyTab === "statements" ? (
        <PartyOfficeBillingStatementsPanel
          assigneeId={assigneeId}
          issuedOrLaterOnly
        />
      ) : null}

      {partyTab === "visit-fees" && showVisitAndKeyFees ? (
        <CourtVisitFeesPanel creditAssigneeId={assigneeId} />
      ) : null}

      {partyTab === "key-fees" && showVisitAndKeyFees ? (
        <>
          <KeyEnvelopeFeesPanel
            canCollect={hasCapability("manage-financial")}
            onOpenEnvelope={(envelopeId) => {
              window.location.assign(
                `/keys?envelope=${encodeURIComponent(envelopeId)}`,
              );
            }}
          />
          <QueueTableHint className="mt-3">
            أتعاب استلام ظرف المفاتيح (سيناريو المحكمة + صورة). التفاصيل من{" "}
            <Link
              href="/keys?tab=fees"
              className="font-semibold text-primary underline underline-offset-2"
            >
              إدارة المفاتيح → تقرير الأتعاب
            </Link>
            .
          </QueueTableHint>
        </>
      ) : null}
    </div>
  );
}
