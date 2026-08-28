"use client";

// جسر عميل رقيق: كائن الامتدادات يحمل دوالاً وJSX فلا يعبر حدود RSC —
// الصفحة نفسها مكوّن خادم يمرر taskId فقط (server-side).
import { PartyActiveTaskWorkPage } from "@case-study/mfe/views/PartyActiveTaskWorkPage";
import { partyAppraisalExtensions } from "@evaluator/mfe/extensions/party-appraisal-extensions";

export function PropertyAppraisalWorkPageClient({ taskId }: { taskId: string }) {
  return (
    <PartyActiveTaskWorkPage
      pageId="property-appraisal"
      taskId={taskId}
      appraisalExtensions={partyAppraisalExtensions}
    />
  );
}
