// Server component — the page was "use client" only to unwrap params (server-side);
// id unwrap runs on the server and does not serialize the params promise to the client.
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
