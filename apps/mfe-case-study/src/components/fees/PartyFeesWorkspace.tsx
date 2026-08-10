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
import { SupervisorEnfazTracking } from "./SupervisorEnfazTracking";
import { CourtVisitFeesPanel } from "./CourtVisitFeesPanel";
import { PartyOfficeBillingStatementsPanel } from "./PartyOfficeBillingStatementsPanel";
import { EngFeesHtmlTabs, EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import { EngFeesHtmlScreen } from "./EngFeesHtmlScreen";
import { PartyIndividualFeesHtmlScreen } from "./PartyIndividualFeesHtmlScreen";
import {
  SUPERVISOR_ENG_SURVEY_PENDING_ACCEPT_KEY,
  SupervisorEngSurveyFeeAcceptPanel,
  loadSupervisorEngSurveyPendingAcceptRows,
} from "./SupervisorEngSurveyFeeAcceptPanel";
import { sortInspectorFeeRowsNewestFirst } from "@platform/app-shared/fees/party-fee-meta";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";

type PartyFeesTab =
  | "action"
  | "tracking"
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

  const isIndividualParty =
    variant === "field-inspection" || variant === "government-review";

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

  /*
   * One fees module, three party slots — never mix lanes:
   *   engineering-survey  → vendor (accept/dispute + invoice)
   *   field-inspection    → individual inspector (submit supervisor)
   *   government-review   → individual reviewer (+ visit/keys)
   */
  if (!isSupervisor && variant === "engineering-survey") {
    return <EngFeesHtmlScreen assigneeId={assigneeId} />;
  }
  if (!isSupervisor && isIndividualParty) {
    return (
      <PartyIndividualFeesHtmlScreen
        assigneeId={assigneeId}
        variant={variant}
      />
    );
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
                  sub="معاينة / مراجعة حكومية / أطراف — بانتظار اعتماد المشرف قبل المالية."
                />
                <PartyFeeWorkflowTable
                  rows={supReviewRows}
                  role="supervisor"
                />
              </section>
            ) : (
              <section>
                <EngFeesSectionTitle
                  title="الواردة للاعتماد"
                  sub="معاينة / مراجعة حكومية / أطراف — بانتظار اعتماد المشرف قبل المالية."
                />
                <QueueTableHint className="mt-1">
                  لا بنود واردة للاعتماد حالياً.
                </QueueTableHint>
              </section>
            )}

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

  return null;
}
