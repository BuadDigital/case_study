"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import type { PageId } from "@platform/types";
import { PARTY_TASK_PAGE_IDS } from "@platform/app-shared/prototype/party-task-pages";

const DashboardView = dynamic(
  () => import("@dashboard/mfe").then((m) => m.DashboardView),
  { ssr: false },
);
const MyTasksView = dynamic(
  () => import("@case-study/mfe").then((m) => m.MyTasksView),
  { ssr: false },
);
const ActiveDistributionView = dynamic(
  () => import("@case-study/mfe").then((m) => m.ActiveDistributionView),
  { ssr: false },
);
const ActiveCaseStudyView = dynamic(
  () => import("@case-study/mfe").then((m) => m.ActiveCaseStudyView),
  { ssr: false },
);
const BourseInquiryView = dynamic(
  () => import("@case-study/mfe").then((m) => m.BourseInquiryView),
  { ssr: false },
);
const GovernmentReviewView = dynamic(
  () => import("@case-study/mfe").then((m) => m.GovernmentReviewView),
  { ssr: false },
);
const SuspendedTransactionsView = dynamic(
  () => import("@case-study/mfe").then((m) => m.SuspendedTransactionsView),
  { ssr: false },
);
const SurveyView = dynamic(
  () => import("@survey/mfe").then((m) => m.SurveyView),
  { ssr: false },
);
const KeysView = dynamic(
  () => import("@keys/mfe").then((m) => m.KeysView),
  { ssr: false },
);
const FailuresView = dynamic(
  () => import("@failures/mfe").then((m) => m.FailuresView),
  { ssr: false },
);
const FailureTypesView = dynamic(
  () => import("@failures/mfe").then((m) => m.FailureTypesView),
  { ssr: false },
);
const ValuationRequestsView = dynamic(
  () => import("@valuation/mfe").then((m) => m.ValuationRequestsView),
  { ssr: false },
);
const FinancialView = dynamic(
  () => import("@financial/mfe").then((m) => m.FinancialView),
  { ssr: false },
);
const KpiView = dynamic(
  () => import("@kpi/mfe").then((m) => m.KpiView),
  { ssr: false },
);
const UsersView = dynamic(
  () => import("@settings/mfe").then((m) => m.UsersView),
  { ssr: false },
);
const CourtsView = dynamic(
  () => import("@settings/mfe").then((m) => m.CourtsView),
  { ssr: false },
);
const SystemFieldsCatalogView = dynamic(
  () => import("@settings/mfe").then((m) => m.SystemFieldsCatalogView),
  { ssr: false },
);
const SystemScreenCatalogView = dynamic(
  () => import("@settings/mfe").then((m) => m.SystemScreenCatalogView),
  { ssr: false },
);
const CaseStudyInfoRolesView = dynamic(
  () => import("@settings/mfe").then((m) => m.CaseStudyInfoRolesView),
  { ssr: false },
);
const PartyFeesView = dynamic(
  () => import("@case-study/mfe").then((m) => m.PartyFeesView),
  { ssr: false },
);
const PartyActiveTaskViewHost = dynamic(
  () =>
    import("@/components/party-tasks/PartyActiveTaskViewHost").then(
      (m) => m.PartyActiveTaskViewHost,
    ),
  { ssr: false },
);

const VIEWS: Partial<Record<PageId, ComponentType>> = {
  dashboard: DashboardView,
  "active-primary-data": MyTasksView,
  "bourse-inquiry": BourseInquiryView,
  "active-distribution": ActiveDistributionView,
  "active-case-study": ActiveCaseStudyView,
  survey: SurveyView,
  keys: KeysView,
  failures: FailuresView,
  "suspended-transactions": SuspendedTransactionsView,
  "valuation-requests": ValuationRequestsView,
  "government-review": GovernmentReviewView,
  "system-fields-catalog": SystemFieldsCatalogView,
  "system-screen-catalog": SystemScreenCatalogView,
  financial: FinancialView,
  kpi: KpiView,
  users: UsersView,
  courts: CourtsView,
  "failure-types": FailureTypesView,
  "case-study-info-roles": CaseStudyInfoRolesView,
  "party-fees": PartyFeesView,
};

for (const pageId of PARTY_TASK_PAGE_IDS) {
  if (pageId === "government-review") continue;
  VIEWS[pageId] = function PartyTaskPage() {
    return <PartyActiveTaskViewHost pageId={pageId} />;
  };
}

export function PrototypePageView({ page }: { page: PageId }) {
  const View = VIEWS[page];
  if (!View) return null;

  const needsSuspense =
    page === "active-primary-data" ||
    page === "active-distribution" ||
    page === "active-case-study" ||
    page === "government-review" ||
    PARTY_TASK_PAGE_IDS.includes(page);

  if (needsSuspense) {
    return (
      <Suspense fallback={null}>
        <View />
      </Suspense>
    );
  }

  return <View />;
}
