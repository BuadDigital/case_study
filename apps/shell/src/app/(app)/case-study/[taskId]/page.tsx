"use client";

import { use } from "react";
import {
  CaseStudyWorkspaceView,
  decodeTaskParam,
} from "@case-study/mfe";

export default function CaseStudyWorkspacePage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  return <CaseStudyWorkspaceView taskId={decodeTaskParam(taskId)} />;
}
