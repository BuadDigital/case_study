"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { QueueTableHint } from "@platform/ui-kit";
import { KeyEnvelopeFeesPanel } from "./KeyEnvelopeFeesPanelSlot";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { loadPartyBillingStatements } from "@platform/app-shared/app-data/party-billing-statements-api";
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
import { opsLetterCard } from "../../lib/app-data/ops-tasks-tw";

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
  variant: "field-inspection" | "engineering-survey" | "court-visit";
  assigneeId?: string;
  isSupervisor: boolean;
}) {
  const { hasCapability } = useAppAccess();
  const [tab, setTab] = useState<PartyFeesTab>(
    isSupervisor ? "financial" : "action",
  );

  const { data: summary, isLoading, isFetched } = useInspectorFeesQuery(
    {
      assigneeId: isSupervisor ? undefined : assigneeId,
      submittedOnly: false,
      taskKind: isSupervisor
        ? undefined
        : variant === "court-visit"
          ? undefined
          : variant,
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
    variant === "field-inspection" || variant === "court-visit";

  const { data: issuedStatements = [] } = useQuery({
    queryKey: [
      ...appDataKeys.all,
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
   *   court-visit         → individual reviewer (+ visit fees)
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
      <div className="flex flex-col gap-3.5">
        <EngFeesHtmlTabs
          className="!mb-0"
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
          <div className="flex flex-col gap-3.5">
            <section className={opsLetterCard}>
              <div className="px-4 pb-4 pt-1 sm:px-[18px]">
                <EngFeesSectionTitle
                  className="mb-3 mt-3"
                  title="قبول مخرجات الرفع المساحي"
                  sub="استحقاق أتعاب المكتب يبدأ بعد قبول المخرجات المرسلة (سعر جدول التسعير)."
                />
                <SupervisorEngSurveyFeeAcceptPanel />
              </div>
            </section>

            {supReviewRows.length > 0 ? (
              <section className={opsLetterCard}>
                <div className="px-4 pb-4 pt-1 sm:px-[18px]">
                  <EngFeesSectionTitle
                    className="mb-3 mt-3"
                    title="الواردة للاعتماد"
                    sub="معاينة / مراجعة حكومية / أطراف — بانتظار اعتماد المشرف قبل المالية."
                    count={supReviewRows.length}
                  />
                  <PartyFeeWorkflowTable
                    rows={supReviewRows}
                    role="supervisor"
                  />
                </div>
              </section>
            ) : (
              <section className={opsLetterCard}>
                <div className="px-4 pb-4 pt-1 sm:px-[18px]">
                  <EngFeesSectionTitle
                    className="mb-3 mt-3"
                    title="الواردة للاعتماد"
                    sub="معاينة / مراجعة حكومية / أطراف — بانتظار اعتماد المشرف قبل المالية."
                  />
                  <QueueTableHint className="mt-1">
                    لا بنود واردة للاعتماد حالياً.
                  </QueueTableHint>
                </div>
              </section>
            )}

            {disputedRows.length > 0 ? (
              <section className={opsLetterCard}>
                <div className="px-4 pb-4 pt-1 sm:px-[18px]">
                  <EngFeesSectionTitle
                    className="mb-3 mt-3"
                    title="خلاف تسعير (مكتب هندسي)"
                    sub="تحفّظات المكتب قيد المعالجة."
                    count={disputedRows.length}
                  />
                  <PartyFeeWorkflowTable rows={disputedRows} role="supervisor" />
                </div>
              </section>
            ) : null}

            {suspendedRows.length > 0 ? (
              <section className={opsLetterCard}>
                <div className="px-4 pb-4 pt-1 sm:px-[18px]">
                  <EngFeesSectionTitle
                    className="mb-3 mt-3"
                    title="الموقوفة"
                    sub="بنود معلّقة بقرار المشرف."
                    count={suspendedRows.length}
                  />
                  <PartyFeeWorkflowTable
                    rows={suspendedRows}
                    role="supervisor"
                  />
                </div>
              </section>
            ) : null}

            {returnedToSup.length > 0 ? (
              <section className={opsLetterCard}>
                <div className="px-4 pb-4 pt-1 sm:px-[18px]">
                  <EngFeesSectionTitle
                    className="mb-3 mt-3"
                    title="المُعاد من المالية"
                    sub="بنود أعادتها المالية للمعالجة."
                    count={returnedToSup.length}
                  />
                  <PartyFeeWorkflowTable
                    rows={returnedToSup}
                    role="supervisor"
                  />
                </div>
              </section>
            ) : null}

            <section className={opsLetterCard}>
              <div className="px-4 pb-4 pt-1 sm:px-[18px]">
                <EngFeesSectionTitle
                  className="mb-3 mt-3"
                  title="متابعة فوترة إنفاذ"
                  sub="حالة أوامر العمل لدى إنفاذ."
                />
                <SupervisorEnfazTracking />
              </div>
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
