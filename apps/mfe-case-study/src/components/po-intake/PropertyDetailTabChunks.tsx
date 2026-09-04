"use client";

/**
 * Lazily loaded tab bodies of `PoPropertyDetailTabs` — each tab is its own
 * chunk so the property screen ships only the tab in view.
 */

import dynamic from "next/dynamic";
import { InlineLoadingSkeleton } from "@platform/ui-kit";

const tabChunkFallback = () => (
  <InlineLoadingSkeleton className="my-2" />
);

export const PropertyDetailAppraisalTab = dynamic(
  () =>
    import("./PropertyDetailAppraisalTab").then(
      (m) => m.PropertyDetailAppraisalTab,
    ),
  { loading: tabChunkFallback },
);
export const PropertyDetailPhotosTab = dynamic(
  () =>
    import("./PropertyDetailPhotosTab").then(
      (m) => m.PropertyDetailPhotosTab,
    ),
  { loading: tabChunkFallback },
);
export const PropertyDetailLinkedTab = dynamic(
  () =>
    import("./PropertyDetailLinkedTab").then(
      (m) => m.PropertyDetailLinkedTab,
    ),
  { loading: tabChunkFallback },
);
export const PropertyDetailCaseStudyReport = dynamic(
  () =>
    import("./PropertyDetailCaseStudyReport").then(
      (m) => m.PropertyDetailCaseStudyReport,
    ),
  { loading: tabChunkFallback },
);
export const PropertyDetailGovernmentReviewsTab = dynamic(
  () =>
    import("./PropertyDetailGovernmentReviewsTab").then(
      (m) => m.PropertyDetailGovernmentReviewsTab,
    ),
  { loading: tabChunkFallback },
);
export const PropertyDetailPropertyKeys = dynamic(
  () =>
    import("./PropertyDetailPropertyKeys").then(
      (m) => m.PropertyDetailPropertyKeys,
    ),
  { loading: tabChunkFallback },
);
export const PropertyDetailEnfathUpload = dynamic(
  () =>
    import("./PropertyDetailEnfathUpload").then(
      (m) => m.PropertyDetailEnfathUpload,
    ),
  { loading: tabChunkFallback },
);
export const PropertyDetailFinanceTab = dynamic(
  () =>
    import("./PropertyDetailFinanceTab").then(
      (m) => m.PropertyDetailFinanceTab,
    ),
  { loading: tabChunkFallback },
);
export const PropertyDetailInspectionTab = dynamic(
  () =>
    import("./PropertyDetailInspectionTab").then(
      (m) => m.PropertyDetailInspectionTab,
    ),
  { loading: tabChunkFallback },
);
export const PropertyDetailPartyPackageReview = dynamic(
  () =>
    import("./PropertyDetailPartyPackageReview").then(
      (m) => m.PropertyDetailPartyPackageReview,
    ),
  { loading: tabChunkFallback },
);
export const PartyRoleDetailPanel = dynamic(
  () =>
    import("./PartyRoleDetailPanel").then(
      (m) => m.PartyRoleDetailPanel,
    ),
  { loading: tabChunkFallback },
);
