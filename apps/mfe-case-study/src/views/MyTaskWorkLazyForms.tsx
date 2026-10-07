"use client";

/**
 * Lazy chunks for the case-study task work steps. Each form loads on demand;
 * the preload helpers fire on hover/focus (and on idle for the next step) so
 * the chunk is already in when the specialist gets there (bundle-preload).
 * `preloadableLazy` then renders it without the loading box — next/dynamic
 * still flashed its fallback for a cached chunk.
 */
import { Suspense, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { InlineLoadingSkeleton, preloadableLazy } from "@platform/ui-kit";

function withFormChunkFallback<P extends object>(
  Component: ComponentType<P>,
): ComponentType<P> {
  function FormChunk(props: P) {
    return (
      <Suspense fallback={<InlineLoadingSkeleton className="my-2" />}>
        <Component {...props} />
      </Suspense>
    );
  }
  return FormChunk;
}

const distributionPartiesForm = preloadableLazy(() =>
  import("@case-study/mfe/components/distribution/DistributionPartiesForm").then(
    (m) => m.DistributionPartiesForm,
  ),
);
const poPropertyEnfathForm = preloadableLazy(() =>
  import("@case-study/mfe/components/po-intake/PoPropertyDeedForm").then(
    (m) => m.PoPropertyEnfathForm,
  ),
);
const poPropertyBourseForm = preloadableLazy(() =>
  import("@case-study/mfe/components/po-intake/PoPropertyBourseForm").then(
    (m) => m.PoPropertyBourseForm,
  ),
);

export const DistributionPartiesForm = withFormChunkFallback(
  distributionPartiesForm.Component,
);
export const PoPropertyEnfathForm = withFormChunkFallback(
  poPropertyEnfathForm.Component,
);
export const PoPropertyBourseForm = withFormChunkFallback(
  poPropertyBourseForm.Component,
);
export const FailureRaiseModal = dynamic(
  () =>
    import("@case-study/mfe/components/failures/FailureRaiseModal").then(
      (m) => m.FailureRaiseModal,
    ),
  { ssr: false },
);

export const preloadDistributionPartiesForm = () =>
  void distributionPartiesForm.preload();
export const preloadPoPropertyBourseForm = () =>
  void poPropertyBourseForm.preload();
export const preloadFailureRaiseModal = () =>
  void import("@case-study/mfe/components/failures/FailureRaiseModal");
