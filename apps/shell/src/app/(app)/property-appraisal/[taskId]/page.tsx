"use client";

import { use } from "react";
import { PartyActiveTaskWorkPage, decodeTaskParam } from "@case-study/mfe";
import { partyAppraisalExtensions } from "@evaluator/mfe/extensions/party-appraisal-extensions";

export default function PropertyAppraisalWorkPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  return (
    <PartyActiveTaskWorkPage
      pageId="property-appraisal"
      taskId={decodeTaskParam(taskId)}
      appraisalExtensions={partyAppraisalExtensions}
    />
  );
}
