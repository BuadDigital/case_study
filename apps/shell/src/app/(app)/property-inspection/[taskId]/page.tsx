// مكوّن خادم — كانت الصفحة "use client" فقط لفك params (server-side).
import { PartyActiveTaskWorkPage } from "@case-study/mfe/views/PartyActiveTaskWorkPage";
import { decodeTaskParam } from "@case-study/mfe/lib/my-task-routes";

export default async function PropertyInspectionWorkPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return (
    <PartyActiveTaskWorkPage
      pageId="property-inspection"
      taskId={decodeTaskParam(taskId)}
    />
  );
}
