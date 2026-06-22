"use client";

import type { ReactNode } from "react";
import { cn } from "@platform/design-system";
import {
  ENTITY_SUBTITLES,
  FLOW_META,
  type RegistrationSource,
} from "../prototype/registration-data";
import { RegistrationSidePanel } from "./RegistrationSidePanel";
import { StepIndicator } from "./StepIndicator";
import { REG_BACK, REG_PREV } from "./registration-labels";
import { Button, FLOW_THEME, RegStepBadge } from "./registration-layout";
import { UNSAVED_CONFIRM_MSG } from "./registration-utils";

export function RegistrationWizardShell({
  source,
  steps,
  step,
  title,
  hint,
  saving,
  success,
  showPrev,
  nextLabel,
  isDirty,
  onBack,
  onPrev,
  onNext,
  children,
}: {
  source: RegistrationSource;
  steps: string[];
  step: number;
  title: string;
  hint: string;
  saving?: boolean;
  success?: boolean;
  showPrev: boolean;
  nextLabel: string;
  isDirty?: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
}) {
  const meta = FLOW_META[source];
  const theme = FLOW_THEME[source];
  const inWizard = !success && step <= steps.length;
  const displayStep = Math.min(step, steps.length);

  function handleBack() {
    if (isDirty && !window.confirm(UNSAVED_CONFIRM_MSG)) return;
    onBack();
  }

  return (
    <div
      className={cn(
        "mb-4 flex w-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card",
        theme.cardBorder,
        "border-t-[3px]",
        inWizard && "lg:min-h-[480px]",
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col items-stretch lg:flex-row">
        {inWizard ? (
          <RegistrationSidePanel source={source} onBack={handleBack} />
        ) : null}

        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-2",
            inWizard && "bg-surface",
          )}
        >
          {!inWizard ? (
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5 sm:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Button type="button" size="sm" onClick={handleBack}>
                  {REG_BACK}
                </Button>
                <div className="min-w-0">
                  <div className={cn("mb-0.5 text-[11px]", theme.flowText)}>
                    {meta.title}
                  </div>
                  <div className="text-sm font-bold leading-snug text-text">
                    {title}
                  </div>
                </div>
              </div>
              {success ? <RegStepBadge done>مكتمل</RegStepBadge> : null}
            </header>
          ) : null}

          {inWizard ? (
            <div className="flex min-h-0 flex-1 justify-stretch overflow-y-auto bg-surface p-0">
              <div className="flex w-full max-w-none flex-col overflow-hidden bg-surface">
                <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border bg-surface px-4 py-2.5 sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold leading-snug text-text">
                        الخطوة {displayStep} من {steps.length} — {title}
                      </div>
                      <div className="text-[11px] text-text-3" dir="ltr">
                        {ENTITY_SUBTITLES[source]}
                      </div>
                    </div>
                  </div>
                  <RegStepBadge>الخطوة {displayStep}</RegStepBadge>
                </header>
                <StepIndicator steps={steps} current={step} source={source} />
                {hint ? (
                  <p className="m-0 px-4 pb-1.5 pt-2 text-start text-xs font-semibold leading-snug text-text-2 sm:px-5">
                    {hint}
                  </p>
                ) : null}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-1 sm:px-5">
                  {children}
                </div>
                <footer className="shrink-0 border-t border-border bg-surface-2 px-4 py-2.5 sm:px-5">
                  <div className="hidden text-[11px] text-text-3">{hint}</div>
                  <div className="flex w-full justify-end gap-2">
                    {showPrev ? (
                      <Button type="button" onClick={onPrev}>
                        {REG_PREV}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="primary"
                      disabled={saving}
                      onClick={onNext}
                    >
                      {saving ? "جارٍ الحفظ..." : nextLabel}
                    </Button>
                  </div>
                </footer>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "mx-auto box-border w-full max-w-[880px] flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5",
                success && "flex items-start justify-center bg-surface py-8 max-w-none",
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
