// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Income  New file — owns the income-approach drafts: loads the saved row once per valuation
//            request, keeps typed strings local, previews the chain and saves.
// Round 2 (1b19bedc)
//  • New loaded flag (save refused until the row loads) and retryLoad («إعادة المحاولة»).
//  • Unsaved income drafts raise the refresh warning («income-approach», setSectionUnsaved), with no
//          effect cleanup so an <Activity>-hidden screen keeps it.
//  • B    The save checks incomeSaveErrors first (cap-rate bounds, 10-character rationale) and marks
//         the field.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getValuationIncomeApproach,
  saveValuationIncomeApproach,
  type ValuationIncomeApproachDto,
} from "@platform/api-client";
import { useToast } from "@platform/ui-kit";

import {
  emptyIncomeFields,
  incomeDerived,
  incomeFieldsDiffer,
  incomeFieldsFromDto,
  incomeSaveErrors,
  incomeSaveRequest,
  incomeWarnings,
  type IncomeApproachFields,
} from "./lib/income-approach-state";
import { setSectionUnsaved } from "../../../lib/evaluator/unsaved-edits";
import { INCOME_FIELD_ERROR_KEYS } from "./lib/valuation-work-error-targets";
import { apiConfig } from "./lib/shell-utils";
import { useValuationWorkErrors } from "./ValuationWorkErrors";

type IncomeApproachWorkflowArgs = {
  valuationRequestId: string | null;
  /** The appraiser's package is submitted: the numbers are closed (server-locked). */
  locked?: boolean;
  onSavingChange: (saving: boolean) => void;
  /** After a save: the shell refreshes the reconciliation, the gates and the printed report. */
  onIncomeSaved: (dto: ValuationIncomeApproachDto) => void;
};

/**
 * Owns the income-approach drafts: loads the saved row once per valuation request, keeps the
 * typed strings local (typing does not re-render the shell), previews the chain and saves.
 */
export function useIncomeApproachWorkflow({
  valuationRequestId,
  locked = false,
  onSavingChange,
  onIncomeSaved,
}: IncomeApproachWorkflowArgs) {
  const { showToast } = useToast();
  const { reportSaveFailure, reportFieldError, clearSaveErrors } = useValuationWorkErrors();
  const [fields, setFields] = useState<IncomeApproachFields>(emptyIncomeFields);
  const [saved, setSaved] = useState<ValuationIncomeApproachDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** The saved row arrived — until then the inputs and the save stay closed (nothing to overwrite). */
  const [loaded, setLoaded] = useState(false);
  /** Bumped by «إعادة المحاولة» after a failed load. */
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    let cancelled = false;
    void getValuationIncomeApproach(config, valuationRequestId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setLoadError("تعذّر تحميل أسلوب الدخل — أعد المحاولة");
        return;
      }
      setLoadError(null);
      setSaved(res.data);
      setFields(incomeFieldsFromDto(res.data));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [valuationRequestId, loadAttempt]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadAttempt((n) => n + 1);
  }, []);

  // Problem 19: typed-but-unsaved income drafts make the window warn before a refresh. No cleanup —
  // <Activity> hiding the screen runs cleanups while the drafts are still unsaved.
  const unsaved = loaded && incomeFieldsDiffer(fields, saved);
  useEffect(() => {
    setSectionUnsaved("income-approach", unsaved);
  }, [unsaved]);

  const setField = useCallback(
    <K extends keyof IncomeApproachFields>(key: K, value: IncomeApproachFields[K]) => {
      setFields((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
      clearSaveErrors(
        key === "opexMode" ? "operatingExpensesMode" : INCOME_FIELD_ERROR_KEYS[key as Exclude<keyof IncomeApproachFields, "opexMode">],
      );
    },
    [clearSaveErrors],
  );

  const derived = incomeDerived(fields);
  const warnings = incomeWarnings(derived);

  const saveIncome = useCallback(async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId || locked || !loaded) return;
    const refused = incomeSaveErrors(fields);
    if (refused) {
      const [key, message] = Object.entries(refused)[0]!;
      reportFieldError(key, message);
      return;
    }
    onSavingChange(true);
    const res = await saveValuationIncomeApproach(config, valuationRequestId, incomeSaveRequest(fields));
    onSavingChange(false);
    if (!res.ok) {
      reportSaveFailure(res, "تعذّر حفظ أسلوب الدخل");
      return;
    }
    clearSaveErrors();
    setSaved(res.data);
    setFields(incomeFieldsFromDto(res.data));
    showToast("تم حفظ أسلوب الدخل", "success");
    onIncomeSaved(res.data);
  }, [
    clearSaveErrors,
    fields,
    loaded,
    locked,
    onIncomeSaved,
    onSavingChange,
    reportFieldError,
    reportSaveFailure,
    showToast,
    valuationRequestId,
  ]);

  return { fields, setField, derived, warnings, saved, loaded, loadError, retryLoad, saveIncome };
}

export type IncomeApproachWorkflow = ReturnType<typeof useIncomeApproachWorkflow>;
