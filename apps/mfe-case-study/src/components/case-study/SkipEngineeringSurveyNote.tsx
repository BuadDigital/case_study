"use client";

import { useState } from "react";
import { Button, Note, useToast } from "@platform/ui-kit";
import { FeeActionReasonModal } from "@platform/app-shared/fees/FeeActionReasonModal";
import { skipEngineeringSurveyOfTask } from "../../lib/app-data/tasks-commands";

/**
 * «تجاوز المكتب الهندسي» (Omar 2026-11-11) — the study settles the engineering office before the
 * study reaches the appraiser: the office is needed (wait for its work and receive it), or the study
 * goes on without it and the office earns no fee.
 *
 * How it works: shown over the office's section while its task is open (not delivered) and the
 * study report is not issued; the button asks for a reason, then the server cancels the office's
 * task and tells the office. The task lists refresh, so the office's section leaves the page.
 * Edge cases: the parent decides when to show it (an open survey, a viewer who may decide); a
 * refusal is shown as the server words it (e.g. the office delivered meanwhile).
 */
export function SkipEngineeringSurveyNote({ caseStudyTaskId }: { caseStudyTaskId: string }) {
  const { showToast } = useToast();
  const [asking, setAsking] = useState(false);

  async function skip(reason: string) {
    const result = await skipEngineeringSurveyOfTask(caseStudyTaskId, reason);
    showToast(
      result.ok ? "تم تجاوز المكتب الهندسي وأُبلغ المكتب" : result.error,
      result.ok ? "success" : "error",
    );
  }

  return (
    <Note tone="warn" className="mb-3" data-testid="skip-engineering-survey">
      <div className="flex flex-wrap items-center gap-3">
        <p className="m-0 min-w-[240px] flex-1 text-sm">
          لم يسلّم المكتب الهندسي عمله بعد، ولا يصدر تقرير دراسة الحالة حتى يُحسم أمره: انتظر عمله
          واستلمه إن كان ضروريًا، أو تجاوز عنه فتُرسل الدراسة بدونه ولا تُحتسب له أتعاب.
        </p>
        <Button type="button" variant="outline" onClick={() => setAsking(true)}>
          تجاوز المكتب الهندسي
        </Button>
      </div>
      <FeeActionReasonModal
        open={asking}
        title="تجاوز المكتب الهندسي"
        label="سبب التجاوز (يُبلَّغ به المكتب)"
        placeholder="مثال: الصك مطابق للطبيعة ولا حاجة لرفع مساحي"
        confirmLabel="تجاوز المكتب"
        onClose={() => setAsking(false)}
        onConfirm={skip}
      />
    </Note>
  );
}
