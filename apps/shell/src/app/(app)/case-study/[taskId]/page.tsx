// Server component — the page was "use client" only to unwrap params (server-side).
import { CaseStudyWorkspaceView } from "@case-study/mfe/views/CaseStudyWorkspaceView";
import { decodeTaskParam } from "@case-study/mfe/lib/my-task-routes";

export default async function CaseStudyWorkspacePage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <CaseStudyWorkspaceView taskId={decodeTaskParam(taskId)} />;
}
