"use client";

/**
 * Lazily loaded tab bodies of `PoPropertyDetailTabs` — each tab is its own
 * chunk so the property screen ships only the tab in view. The chunks are
 * warmed on idle and on tab hover/focus (`preloadPropertyDetailTabChunks`), and
 * `preloadableLazy` renders a warmed chunk without its loading box.
 */

import { Suspense, useEffect, type ComponentType } from "react";
import { InlineLoadingSkeleton, preloadableLazy, whenIdle } from "@platform/ui-kit";
import type { TabId } from "./po-property-detail-tabs-state";

type Chunk<P extends object> = ReturnType<typeof preloadableLazy<P>>;

/** The chunk inside its own Suspense boundary — the same loading box `next/dynamic` showed. */
function withChunkFallback<P extends object>(chunk: Chunk<P>): ComponentType<P> {
  const Inner = chunk.Component;
  function TabChunk(props: P) {
    return (
      <Suspense fallback={<InlineLoadingSkeleton className="my-2" />}>
        <Inner {...props} />
      </Suspense>
    );
  }
  return TabChunk;
}

const appraisalTab = preloadableLazy(() =>
  import("./PropertyDetailAppraisalTab").then((m) => m.PropertyDetailAppraisalTab),
);
const photosTab = preloadableLazy(() =>
  import("./PropertyDetailPhotosTab").then((m) => m.PropertyDetailPhotosTab),
);
const linkedTab = preloadableLazy(() =>
  import("./PropertyDetailLinkedTab").then((m) => m.PropertyDetailLinkedTab),
);
const caseStudyReport = preloadableLazy(() =>
  import("./PropertyDetailCaseStudyReport").then(
    (m) => m.PropertyDetailCaseStudyReport,
  ),
);
const governmentReviewsTab = preloadableLazy(() =>
  import("./PropertyDetailGovernmentReviewsTab").then(
    (m) => m.PropertyDetailGovernmentReviewsTab,
  ),
);
const propertyKeys = preloadableLazy(() =>
  import("./PropertyDetailPropertyKeys").then((m) => m.PropertyDetailPropertyKeys),
);
const enfathUpload = preloadableLazy(() =>
  import("./PropertyDetailUploadAssistant").then(
    (m) => m.PropertyDetailEnfathUpload,
  ),
);
const financeTab = preloadableLazy(() =>
  import("./PropertyDetailFinanceTab").then((m) => m.PropertyDetailFinanceTab),
);
const inspectionTab = preloadableLazy(() =>
  import("./PropertyDetailInspectionTab").then(
    (m) => m.PropertyDetailInspectionTab,
  ),
);
const partyPackageReview = preloadableLazy(() =>
  import("./PropertyDetailPartyPackageReview").then(
    (m) => m.PropertyDetailPartyPackageReview,
  ),
);
const partyRoleDetailPanel = preloadableLazy(() =>
  import("./PartyRoleDetailPanel").then((m) => m.PartyRoleDetailPanel),
);

export const PropertyDetailAppraisalTab = withChunkFallback(appraisalTab);
export const PropertyDetailPhotosTab = withChunkFallback(photosTab);
export const PropertyDetailLinkedTab = withChunkFallback(linkedTab);
export const PropertyDetailCaseStudyReport = withChunkFallback(caseStudyReport);
export const PropertyDetailGovernmentReviewsTab =
  withChunkFallback(governmentReviewsTab);
export const PropertyDetailPropertyKeys = withChunkFallback(propertyKeys);
export const PropertyDetailEnfathUpload = withChunkFallback(enfathUpload);
export const PropertyDetailFinanceTab = withChunkFallback(financeTab);
export const PropertyDetailInspectionTab = withChunkFallback(inspectionTab);
export const PropertyDetailPartyPackageReview =
  withChunkFallback(partyPackageReview);
export const PartyRoleDetailPanel = withChunkFallback(partyRoleDetailPanel);

/** Code each tab needs; tabs missing here render from the main chunk. */
const TAB_CHUNKS: Partial<Record<TabId, readonly { preload: () => Promise<unknown> }[]>> = {
  appraisal: [appraisalTab],
  photos: [photosTab],
  linked: [linkedTab],
  report: [caseStudyReport],
  government: [governmentReviewsTab],
  keys: [propertyKeys],
  "enfath-upload": [enfathUpload],
  finance: [financeTab],
  inspection: [inspectionTab],
  survey: [partyPackageReview, partyRoleDetailPanel],
};

export function preloadPropertyDetailTabChunks(ids: readonly TabId[]): void {
  for (const id of ids) {
    for (const chunk of TAB_CHUNKS[id] ?? []) void chunk.preload();
  }
}

/**
 * Download the other tabs' code while the user reads the first one, so opening
 * a tab later shows its content, not a loading box.
 */
export function usePreloadPropertyDetailTabChunks(ids: readonly TabId[]): void {
  const key = ids.join("|");
  useEffect(() => {
    if (!key) return;
    return whenIdle(() =>
      preloadPropertyDetailTabChunks(key.split("|") as TabId[]),
    );
  }, [key]);
}
