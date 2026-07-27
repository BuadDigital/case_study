"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  EmptyState,
  QueueTableHint,
  Tab,
  TabBar,
  TabPanel,
} from "@platform/design-system";
import { KeyEnvelopeFeesPanel } from "@keys/mfe/components/KeyEnvelopeFeesPanel";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadEngBillingStatements } from "@platform/app-shared/prototype/eng-billing-statements-api";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import { InspectorFeesBillingTable } from "../field-inspection/InspectorFeesBillingTable";
import { PartyFeeWorkflowTable } from "./PartyFeeWorkflowTable";
import { EngOfficeFeesBillingTable, engFeeUiStatus } from "./EngOfficeFeesBillingTable";
import { PartyDisbursementRequest } from "./PartyDisbursementRequest";
import { PartyReturnedQueue } from "./PartyReturnedQueue";
import { SupervisorEnfazTracking } from "./SupervisorEnfazTracking";
import { CourtVisitFeesPanel } from "./CourtVisitFeesPanel";
import { EngOfficeBillingStatementsPanel } from "./EngOfficeBillingStatementsPanel";
import {
  EngFeesHtmlTabs,
  EngFeesSectionTitle,
} from "./EngFeesHtmlTabs";
import { PartyPropertyBrowse } from "@platform/app-shared/fees/PartyPropertyBrowse";
import {
  resolvePartyCategory,
  resolvePartyName,
  sortInspectorFeeRowsNewestFirst,
} from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";

type PartyFeesTab =
  | "fees"
  | "preliminary"
  | "statements"
  | "visit-fees"
  | "key-fees"
  | "disburse"
  | "returned"
  | "financial"
  | "browse"
  | "action"
  | "ready";

type EngFeesTab = "action" | "ready" | "statements";

export function PartyFeesWorkspace({
  variant,
  assigneeId,
  isSupervisor,
}: {
  variant: "field-inspection" | "engineering-survey" | "government-review";
  assigneeId?: string;
  isSupervisor: boolean;
}) {
  const isEngineering = variant === "engineering-survey";
  const [tab, setTab] = useState<PartyFeesTab>(
    isSupervisor ? "financial" : isEngineering ? "action" : "fees",
  );
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

  const { data: summary, isLoading, isFetched } = useInspectorFeesQuery(
    {
      assigneeId: isSupervisor ? undefined : assigneeId,
      submittedOnly: false,
      taskKind: isSupervisor ? undefined : variant,
    },
    { enabled: isSupervisor || Boolean(assigneeId) },
  );

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

  const engActionCount = useMemo(
    () =>
      rows.filter((r) => {
        const st = engFeeUiStatus(r);
        return st === "pending_office" || st === "dispute";
      }).length,
    [rows],
  );
  const engReadyCount = useMemo(
    () =>
      rows.filter((r) => {
        const st = engFeeUiStatus(r);
        return st === "ready" || st === "carried";
      }).length,
    [rows],
  );

  const { data: engStatements = [] } = useQuery({
    queryKey: [
      ...prototypeKeys.all,
      "eng-billing",
      "statements",
      assigneeId ?? "all",
      "issued+",
    ],
    queryFn: () =>
      loadEngBillingStatements({
        assigneeId,
        issuedOrLaterOnly: true,
      }),
    enabled: isEngineering && !isSupervisor && Boolean(assigneeId),
  });

  const engTab: EngFeesTab =
    tab === "ready" || tab === "statements" ? tab : "action";

  const showVisitAndKeyFees =
    variant === "government-review" || isSupervisor;

  if (isEngineering && !isSupervisor) {
    return (
      <div className="flex min-h-0 flex-col gap-0 px-3 pb-4 sm:px-4">
        <EngFeesHtmlTabs
          active={engTab}
          onChange={(id) => setTab(id as PartyFeesTab)}
          tabs={[
            {
              id: "action",
              label: "تتطلب إجراءكم",
              count: engActionCount,
              countWarnWhenActive: true,
            },
            {
              id: "ready",
              label: "جاهزة للفوترة",
              count: engReadyCount,
            },
            {
              id: "statements",
              label: "كشوف الفوترة الصادرة",
              count: engStatements.length,
            },
          ]}
        />

        {engTab === "action" ? (
          <>
            <EngFeesSectionTitle
              title="الكشف المبدئي — بنود تتطلب إجراءكم"
              sub="تعديلات تسعير بانتظار إفادتكم، وتحفّظاتكم قيد المعالجة مع المشرف. الاستحقاق ينشأ بقبول الأخصائي بسعر جدول التسعير."
            />
            <EngOfficeFeesBillingTable
              rows={rows}
              tab="action"
              pending={isLoading && !isFetched}
            />
          </>
        ) : null}

        {engTab === "ready" ? (
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

        {engTab === "statements" ? (
          <EngOfficeBillingStatementsPanel
            assigneeId={assigneeId}
            issuedOrLaterOnly
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-0">
      {isSupervisor ? (
        <TabBar className="mb-0">
          <Tab active={tab === "financial"} onClick={() => setTab("financial")}>
            الأمور المالية
            {supReviewRows.length + returnedToSup.length + disputedRows.length > 0
              ? ` (${supReviewRows.length + returnedToSup.length + disputedRows.length})`
              : ""}
          </Tab>
          <Tab active={tab === "fees"} onClick={() => setTab("fees")}>
            الحسم والمراجعة
          </Tab>
          <Tab
            active={tab === "statements"}
            onClick={() => setTab("statements")}
          >
            كشوف الفوترة
          </Tab>
          <Tab active={tab === "visit-fees"} onClick={() => setTab("visit-fees")}>
            أتعاب الزيارة
          </Tab>
          <Tab active={tab === "key-fees"} onClick={() => setTab("key-fees")}>
            أتعاب استلام المفاتيح
          </Tab>
        </TabBar>
      ) : (
        <TabBar className="mb-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:h-0 max-lg:gap-0">
          <Tab active={tab === "browse"} onClick={() => setTab("browse")}>
            عقاراتي وحالاتها
          </Tab>
          <Tab active={tab === "fees"} onClick={() => setTab("fees")}>
            أتعاب المعاملة
          </Tab>
          {showVisitAndKeyFees ? (
            <Tab
              active={tab === "visit-fees"}
              onClick={() => setTab("visit-fees")}
            >
              أتعاب الزيارة
            </Tab>
          ) : null}
          {showVisitAndKeyFees ? (
            <Tab active={tab === "key-fees"} onClick={() => setTab("key-fees")}>
              أتعاب استلام المفاتيح
            </Tab>
          ) : null}
          <Tab active={tab === "disburse"} onClick={() => setTab("disburse")}>
            طلب صرف
          </Tab>
          <Tab active={tab === "returned"} onClick={() => setTab("returned")}>
            المُعاد لي
          </Tab>
        </TabBar>
      )}

      <TabPanel className="px-3 py-3 sm:px-4 sm:py-4">
        {tab === "fees" ? (
          isSupervisor ? (
            <>
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
              <QueueTableHint className="mt-3">
                الحسم هنا — للمكتب الهندسي: الخصم يُرسل لموافقة المكتب قبل المالية.
                {variant === "government-review" || isSupervisor
                  ? " مسار المهام التشغيلية (زيارة محكمة) يظهر في «أتعاب الزيارة»."
                  : ""}
              </QueueTableHint>
            </>
          ) : (
            <>
              <PartyFeeWorkflowTable
                rows={rows}
                role="office"
                pending={isLoading && !isFetched}
              />
              <QueueTableHint className="mt-3">
                بعد إنجاز العمل ارفع المعاملة للمشرف. الأتعاب تظهر بعد اكتمال
                دراسة الحالة للصك. وعند جاهزيتها للصرف أنشئ «أمر صرف» من تبويب
                طلب الصرف.
                {showVisitAndKeyFees
                  ? " أتعاب زيارة المحكمة من المهام التشغيلية في تبويب «أتعاب الزيارة»."
                  : ""}
              </QueueTableHint>
            </>
          )
        ) : null}

        {tab === "visit-fees" && showVisitAndKeyFees ? (
          <CourtVisitFeesPanel
            creditAssigneeId={isSupervisor ? undefined : assigneeId}
          />
        ) : null}

        {tab === "key-fees" && showVisitAndKeyFees ? (
          <>
            <KeyEnvelopeFeesPanel
              canCollect
              onOpenEnvelope={(envelopeId) => {
                window.location.assign(
                  `/keys?envelope=${encodeURIComponent(envelopeId)}`,
                );
              }}
            />
            <QueueTableHint className="mt-3">
              أتعاب استلام ظرف المفاتيح (سيناريو المحكمة + صورة). منفصلة عن أتعاب
              الزيارة. التفاصيل الكاملة من{" "}
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

        {tab === "financial" && isSupervisor ? (
          <div className="flex flex-col gap-4">
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-text">
                الواردة للاعتماد
              </h3>
              {supReviewRows.length === 0 ? (
                <EmptyState line="لا معاملات بانتظار الاعتماد." />
              ) : (
                <PartyFeeWorkflowTable rows={supReviewRows} role="supervisor" />
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-text">
                خلاف تسعير (مكتب هندسي)
              </h3>
              {disputedRows.length === 0 ? (
                <EmptyState line="لا بنود خلاف تسعير." />
              ) : (
                <PartyFeeWorkflowTable rows={disputedRows} role="supervisor" />
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-text">
                المُعاد من المالية
              </h3>
              {returnedToSup.length === 0 ? (
                <EmptyState line="لا معاملات مُعادة من المالية." />
              ) : (
                <PartyFeeWorkflowTable rows={returnedToSup} role="supervisor" />
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-text">
                متابعة فوترة إنفاذ
              </h3>
              <SupervisorEnfazTracking />
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-text">
                كشوف فوترة المكتب الهندسي
              </h3>
              <EngOfficeBillingStatementsPanel issuedOrLaterOnly />
            </section>
          </div>
        ) : null}

        {tab === "statements" ? (
          <EngOfficeBillingStatementsPanel
            assigneeId={isSupervisor ? undefined : assigneeId}
            issuedOrLaterOnly
          />
        ) : null}

        {tab === "disburse" && !isSupervisor ? (
          <PartyDisbursementRequest
            rows={rows.filter((r) => r.canCreateDisbursementRequest)}
          />
        ) : null}

        {tab === "returned" && !isSupervisor ? (
          <PartyReturnedQueue rows={rows} />
        ) : null}

        {tab === "browse" && !isSupervisor ? (
          <PartyPropertyBrowse
            rows={rows}
            partyName={resolvePartyName(assigneeId, staffUsers)}
            partyCategory={resolvePartyCategory(
              assigneeId ?? "",
              rows,
              staffUsers,
            )}
            pending={isLoading && !isFetched}
          />
        ) : null}
      </TabPanel>
    </div>
  );
}
