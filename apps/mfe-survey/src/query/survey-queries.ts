"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadSurveyOffices } from "../lib/survey-api";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

export function useSurveyOfficesQuery() {
  return useQuery({
    queryKey: prototypeKeys.surveyOffices(),
    queryFn: loadSurveyOffices,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
