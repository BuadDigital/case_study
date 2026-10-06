"use client";

import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { scheduleScrollToFirstFormField } from "@platform/app-shared/form-ux";
import { useOptionalToast } from "@platform/ui-kit";

import type { ValuationWorkScreenId } from "./lib/shell-state";
import {
  firstValuationWorkError,
  normalizeValuationWorkErrors,
  valuationWorkErrorMessage,
} from "./lib/valuation-work-error-targets";

/** The failure half of an api-client write result. */
export type ValuationWorkSaveFailure = {
  kind?: string;
  message?: string;
  errors?: Record<string, string | string[]> | null;
};

export type ValuationWorkErrorsApi = {
  /** Send-time field errors merged with the last failed save. */
  fieldErrors: Record<string, string>;
  /**
   * A failed write: marks the field the server named, moves to the screen that
   * owns it and scrolls to it, then shows the message. Falls back to the plain
   * message when the server named no field we know.
   */
  reportSaveFailure: (
    failure: ValuationWorkSaveFailure,
    fallbackMessage: string,
  ) => void;
  /** Same marking for a local pre-check, before the write is attempted. */
  reportFieldError: (key: string, message: string) => void;
  /** Drop one key (the appraiser edited it) or the whole save-error map. */
  clearSaveErrors: (key?: string) => void;
};

const ValuationWorkErrorsContext = createContext<ValuationWorkErrorsApi | null>(
  null,
);

/** Scroll lands after the screen switch paints — same budget as the send flow. */
const SCROLL_DELAY_MS = 120;
const SCROLL_RETRIES = 24;

export function ValuationWorkErrorsProvider({
  fieldErrors,
  onScreenChange,
  children,
}: {
  /** Send-time errors from `validateEvaluatorSubmission`. */
  fieldErrors?: Record<string, string>;
  onScreenChange: (screen: ValuationWorkScreenId) => void;
  children: ReactNode;
}) {
  const toast = useOptionalToast();
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const focus = useCallback(
    (errors: Record<string, string>) => {
      const first = firstValuationWorkError(errors);
      if (!first) return;
      onScreenChange(first.screen);
      scheduleScrollToFirstFormField(
        [first.targetId, first.fallbackTargetId],
        SCROLL_DELAY_MS,
        { retries: SCROLL_RETRIES },
      );
    },
    [onScreenChange],
  );

  const reportSaveFailure = useCallback(
    (failure: ValuationWorkSaveFailure, fallbackMessage: string) => {
      const errors = normalizeValuationWorkErrors(failure.errors);
      setSaveErrors(errors);
      focus(errors);
      toast?.showToast(
        valuationWorkErrorMessage(errors) ?? failure.message ?? fallbackMessage,
        "error",
      );
    },
    [focus, toast],
  );

  const reportFieldError = useCallback(
    (key: string, message: string) => {
      const errors = { [key]: message };
      setSaveErrors(errors);
      focus(errors);
      toast?.showToast(message, "error");
    },
    [focus, toast],
  );

  const clearSaveErrors = useCallback((key?: string) => {
    setSaveErrors((prev) => {
      if (!key) return Object.keys(prev).length ? {} : prev;
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const api = useMemo<ValuationWorkErrorsApi>(
    () => ({
      fieldErrors: { ...(fieldErrors ?? {}), ...saveErrors },
      reportSaveFailure,
      reportFieldError,
      clearSaveErrors,
    }),
    [clearSaveErrors, fieldErrors, reportFieldError, reportSaveFailure, saveErrors],
  );

  return (
    <ValuationWorkErrorsContext.Provider value={api}>
      {children}
    </ValuationWorkErrorsContext.Provider>
  );
}

/**
 * Outside the provider (unit tests, other hosts) the reporters still show the
 * message — they just have no field to mark.
 */
export function useValuationWorkErrors(): ValuationWorkErrorsApi {
  const context = use(ValuationWorkErrorsContext);
  const toast = useOptionalToast();
  const standalone = useMemo<ValuationWorkErrorsApi>(
    () => ({
      fieldErrors: {},
      reportSaveFailure: (failure, fallbackMessage) => {
        const errors = normalizeValuationWorkErrors(failure.errors);
        toast?.showToast(
          valuationWorkErrorMessage(errors) ??
            failure.message ??
            fallbackMessage,
          "error",
        );
      },
      reportFieldError: (_key, message) => toast?.showToast(message, "error"),
      clearSaveErrors: () => {},
    }),
    [toast],
  );
  return context ?? standalone;
}
