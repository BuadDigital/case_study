// مكوّن خادم — كانت الصفحة "use client" فقط لفك params (server-side)؛
// فك المعرّف يجري على الخادم ولا يُسلسل وعد params للعميل.
import { PartyActiveTaskWorkPage } from "@case-study/mfe/views/PartyActiveTaskWorkPage";
import { decodeTaskParam } from "@case-study/mfe/lib/my-task-routes";

export default async function ActiveInspectionWorkPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return (
    <PartyActiveTaskWorkPage
      pageId="active-inspection"
      taskId={decodeTaskParam(taskId)}
    />
  );
}
