"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listKeyEnvelopeFeeReport } from "@platform/api-client";
import { QueryErrorState, QueueTableHint, useSwapAnimation } from "@platform/ui-kit";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import { KeyEnvelopeFeesPanel } from "./KeyEnvelopeFeesPanelSlot";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
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
import { WaivePartyFeesPanel } from "./WaivePartyFeesPanel";
import { sortInspectorFeeRowsNewestFirst } from "@platform/app-shared/fees/party-fee-meta";
import { useCourtVisitFeesQuery } from "../../query/operations-tasks-queries";
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
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<PartyFeesTab>(
    isSupervisor ? "financial" : "action",
  );

  const feesQuery = useInspectorFeesQuery(
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
  const { data: summary, isLoading, isFetched } = feesQuery;
  const invalidateFees = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [...appDataKeys.all, "inspector-fees"],
    });
  }, [queryClient]);

  const rows = useMemo(
    () => sortInspectorFeeRowsNewestFirst(summary?.rows ?? []),
    [summary?.rows],
  );

  // Lines waiting for the supervisor — including engineering-office fees whose discount the
  // specialist proposed at acceptance (decided in this queue: approve / amend / waive).
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
  const suspendedRows = useMemo(
    () => rows.filter((r) => r.billingStatus === "suspended"),
    [rows],
  );

  const supervisorAttentionCount =
    supReviewRows.length + returnedToSup.length + suspendedRows.length;

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

  const { data: visitFees = [] } = useCourtVisitFeesQuery({
    enabled: isSupervisor,
  });
  const visitFeesOpen = useMemo(
    () => visitFees.filter((r) => r.status !== "settled").length,
    [visitFees],
  );

  const { data: keyFeesCount = 0 } = useQuery({
    queryKey: [...appDataKeys.keyEnvelopeFees(), "nav-count"],
    queryFn: async () => {
      const config = prototypeModulesApiConfig();
      if (!config) return 0;
      const result = await listKeyEnvelopeFeeReport(config);
      return result.ok ? result.data.length : 0;
    },
    enabled: isSupervisor,
    staleTime: 30_000,
  });

  // Supervisor tab bodies fade in on switch (the party lanes fade in their own screens).
  const supPanelRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(supPanelRef, tab);

  /*
   * One fees module, three party slots — never mix lanes:
   *   engineering-survey  → vendor (proposed discounts shown + invoice)
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
            { id: "fees", label: "الحسم والمراجعة", count: rows.length },
            {
              id: "statements",
              label: "كشوف الفوترة",
              count: issuedStatements.length,
            },
            { id: "visit-fees", label: "أتعاب الزيارة", count: visitFeesOpen },
            {
              id: "key-fees",
              label: "أتعاب استلام المفاتيح",
              count: keyFeesCount,
            },
          ]}
        />

        {queryLoadFailed(feesQuery) ? (
          <QueryErrorState
            className={opsLetterCard}
            line="تعذّر تحميل الأتعاب"
            hint="الأرقام والجداول أدناه غير مكتملة حتى يُعاد التحميل."
            onRetry={() => void feesQuery.refetch()}
            retrying={feesQuery.isFetching}
          />
        ) : null}

        <div ref={supPanelRef} className="flex flex-col gap-3.5">
          {supTab === "financial" ? (
            <div className="flex flex-col gap-3.5">
              {supReviewRows.length > 0 ? (
                <section className={opsLetterCard}>
                  <div className="px-4 pb-4 pt-1 sm:px-[18px]">
                    <EngFeesSectionTitle
                      className="mb-3 mt-3"
                      title="الواردة للاعتماد"
                      sub="أتعاب بانتظار قرارك قبل المالية — منها حسم اقترحه الأخصائي عند قبول مخرجات المكتب الهندسي: اعتمده أو عدّله أو اسمح به بعد مناقشة المكتب."
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
                      sub="أتعاب بانتظار قرارك قبل المالية — منها حسم اقترحه الأخصائي عند قبول مخرجات المكتب الهندسي: اعتمده أو عدّله أو اسمح به بعد مناقشة المكتب."
                    />
                    <QueueTableHint className="mt-1">
                      لا بنود واردة للاعتماد حالياً.
                    </QueueTableHint>
                  </div>
                </section>
              )}

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
            <section className={opsLetterCard}>
              <div className="px-4 pb-4 pt-1 sm:px-[18px]">
                <EngFeesSectionTitle
                  className="mb-3 mt-3"
                  title="الحسم والمراجعة"
                  sub="الحسم هنا نهائي ويُرسل البند للمالية ويُبلَّغ الطرف. لإلغاء أتعاب طرف عن معاملة كاملة استخدم الزر أدناه."
                />
                {/* Cancel one party's whole fee on a transaction (e.g. an operationally complete one). */}
                <WaivePartyFeesPanel rows={rows} onDone={invalidateFees} />
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
              </div>
            </section>
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
      </div>
    );
  }

  return null;
}
