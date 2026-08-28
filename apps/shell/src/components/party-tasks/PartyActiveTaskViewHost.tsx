"use client";

import { PartyActiveTaskView } from "@case-study/mfe/views/PartyActiveTaskView";
import { partyEngineeringSurveyExtensions } from "@engineering-office/mfe/extensions/party-engineering-survey-extensions";
import { partyAppraisalExtensions } from "@evaluator/mfe/extensions/party-appraisal-extensions";
import type { PageId } from "@platform/types";

export function PartyActiveTaskViewHost({ pageId }: { pageId: PageId }) {
  return (
    <PartyActiveTaskView
      pageId={pageId}
      appraisalExtensions={partyAppraisalExtensions}
      engineeringSurveyExtensions={partyEngineeringSurveyExtensions}
    />
  );
}
