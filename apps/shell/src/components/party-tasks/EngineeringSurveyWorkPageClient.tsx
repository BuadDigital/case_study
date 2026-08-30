"use client";

// Thin client bridge: the extensions object holds functions and JSX so it cannot cross RSC —
// the page itself is a server component that only passes taskId (server-side).
import { PartyActiveTaskWorkPage } from "@case-study/mfe/views/PartyActiveTaskWorkPage";
import { partyEngineeringSurveyExtensions } from "@engineering-office/mfe/extensions/party-engineering-survey-extensions";

export function EngineeringSurveyWorkPageClient({
  taskId,
  entry = false,
}: {
  taskId: string;
  entry?: boolean;
}) {
  return (
    <PartyActiveTaskWorkPage
      pageId="active-survey"
      taskId={taskId}
      engineeringSurveyExtensions={partyEngineeringSurveyExtensions}
      engineeringSurveyEntry={entry}
    />
  );
}
