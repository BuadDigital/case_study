import type { ReactNode } from "react";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  ActiveCaseStudyView,
  ActiveDistributionView,
  BourseInquiryView,
  GovernmentReviewView,
  MyTasksView,
  SuspendedTransactionsView,
} from "@case-study/mfe";
import { DashboardView } from "@dashboard/mfe";
import { FailureTypesView, FailuresView } from "@failures/mfe";
import { FinancialView } from "@financial/mfe";
import { KeysView } from "@keys/mfe";
import { KpiView } from "@kpi/mfe";
import {
  CaseStudyInfoRolesView,
  CourtsView,
  SystemFieldsCatalogView,
  SystemScreenCatalogView,
  UsersView,
} from "@settings/mfe";
import { SurveyView } from "@survey/mfe";
import { ValuationRequestsView } from "@valuation/mfe";
import { PartyActiveTaskViewHost } from "@/components/party-tasks/PartyActiveTaskViewHost";
import { PARTY_TASK_PAGE_IDS } from "@platform/app-shared/prototype/party-task-pages";
import { VALID_PAGE_IDS } from "@platform/app-shared/prototype/constants";
import type { PageId } from "@platform/types";

const VIEWS: Partial<Record<PageId, ReactNode>> = {
  dashboard: <DashboardView />,
  "active-primary-data": (
    <Suspense
      fallback={
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <p className="my-2 px-6 text-xs text-text-3">جاري تحميل المعاملات…</p>
        </div>
      }
    >
      <MyTasksView />
    </Suspense>
  ),
  "bourse-inquiry": <BourseInquiryView />,
  "active-distribution": (
    <Suspense
      fallback={
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <p className="my-2 px-6 text-xs text-text-3">جاري تحميل المعاملات…</p>
        </div>
      }
    >
      <ActiveDistributionView />
    </Suspense>
  ),
  "active-case-study": (
    <Suspense
      fallback={
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <p className="my-2 px-6 text-xs text-text-3">جاري تحميل المعاملات…</p>
        </div>
      }
    >
      <ActiveCaseStudyView />
    </Suspense>
  ),
  survey: <SurveyView />,
  keys: <KeysView />,
  failures: <FailuresView />,
  "suspended-transactions": <SuspendedTransactionsView />,
  "valuation-requests": <ValuationRequestsView />,
  ...Object.fromEntries(
    PARTY_TASK_PAGE_IDS.filter((pageId) => pageId !== "government-review").map(
      (pageId) => [
        pageId,
        <Suspense
          key={pageId}
          fallback={
            <div className="flex min-h-0 w-full flex-1 flex-col">
              <p className="my-2 px-6 text-xs text-text-3">جاري تحميل المهام…</p>
            </div>
          }
        >
          <PartyActiveTaskViewHost pageId={pageId} />
        </Suspense>,
      ],
    ),
  ),
  "government-review": (
    <Suspense
      fallback={
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <p className="my-2 px-6 text-xs text-text-3">جاري تحميل المراجعة الحكومية…</p>
        </div>
      }
    >
      <GovernmentReviewView />
    </Suspense>
  ),
  "system-fields-catalog": <SystemFieldsCatalogView />,
  "system-screen-catalog": <SystemScreenCatalogView />,
  financial: <FinancialView />,
  kpi: <KpiView />,
  users: <UsersView />,
  courts: <CourtsView />,
  "failure-types": <FailureTypesView />,
  "case-study-info-roles": <CaseStudyInfoRolesView />,
};

export default async function PrototypePage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: raw } = await params;
  if (!VALID_PAGE_IDS.has(raw as PageId)) notFound();
  const page = raw as PageId;
  const node = VIEWS[page];
  if (node) return node;
  notFound();
}
