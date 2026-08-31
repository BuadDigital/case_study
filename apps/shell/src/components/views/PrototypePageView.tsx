"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import type { PageId } from "@platform/types";
import { PARTY_TASK_PAGE_IDS } from "@platform/app-shared/prototype/party-task-pages";
import { PanelSkeleton } from "@platform/ui-kit";

/**
 * next/dynamic renders its `loading` component (default: null) while the MFE
 * chunk loads — the surrounding Suspense fallback never shows. Without this,
 * heavy pages like the dashboard are a fully blank content area on first load.
 */
function MfeLoading() {
  return <PanelSkeleton className="min-h-[min(60vh,32rem)] p-4" />;
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
const PropertyMapView = dynamic(
  () => import("@case-study/mfe").then((m) => m.PropertyMapView),
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
const ComparablePropertiesView = dynamic(
  () => import("@valuation/mfe").then((m) => m.ComparablePropertiesView),
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
const ClientsView = dynamic(
  () => import("@settings/mfe").then((m) => m.ClientsView),
  { ssr: false, loading: MfeLoading },
);
const AttachmentPrintDictionaryView = dynamic(
  () => import("@settings/mfe").then((m) => m.AttachmentPrintDictionaryView),
  { ssr: false, loading: MfeLoading },
);
const DifferenceFactorCatalogView = dynamic(
  () => import("@settings/mfe").then((m) => m.DifferenceFactorCatalogView),
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
  "property-map": PropertyMapView,
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
  "comparable-properties": ComparablePropertiesView,
  "operations-tasks": OperationsTasksView,
  "system-fields-catalog": SystemFieldsCatalogView,
  "system-screen-catalog": SystemScreenCatalogView,
  financial: FinancialView,
  users: UsersView,
  profile: ProfileView,
  courts: CourtsView,
  "location-pending": LocationsPendingView,
  "organization-settings": OrganizationSettingsView,
  clients: ClientsView,
  "attachment-print-dictionary": AttachmentPrintDictionaryView,
  "difference-factor-catalog": DifferenceFactorCatalogView,
  "failure-types": FailureTypesView,
  "case-study-info-roles": CaseStudyInfoRolesView,
  "party-fees": PartyFeesView,
  "audit-log": AuditLogView,
  "fee-pricing": FeePricingView,
  survey: SurveyView,
};

// Preload the page chunk on nav-link hover/focus — same import specs as
// the dynamic() above so the same chunk is fetched (bundle-preload).
export const PAGE_CHUNK_PRELOAD: Partial<
  Record<PageId, () => Promise<unknown>>
> = {
  dashboard: () => import("@dashboard/mfe"),
  "active-primary-data": () => import("@case-study/mfe"),
  "all-transactions": () => import("@case-study/mfe"),
  "property-map": () => import("@case-study/mfe"),
  favorites: () => import("@case-study/mfe"),
  "bourse-inquiry": () => import("@case-study/mfe"),
  "active-distribution": () => import("@case-study/mfe"),
  "active-case-study": () => import("@case-study/mfe"),
  "system-upload": () => import("@case-study/mfe"),
  keys: () => import("@keys/mfe"),
  "field-sync-board": () => import("@case-study/mfe"),
  failures: () => import("@failures/mfe"),
  "suspended-transactions": () => import("@case-study/mfe"),
  "valuation-requests": () => import("@valuation/mfe"),
  "comparable-properties": () => import("@valuation/mfe"),
  "operations-tasks": () => import("@case-study/mfe"),
  "system-fields-catalog": () => import("@settings/mfe"),
  "system-screen-catalog": () => import("@settings/mfe"),
  financial: () => import("@financial/mfe"),
  users: () => import("@settings/mfe"),
  profile: () => import("@settings/mfe"),
  courts: () => import("@settings/mfe"),
  "location-pending": () => import("@settings/mfe"),
  "organization-settings": () => import("@settings/mfe"),
  clients: () => import("@settings/mfe"),
  "attachment-print-dictionary": () => import("@settings/mfe"),
  "difference-factor-catalog": () => import("@settings/mfe"),
  "failure-types": () => import("@failures/mfe"),
  "case-study-info-roles": () => import("@settings/mfe"),
  "party-fees": () => import("@case-study/mfe"),
  "audit-log": () => import("@/components/views/AuditLogView"),
  "fee-pricing": () => import("@/components/views/FeePricingView"),
  survey: () => import("@survey/mfe"),
};

for (const pageId of PARTY_TASK_PAGE_IDS) {
  VIEWS[pageId] = function PartyTaskPage() {
    return <PartyActiveTaskViewHost pageId={pageId} />;
  };
  PAGE_CHUNK_PRELOAD[pageId] = () =>
    import("@/components/party-tasks/PartyActiveTaskViewHost");
}

export function PrototypePageView({ page }: { page: PageId }) {
  const View = VIEWS[page];
  if (!View) return null;

  return (
    <Suspense fallback={<PanelSkeleton className="p-4" />}>
      {page === "property-map" ? (
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <View />
        </div>
      ) : (
        <View />
      )}
    </Suspense>
  );
}
