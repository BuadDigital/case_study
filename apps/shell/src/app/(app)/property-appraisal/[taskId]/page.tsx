// مكوّن خادم — كانت الصفحة "use client" فقط لفك params (server-side).
import { decodeTaskParam } from "@case-study/mfe/lib/my-task-routes";
import { PropertyAppraisalWorkPageClient } from "../../../../components/party-tasks/PropertyAppraisalWorkPageClient";

export default async function PropertyAppraisalWorkPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <PropertyAppraisalWorkPageClient taskId={decodeTaskParam(taskId)} />;
}
