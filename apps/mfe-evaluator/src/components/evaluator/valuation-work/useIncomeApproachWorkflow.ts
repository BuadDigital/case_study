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
  incomeFieldsFromDto,
  incomeSaveRequest,
  incomeWarnings,
  type IncomeApproachFields,
} from "./lib/income-approach-state";
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
 * D17 — owns the income-approach drafts: loads the saved row once per valuation request, keeps the
 * typed strings local (typing does not re-render the shell), previews the chain and saves.
 */
export function useIncomeApproachWorkflow({
  valuationRequestId,
  locked = false,
  onSavingChange,
  onIncomeSaved,
}: IncomeApproachWorkflowArgs) {
  const { showToast } = useToast();
  const { reportSaveFailure, clearSaveErrors } = useValuationWorkErrors();
  const [fields, setFields] = useState<IncomeApproachFields>(emptyIncomeFields);
  const [saved, setSaved] = useState<ValuationIncomeApproachDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    });
    return () => {
      cancelled = true;
    };
  }, [valuationRequestId]);

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
    if (!config || !valuationRequestId || locked) return;
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
    locked,
    onIncomeSaved,
    onSavingChange,
    reportSaveFailure,
    showToast,
    valuationRequestId,
  ]);

  return { fields, setField, derived, warnings, saved, loadError, saveIncome };
}

export type IncomeApproachWorkflow = ReturnType<typeof useIncomeApproachWorkflow>;
