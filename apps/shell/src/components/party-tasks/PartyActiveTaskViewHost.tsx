"use client";

import { PartyActiveTaskView } from "@case-study/mfe";
import { partyEngineeringSurveyExtensions } from "@engineering-office/mfe";
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
