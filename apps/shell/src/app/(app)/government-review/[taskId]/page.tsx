"use client";

import { use } from "react";
import { PartyActiveTaskWorkPage, decodeTaskParam } from "@case-study/mfe";

export default function GovernmentReviewWorkPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  return (
    <PartyActiveTaskWorkPage
      pageId="government-review"
      taskId={decodeTaskParam(taskId)}
    />
  );
}