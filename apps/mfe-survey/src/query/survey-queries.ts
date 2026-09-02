"use client";

import { useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { loadSurveyOffices } from "../lib/survey-api";
import { loadSurveyRequestStats } from "../lib/survey-request-stats";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

export function useSurveyOfficesQuery() {
  return useQuery({
    queryKey: appDataKeys.surveyOffices(),
    queryFn: loadSurveyOffices,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}

export function useSurveyRequestStatsQuery() {
  return useQuery({
    queryKey: [...appDataKeys.surveyOffices(), "request-stats"] as const,
    queryFn: loadSurveyRequestStats,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
