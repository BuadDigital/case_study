"use client";

import type { ReactNode } from "react";
import { EngInfo } from "./EvaluatorHtmlPrimitives";
import { GhostBtn, PrimaryBtn } from "./valuation-work/atoms";

export type EvaluatorNoticeAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** The main action is filled, the others are outlined. */
  primary?: boolean;
};

/** An amber notice with a sentence and one or two buttons (never acts on its own). */
export function EvaluatorActionNotice({
  message,
  actions,
  variant = "amber",
  testId,
}: {
  message: ReactNode;
  actions: EvaluatorNoticeAction[];
  variant?: "gold" | "amber" | "red";
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <EngInfo variant={variant}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="min-w-0 flex-1 font-semibold">{message}</span>
          <span className="flex flex-wrap items-center gap-2">
            {actions.map((action) =>
              action.primary ? (
                <PrimaryBtn
                  key={action.label}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.label}
                </PrimaryBtn>
              ) : (
                <GhostBtn
                  key={action.label}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.label}
                </GhostBtn>
              ),
            )}
          </span>
        </div>
      </EngInfo>
    </div>
  );
}
