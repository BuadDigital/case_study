"use client";

import type { Dispatch, SetStateAction } from "react";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import { inspectorChangedMessage } from "../../lib/evaluator/inspector-data-changes";
import { EvaluatorActionNotice } from "./EvaluatorActionNotice";
import { useInspectorChangedBanner } from "./useInspectorChangedBanner";

/**
 * «تغيّرت بيانات المعاين منذ اطلاعك: …» — shown while the inspector's data differs from what the
 * appraiser last acknowledged. «اطّلعت» saves the fingerprint he saw into his own draft; nothing
 * else acknowledges it (not a fetch, not an edit).
 */
export function InspectorChangedBanner({
  taskId,
  draft,
  locked,
  setDraft,
  onError,
}: {
  taskId: string;
  draft: EvaluatorSubmission;
  locked: boolean;
  setDraft: Dispatch<SetStateAction<EvaluatorSubmission>>;
  onError?: (message: string) => void;
}) {
  const { state, busy, acknowledge } = useInspectorChangedBanner({
    taskId,
    draft,
    locked,
    setDraft,
    onError,
  });
  if (state.kind !== "changed") return null;
  return (
    <EvaluatorActionNotice
      testId="inspector-changed-banner"
      message={inspectorChangedMessage(state.labels)}
      actions={[
        {
          label: "اطّلعت",
          onClick: () => void acknowledge(),
          disabled: busy,
          primary: true,
        },
      ]}
    />
  );
}
