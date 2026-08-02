"use client";

import { useEffect, useRef, type RefObject } from "react";
import { cn } from "@platform/design-system";

/** Case Study.html `tf-lbl` */
const labelClassName =
  "mb-[7px] block text-[12px] font-semibold text-text-2";

/**
 * Case Study.html `INP_STYLE` — no gold focus ring (avoids beige autofocus look).
 */
const textareaClassName = cn(
  "box-border w-full min-h-[88px] resize-y rounded-[9px]",
  "border border-border-2 bg-surface px-3 py-[9px]",
  "font-[inherit] text-[13px] leading-relaxed text-text",
  "outline-none transition-[border-color,box-shadow]",
  "placeholder:text-text-3",
  "focus:border-ink/35 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ink)_10%,transparent)]",
  "disabled:cursor-not-allowed disabled:opacity-70",
);

/**
 * HTML-template failure fields — وصف التعذر only.
 */
export function FailureRaiseFields({
  description,
  onDescriptionChange,
  idPrefix = "fail",
  invalid = false,
  disabled = false,
  autoFocus = false,
  textareaRef: externalRef,
}: {
  description: string;
  onDescriptionChange: (value: string) => void;
  idPrefix?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = externalRef ?? localRef;

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus, ref]);

  return (
    <div className="min-w-0 w-full">
      <label htmlFor={`${idPrefix}_description`} className={labelClassName}>
        وصف التعذر{" "}
        <span className="font-bold text-[#c0553d]" aria-hidden>
          *
        </span>
      </label>
      <textarea
        id={`${idPrefix}_description`}
        ref={ref}
        rows={3}
        disabled={disabled}
        value={description}
        placeholder="صف التعذر الميداني…"
        className={cn(
          textareaClassName,
          invalid &&
            "border-[#c0553d] focus:border-[#c0553d] focus:shadow-[0_0_0_3px_rgba(192,85,61,0.14)]",
        )}
        onChange={(e) => onDescriptionChange(e.target.value)}
      />
    </div>
  );
}

/** Free-text HTML raise → API payload defaults. */
export const FAILURE_HTML_DEFAULT_PROBLEM_TYPE_ID = "access-denied";

export function failurePayloadFromDescription(description: string): {
  problemTypeId: string;
  title: string;
  severity: "internal";
  internalNote: string;
} {
  const trimmed = description.trim();
  return {
    problemTypeId: FAILURE_HTML_DEFAULT_PROBLEM_TYPE_ID,
    title: trimmed.slice(0, 120),
    severity: "internal",
    internalNote: trimmed,
  };
}
