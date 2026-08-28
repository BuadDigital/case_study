// مكوّن خادم — كانت الصفحة "use client" فقط لفك params (server-side).
import { decodeTaskParam } from "@case-study/mfe/lib/my-task-routes";
import { EngineeringSurveyWorkPageClient } from "../../../../../components/party-tasks/EngineeringSurveyWorkPageClient";

export default async function ActiveSurveyEntryPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return (
    <EngineeringSurveyWorkPageClient taskId={decodeTaskParam(taskId)} entry />
  );
}
