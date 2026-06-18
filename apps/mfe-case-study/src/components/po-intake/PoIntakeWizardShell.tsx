"use client";

import type { ReactNode } from "react";
import { PO_INTAKE_FLOW } from "../../lib/prototype/po-intake-data";
import { StepIndicator } from "@platform/app-shared/registration/StepIndicator";
import {
  REG_BACK,
  REG_PREV,
} from "@platform/app-shared/registration/registration-labels";
import { UNSAVED_CONFIRM_MSG } from "@platform/app-shared/registration/registration-utils";
import { Badge, Button, cn } from "@platform/design-system";

export function PoIntakeWizardShell({
  steps,
  step,
  hint,
  saving,
  success,
  showPrev,
  nextLabel,
  isDirty,
  onBack,
  onPrev,
  onNext,
  footerExtra,
  flowTitle,
  flowDept,
  hideWizardChrome,
  children,
}: {
  steps: readonly string[];
  step: number;
  hint: string;
  saving?: boolean;
  success?: boolean;
  showPrev: boolean;
  nextLabel: string;
  isDirty?: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  footerExtra?: ReactNode;
  /** Override default PO intake title (e.g. property registration). */
  flowTitle?: string;
  flowDept?: string;
  /** PO receive flow: form only — no dept/title/step chrome. */
  hideWizardChrome?: boolean;
  children: ReactNode;
}) {
  const meta = PO_INTAKE_FLOW;
  const title = flowTitle ?? meta.title;
  const dept = flowDept ?? meta.dept;
  const inWizard = !success && step <= steps.length;
  const displayStep = Math.min(step, steps.length);

  function handleBack() {
    if (isDirty && !window.confirm(UNSAVED_CONFIRM_MSG)) return;
    onBack();
  }

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col overflow-hidden",
        inWizard && "-mx-2 -mt-2.5 w-[calc(100%+16px)]",
      )}
    >
      <div className="flex min-h-0 flex-1 items-stretch">
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            inWizard ? "bg-surface-2" : "bg-surface-2",
            success && "bg-surface",
          )}
        >
          {!inWizard ? (
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-6 py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Button type="button" size="sm" onClick={handleBack}>
                  {REG_BACK}
                </Button>
                <div className="min-w-0">
                  <div className="mb-0.5 text-[11px] text-primary">{title}</div>
                </div>
              </div>
              {success ? (
                <Badge tone="success" className="text-[10.5px]">
                  مكتمل
                </Badge>
              ) : null}
            </header>
          ) : null}

          {inWizard ? (
            <div className="flex min-h-0 flex-1 justify-center overflow-y-auto bg-surface-2 px-6 py-2 pb-5">
              <div className="flex max-h-[calc(100vh-132px)] w-full max-w-[680px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-card">
                <header className="flex shrink-0 items-center justify-between gap-2.5 border-b border-border bg-surface px-5 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Button type="button" size="sm" onClick={handleBack}>
                      {REG_BACK}
                    </Button>
                    {hideWizardChrome ? null : (
                      <div className="min-w-0">
                        <div className="mb-0.5 text-[11px] text-primary">
                          {dept}
                        </div>
                        <div className="text-[13px] font-bold leading-snug text-text">
                          {title}
                        </div>
                      </div>
                    )}
                  </div>
                  {hideWizardChrome ? null : (
                    <Badge tone="primary" className="shrink-0 text-[10.5px]">
                      الخطوة {displayStep} من {steps.length}
                    </Badge>
                  )}
                </header>
                {hideWizardChrome ? null : (
                  <StepIndicator steps={[...steps]} current={step} />
                )}
                {!hideWizardChrome && hint ? (
                  <p className="m-0 px-5 py-2 text-start text-xs font-semibold leading-snug text-text-2">
                    {hint}
                  </p>
                ) : null}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-1.5">
                  {children}
                </div>
                <footer className="shrink-0 border-t border-border bg-surface-2 px-5 py-2.5">
                  {footerExtra}
                  <div className="flex w-full justify-end gap-2">
                    {showPrev ? (
                      <Button type="button" onClick={onPrev}>
                        {REG_PREV}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="primary"
                      loading={saving}
                      disabled={saving}
                      onClick={onNext}
                    >
                      {nextLabel}
                    </Button>
                  </div>
                </footer>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "mx-auto min-h-0 w-full max-w-[880px] flex-1 overflow-y-auto px-6 py-5",
                success && "flex items-start justify-center bg-surface pt-8 pb-10",
              )}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
