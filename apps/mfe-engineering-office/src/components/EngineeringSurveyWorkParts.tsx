"use client";

/** Survey work-panel parts — module-level types and helpers, moved literally (SRP). */

import dynamic from "next/dynamic";
import { InlineLoadingSkeleton } from "@platform/ui-kit";
import type { EngineeringSurveySubmission } from "../lib/engineering-survey-data";
import type { EngineeringSurveyFieldErrors } from "../lib/engineering-survey-validation";

export type WorkTab = "property" | "survey" | "fees" | "notes" | "failures";

export const EMPTY_FIELD_ERRORS: EngineeringSurveyFieldErrors = {};

export const EngineeringSurveyMap = dynamic(
  () => import("./EngineeringSurveyMap").then((m) => m.EngineeringSurveyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-DEFAULT border border-border bg-surface-2 text-xs text-text-3">
        جاري تحميل الخريطة…
      </div>
    ),
  },
);
export const FailureRaisePanel = dynamic(
  () =>
    import("@failures/mfe/components/failures/FailureRaisePanel").then(
      (m) => m.FailureRaisePanel,
    ),
  {
    ssr: false,
    loading: () => <InlineLoadingSkeleton className="my-2" />,
  },
);

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
  ["southBoundary", "southBoundaryLengthM", "الحد الجنوبي", "طول الحد الجنوبي (م)"],
  ["eastBoundary", "eastBoundaryLengthM", "الحد الشرقي", "طول الحد الشرقي (م)"],
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
    "natureSouthBoundary",
    "natureSouthBoundaryLengthM",
    "الحد الجنوبي",
    "طول الحد الجنوبي (م)",
  ],
  [
    "natureEastBoundary",
    "natureEastBoundaryLengthM",
    "الحد الشرقي",
    "طول الحد الشرقي (م)",
  ],
  [
    "natureWestBoundary",
    "natureWestBoundaryLengthM",
    "الحد الغربي",
    "طول الحد الغربي (م)",
  ],
] as const;
