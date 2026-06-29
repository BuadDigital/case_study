"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  DEFAULT_CASE_STUDY_QUESTION_CATALOG,
  loadCaseStudyQuestionCatalog,
} from "../lib/prototype/case-study-question-catalog";

export const CASE_STUDY_QUESTION_CATALOG_CHANGED_EVENT =
  "field-dictionary-changed";

const STALE_MS = 60_000;

export function useCaseStudyQuestionCatalogQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "case-study-question-catalog"],
      });
    };
    window.addEventListener(CASE_STUDY_QUESTION_CATALOG_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(
        CASE_STUDY_QUESTION_CATALOG_CHANGED_EVENT,
        refresh,
      );
    };
  }, [queryClient]);

  return useQuery({
    queryKey: [...prototypeKeys.all, "case-study-question-catalog"],
    queryFn: loadCaseStudyQuestionCatalog,
    staleTime: STALE_MS,
    placeholderData: DEFAULT_CASE_STUDY_QUESTION_CATALOG,
  });
}
