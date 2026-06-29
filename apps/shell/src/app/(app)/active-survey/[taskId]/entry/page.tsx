"use client";

import { use } from "react";
import { PartyActiveTaskWorkPage, decodeTaskParam } from "@case-study/mfe";
import { partyEngineeringSurveyExtensions } from "@engineering-office/mfe";

export default function ActiveSurveyEntryPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  return (
    <PartyActiveTaskWorkPage
      pageId="active-survey"
      taskId={decodeTaskParam(taskId)}
      engineeringSurveyExtensions={partyEngineeringSurveyExtensions}
      engineeringSurveyEntry
    />
  );
}
