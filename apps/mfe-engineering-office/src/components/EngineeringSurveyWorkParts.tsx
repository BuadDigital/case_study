"use client";

/** Survey work-panel parts — module-level types and helpers, moved literally (SRP). */

import { Suspense, type ComponentProps } from "react";
import {
  InlineLoadingSkeleton,
  preloadableLazy,
  whenIdle,
} from "@platform/ui-kit";
import type { EngineeringSurveySubmission } from "../lib/engineering-survey-data";
import type { EngineeringSurveyFieldErrors } from "../lib/engineering-survey-validation";

export type WorkTab = "property" | "survey" | "fees" | "notes" | "failures";

export const EMPTY_FIELD_ERRORS: EngineeringSurveyFieldErrors = {};

// Preloadable instead of next/dynamic: dynamic re-showed its loading box on every
// return to a tab even with the chunk cached; these render directly once loaded.
const surveyMapChunk = preloadableLazy(() =>
  import("./EngineeringSurveyMap").then((m) => m.EngineeringSurveyMap),
);
const failureRaisePanelChunk = preloadableLazy(() =>
  import("@failures/mfe/components/failures/FailureRaisePanel").then(
    (m) => m.FailureRaisePanel,
  ),
);

export function EngineeringSurveyMap(
  props: ComponentProps<typeof surveyMapChunk.Component>,
) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[280px] items-center justify-center rounded-DEFAULT border border-border bg-surface-2 text-xs text-text-3">
          جاري تحميل الخريطة…
        </div>
      }
    >
      <surveyMapChunk.Component {...props} />
    </Suspense>
  );
}

export function FailureRaisePanel(
  props: ComponentProps<typeof failureRaisePanelChunk.Component>,
) {
  return (
    <Suspense fallback={<InlineLoadingSkeleton className="my-2" />}>
      <failureRaisePanelChunk.Component {...props} />
    </Suspense>
  );
}

export const preloadFailureRaisePanel = () =>
  void failureRaisePanelChunk.preload();

/** Pull the map and failures-panel code once the work panel has painted. */
export function preloadSurveyWorkChunksWhenIdle(): () => void {
  return whenIdle(() => {
    void surveyMapChunk.preload();
    void failureRaisePanelChunk.preload();
  });
}

export type LocalTextFields = {
  latitude: string;
  longitude: string;
  onSiteAreaSqm: string;
  northBoundary: string;
  northBoundaryLengthM: string;
  southBoundary: string;
  southBoundaryLengthM: string;
  eastBoundary: string;
  eastBoundaryLengthM: string;
  westBoundary: string;
  westBoundaryLengthM: string;
  natureOnSiteAreaSqm: string;
  natureNorthBoundary: string;
  natureNorthBoundaryLengthM: string;
  natureSouthBoundary: string;
  natureSouthBoundaryLengthM: string;
  natureEastBoundary: string;
  natureEastBoundaryLengthM: string;
  natureWestBoundary: string;
  natureWestBoundaryLengthM: string;
  surveyNotes: string;
};

export function localFieldsFromDraft(
  draft: EngineeringSurveySubmission,
): LocalTextFields {
  return {
    latitude: draft.latitude,
    longitude: draft.longitude,
    onSiteAreaSqm: draft.onSiteAreaSqm,
    northBoundary: draft.northBoundary,
    northBoundaryLengthM: draft.northBoundaryLengthM,
    southBoundary: draft.southBoundary,
    southBoundaryLengthM: draft.southBoundaryLengthM,
    eastBoundary: draft.eastBoundary,
    eastBoundaryLengthM: draft.eastBoundaryLengthM,
    westBoundary: draft.westBoundary,
    westBoundaryLengthM: draft.westBoundaryLengthM,
    natureOnSiteAreaSqm: draft.natureOnSiteAreaSqm ?? "",
    natureNorthBoundary: draft.natureNorthBoundary ?? "",
    natureNorthBoundaryLengthM: draft.natureNorthBoundaryLengthM ?? "",
    natureSouthBoundary: draft.natureSouthBoundary ?? "",
    natureSouthBoundaryLengthM: draft.natureSouthBoundaryLengthM ?? "",
    natureEastBoundary: draft.natureEastBoundary ?? "",
    natureEastBoundaryLengthM: draft.natureEastBoundaryLengthM ?? "",
    natureWestBoundary: draft.natureWestBoundary ?? "",
    natureWestBoundaryLengthM: draft.natureWestBoundaryLengthM ?? "",
    surveyNotes: draft.surveyNotes,
  };
}

export function mergeRemoteSurveyDraft(
  next: EngineeringSurveySubmission,
  prev: EngineeringSurveySubmission | null,
  local: LocalTextFields | null,
  pendingChecklist: EngineeringSurveySubmission["checklist"] | undefined,
): EngineeringSurveySubmission {
  return {
    ...next,
    ...(local ?? {}),
    checklist: pendingChecklist ?? prev?.checklist ?? next.checklist,
  };
}

export const BOUNDARY_ROWS = [
  ["northBoundary", "northBoundaryLengthM", "الحد الشمالي", "طول الحد الشمالي (م)"],
  ["eastBoundary", "eastBoundaryLengthM", "الحد الشرقي", "طول الحد الشرقي (م)"],
  ["southBoundary", "southBoundaryLengthM", "الحد الجنوبي", "طول الحد الجنوبي (م)"],
  ["westBoundary", "westBoundaryLengthM", "الحد الغربي", "طول الحد الغربي (م)"],
] as const;

export const NATURE_BOUNDARY_ROWS = [
  [
    "natureNorthBoundary",
    "natureNorthBoundaryLengthM",
    "الحد الشمالي",
    "طول الحد الشمالي (م)",
  ],
  [
    "natureEastBoundary",
    "natureEastBoundaryLengthM",
    "الحد الشرقي",
    "طول الحد الشرقي (م)",
  ],
  [
    "natureSouthBoundary",
    "natureSouthBoundaryLengthM",
    "الحد الجنوبي",
    "طول الحد الجنوبي (م)",
  ],
  [
    "natureWestBoundary",
    "natureWestBoundaryLengthM",
    "الحد الغربي",
    "طول الحد الغربي (م)",
  ],
] as const;
