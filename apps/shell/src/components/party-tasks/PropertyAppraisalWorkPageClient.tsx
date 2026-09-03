"use client";

// Thin client bridge: the extensions object holds functions and JSX so it cannot cross RSC —
// the page itself is a server component that only passes taskId (server-side).
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
