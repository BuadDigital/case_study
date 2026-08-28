"use client";

// جسر عميل رقيق: كائن الامتدادات يحمل دوالاً وJSX فلا يعبر حدود RSC —
// الصفحة نفسها مكوّن خادم يمرر taskId فقط (server-side).
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
