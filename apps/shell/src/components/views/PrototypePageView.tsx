"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import type { PageId } from "@platform/types";
import { PARTY_TASK_PAGE_IDS } from "@platform/app-shared/prototype/party-task-pages";
import { PanelSkeleton } from "@platform/design-system";

/**
 * next/dynamic renders its `loading` component (default: null) while the MFE
 * chunk loads — the surrounding Suspense fallback never shows. Without this,
 * heavy pages like the dashboard are a fully blank content area on first load.
 */
function MfeLoading() {
  return <PanelSkeleton className="p-4" />;
}

const DashboardView = dynamic(
  () => import("@dashboard/mfe").then((m) => m.DashboardView),
  { ssr: false, loading: MfeLoading },
);
const MyTasksView = dynamic(
  () => import("@case-study/mfe").then((m) => m.MyTasksView),
  { ssr: false, loading: MfeLoading },
);
const AllAssignedTransactionsView = dynamic(
  () => import("@case-study/mfe").then((m) => m.AllAssignedTransactionsView),
  { ssr: false, loading: MfeLoading },
);
const FavoriteTransactionsView = dynamic(
  () => import("@case-study/mfe").then((m) => m.FavoriteTransactionsView),
  { ssr: false, loading: MfeLoading },
);
const ActiveDistributionView = dynamic(
  () => import("@case-study/mfe").then((m) => m.ActiveDistributionView),
  { ssr: false, loading: MfeLoading },
);
const ActiveCaseStudyView = dynamic(
  () => import("@case-study/mfe").then((m) => m.ActiveCaseStudyView),
  { ssr: false, loading: MfeLoading },
);
const SystemUploadView = dynamic(
  () => import("@case-study/mfe").then((m) => m.SystemUploadView),
  { ssr: false, loading: MfeLoading },
);
const BourseInquiryView = dynamic(
  () => import("@case-study/mfe").then((m) => m.BourseInquiryView),
  { ssr: false, loading: MfeLoading },
);
const OperationsTasksView = dynamic(
  () => import("@case-study/mfe").then((m) => m.OperationsTasksView),
  { ssr: false, loading: MfeLoading },
);
const SuspendedTransactionsView = dynamic(
  () => import("@case-study/mfe").then((m) => m.SuspendedTransactionsView),
  { ssr: false, loading: MfeLoading },
);
const KeysView = dynamic(
  () => import("@keys/mfe").then((m) => m.KeysView),
  { ssr: false, loading: MfeLoading },
);
const FieldSyncSupervisorView = dynamic(
  () => import("@case-study/mfe").then((m) => m.FieldSyncSupervisorView),
  { ssr: false, loading: MfeLoading },
);
const FailuresView = dynamic(
  () => import("@failures/mfe").then((m) => m.FailuresView),
  { ssr: false, loading: MfeLoading },
);
const FailureTypesView = dynamic(
  () => import("@failures/mfe").then((m) => m.FailureTypesView),
  { ssr: false, loading: MfeLoading },
);
const ValuationRequestsView = dynamic(
  () => import("@valuation/mfe").then((m) => m.ValuationRequestsView),
  { ssr: false, loading: MfeLoading },
);
const FinancialView = dynamic(
  () => import("@financial/mfe").then((m) => m.FinancialView),
  { ssr: false, loading: MfeLoading },
);
const UsersView = dynamic(
  () => import("@settings/mfe").then((m) => m.UsersView),
  { ssr: false, loading: MfeLoading },
);
const ProfileView = dynamic(
  () => import("@settings/mfe").then((m) => m.ProfileView),
  { ssr: false, loading: MfeLoading },
);
const CourtsView = dynamic(
  () => import("@settings/mfe").then((m) => m.CourtsView),
  { ssr: false, loading: MfeLoading },
);
const LocationsPendingView = dynamic(
  () => import("@settings/mfe").then((m) => m.LocationsPendingView),
  { ssr: false, loading: MfeLoading },
);
const OrganizationSettingsView = dynamic(
  () => import("@settings/mfe").then((m) => m.OrganizationSettingsView),
  { ssr: false, loading: MfeLoading },
);
const SystemFieldsCatalogView = dynamic(
  () => import("@settings/mfe").then((m) => m.SystemFieldsCatalogView),
  { ssr: false, loading: MfeLoading },
);
const SystemScreenCatalogView = dynamic(
  () => import("@settings/mfe").then((m) => m.SystemScreenCatalogView),
  { ssr: false, loading: MfeLoading },
);
const CaseStudyInfoRolesView = dynamic(
  () => import("@settings/mfe").then((m) => m.CaseStudyInfoRolesView),
  { ssr: false, loading: MfeLoading },
);
const PartyFeesView = dynamic(
  () => import("@case-study/mfe").then((m) => m.PartyFeesView),
  { ssr: false, loading: MfeLoading },
);
const AuditLogView = dynamic(
  () =>
    import("@/components/views/AuditLogView").then((m) => m.AuditLogView),
  { ssr: false, loading: MfeLoading },
);
const FeePricingView = dynamic(
  () =>
    import("@/components/views/FeePricingView").then((m) => m.FeePricingView),
  { ssr: false, loading: MfeLoading },
);
const SurveyView = dynamic(
  () => import("@survey/mfe").then((m) => m.SurveyView),
  { ssr: false, loading: MfeLoading },
);
const PartyActiveTaskViewHost = dynamic(
  () =>
    import("@/components/party-tasks/PartyActiveTaskViewHost").then(
      (m) => m.PartyActiveTaskViewHost,
    ),
  { ssr: false, loading: MfeLoading },
);

const VIEWS: Partial<Record<PageId, ComponentType>> = {
  dashboard: DashboardView,
  "active-primary-data": MyTasksView,
  "all-transactions": AllAssignedTransactionsView,
  favorites: FavoriteTransactionsView,
  "bourse-inquiry": BourseInquiryView,
  "active-distribution": ActiveDistributionView,
  "active-case-study": ActiveCaseStudyView,
  "system-upload": SystemUploadView,
  keys: KeysView,
  "field-sync-board": FieldSyncSupervisorView,
  failures: FailuresView,
  "suspended-transactions": SuspendedTransactionsView,
  "valuation-requests": ValuationRequestsView,
  "operations-tasks": OperationsTasksView,
  "system-fields-catalog": SystemFieldsCatalogView,
  "system-screen-catalog": SystemScreenCatalogView,
  financial: FinancialView,
  users: UsersView,
  profile: ProfileView,
  courts: CourtsView,
  "location-pending": LocationsPendingView,
  "organization-settings": OrganizationSettingsView,
  "failure-types": FailureTypesView,
  "case-study-info-roles": CaseStudyInfoRolesView,
  "party-fees": PartyFeesView,
  "audit-log": AuditLogView,
  "fee-pricing": FeePricingView,
  survey: SurveyView,
};

for (const pageId of PARTY_TASK_PAGE_IDS) {
  VIEWS[pageId] = function PartyTaskPage() {
    return <PartyActiveTaskViewHost pageId={pageId} />;
  };
}

export function PrototypePageView({ page }: { page: PageId }) {
  const View = VIEWS[page];
  if (!View) return null;

  return (
    <Suspense fallback={<PanelSkeleton className="p-4" />}>
      <View />
    </Suspense>
  );
}
