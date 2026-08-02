"use client";

import { use } from "react";
import { PartyActiveTaskWorkPage, decodeTaskParam } from "@case-study/mfe";

export default function ActiveInspectionWorkPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  return (
    <PartyActiveTaskWorkPage
      pageId="active-inspection"
      taskId={decodeTaskParam(taskId)}
    />
  );
}
