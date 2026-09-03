"use client";

/**
 * Registers engineering-survey runtime helpers into `@platform/app-shared` so
 * `@case-study/mfe` never imports `@engineering-office/mfe` directly.
 * Call once from the shell at boot.
 */

import { registerEngineeringSurveyRuntimeBridge } from "@platform/app-shared/engineering-survey/runtime-bridge";
import {
  isEngineeringSurveyOutputsAccepted,
  loadEngineeringSurveySubmission,
} from "../lib/engineering-survey-submission-model";
import {
  fetchEngineeringSurveySubmission,
  prefetchEngineeringSurveySubmissions,
} from "../lib/engineering-survey-submission-reads";
import {
  acceptEngineeringSurveySubmission,
  reopenEngineeringSurveySubmission,
} from "../lib/engineering-survey-submission-commands";
import {
  downloadEngineeringSurveyDocument,
  listEngineeringSurveyDocuments,
  openEngineeringSurveyDocumentPreview,
  prefetchEngineeringSurveyDocuments,
} from "../lib/engineering-survey-attachments";
import { filterEngineeringSurveyListedTasks } from "../lib/engineering-survey-queue";

let registered = false;

export function ensureEngineeringSurveyBridgeRegistered(): void {
  if (registered) return;
  registered = true;
  registerEngineeringSurveyRuntimeBridge({
    loadEngineeringSurveySubmission,
    fetchEngineeringSurveySubmission,
    prefetchEngineeringSurveySubmissions,
    acceptEngineeringSurveySubmission,
    reopenEngineeringSurveySubmission,
    isEngineeringSurveyOutputsAccepted,
    listEngineeringSurveyDocuments,
    openEngineeringSurveyDocumentPreview,
    downloadEngineeringSurveyDocument,
    prefetchEngineeringSurveyDocuments,
    filterEngineeringSurveyListedTasks,
  });
}
