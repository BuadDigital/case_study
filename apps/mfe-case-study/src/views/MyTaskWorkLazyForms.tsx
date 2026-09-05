"use client";

/**
 * Lazy chunks for the case-study task work steps. Each form loads on demand;
 * the preload helpers fire on hover/focus so the next step's chunk is already
 * fetched when the specialist gets there (bundle-preload).
 */
import dynamic from "next/dynamic";
import { InlineLoadingSkeleton } from "@platform/ui-kit";

const formChunkFallback = () => (
  <InlineLoadingSkeleton className="my-2" />
);

export const DistributionPartiesForm = dynamic(
  () =>
    import("@case-study/mfe/components/distribution/DistributionPartiesForm").then(
      (m) => m.DistributionPartiesForm,
    ),
  { loading: formChunkFallback },
);
export const PoPropertyEnfathForm = dynamic(
  () =>
    import("@case-study/mfe/components/po-intake/PoPropertyEnfathForm").then(
      (m) => m.PoPropertyEnfathForm,
    ),
  { loading: formChunkFallback },
);
export const PoPropertyBourseForm = dynamic(
  () =>
    import("@case-study/mfe/components/po-intake/PoPropertyBourseForm").then(
      (m) => m.PoPropertyBourseForm,
    ),
  { loading: formChunkFallback },
);
export const FailureRaiseModal = dynamic(
  () =>
    import("@case-study/mfe/components/failures/FailureRaiseModal").then(
      (m) => m.FailureRaiseModal,
    ),
  { ssr: false },
);

export const preloadDistributionPartiesForm = () =>
  void import(
    "@case-study/mfe/components/distribution/DistributionPartiesForm"
  );
export const preloadPoPropertyBourseForm = () =>
  void import("@case-study/mfe/components/po-intake/PoPropertyBourseForm");
export const preloadFailureRaiseModal = () =>
  void import("@case-study/mfe/components/failures/FailureRaiseModal");
