"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ReturnImpactDto,
  ReturnInspectionRequest,
  ReturnInspectionResultDto,
  ReturnInspectionStudyReportDecision,
} from "@platform/api-client";
import { useIdempotentAction } from "@platform/app-shared";
import { fetchReturnImpact } from "@platform/app-shared/app-data/party-submission-api";
import { returnInspectorWorkspace } from "../../lib/app-data/inspector-workspace-commands";
import {
  mapReturnInspectionFieldErrors,
  planReturnInspectionSubmit,
  reconcileAffectedTaskIds,
  toggleKey,
} from "../../lib/app-data/return-inspection-state";

type FieldErrors = {
  note?: string;
  studyReport?: string;
  studyReportReason?: string;
};

/**
 * State and commands of the «إعادة المعاينة للمعاين» dialog: the section picks, the affected
 * parties loaded from `return-impact` (reloaded whenever the sections change), the study-report
 * decision and the single idempotent return call.
 */
export function useReturnInspectionForm({
  inspectionTaskId,
  onReturned,
}: {
  inspectionTaskId: string;
  onReturned?: (result: ReturnInspectionResultDto) => void;
}) {
  const [note, setNote] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const [affected, setAffected] = useState<string[]>([]);
  const [studyReport, setStudyReport] =
    useState<ReturnInspectionStudyReportDecision | null>(null);
  const [studyReportReason, setStudyReportReason] = useState("");
  const [impact, setImpact] = useState<ReturnImpactDto | null>(null);
  const [impactLoading, setImpactLoading] = useState(true);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [impactRetry, setImpactRetry] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  /** The server asked for the decision although the impact load did not say the report is issued. */
  const [serverNeedsStudyReport, setServerNeedsStudyReport] = useState(false);
  const [result, setResult] = useState<ReturnInspectionResultDto | null>(null);
  const partiesTouchedRef = useRef(false);
  const requestRef = useRef<ReturnInspectionRequest | null>(null);

  const sectionsKey = sections.join(",");
  useEffect(() => {
    let cancelled = false;
    setImpactLoading(true);
    setImpactError(null);
    void fetchReturnImpact(inspectionTaskId, sectionsKey ? sectionsKey.split(",") : []).then(
      (loaded) => {
        if (cancelled) return;
        setImpactLoading(false);
        if (!loaded.ok) {
          setImpactError(loaded.error);
          return;
        }
        setImpact(loaded.data);
        setAffected((current) =>
          reconcileAffectedTaskIds({
            parties: loaded.data.parties,
            current,
            touched: partiesTouchedRef.current,
          }),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [inspectionTaskId, sectionsKey, impactRetry]);

  const { execute, loading: busy } = useIdempotentAction(
    useCallback(
      async (idempotencyKey: string) =>
        returnInspectorWorkspace(inspectionTaskId, requestRef.current!, idempotencyKey),
      [inspectionTaskId],
    ),
  );

  const studyReportIssued = Boolean(impact?.studyReportIssued) || serverNeedsStudyReport;

  const toggleSection = (key: string) => setSections((cur) => toggleKey(cur, key));

  const toggleParty = (taskId: string) => {
    partiesTouchedRef.current = true;
    setAffected((cur) => toggleKey(cur, taskId));
  };

  const submit = async () => {
    if (busy || result) return;
    setServerError(null);
    const plan = planReturnInspectionSubmit({
      note,
      sections,
      affectedTaskIds: affected,
      studyReportIssued,
      studyReport,
      studyReportReopenReason: studyReportReason,
    });
    if (!plan.ok) {
      setFieldErrors({
        note: plan.field === "note" ? plan.error : undefined,
        studyReport: plan.field === "studyReport" ? plan.error : undefined,
        studyReportReason:
          plan.field === "studyReportReason" ? plan.error : undefined,
      });
      return;
    }
    setFieldErrors({});
    requestRef.current = plan.request;
    const outcome = await execute();
    if (outcome.status === "skipped") return;
    const returned = outcome.value;
    if (!returned.ok) {
      const mapped = mapReturnInspectionFieldErrors(returned.errors);
      if (mapped.studyReport) setServerNeedsStudyReport(true);
      setFieldErrors(mapped);
      setServerError(
        mapped.note || mapped.studyReport || mapped.studyReportReason
          ? null
          : returned.error,
      );
      return;
    }
    setResult(returned.data);
    onReturned?.(returned.data);
  };

  return {
    note,
    setNote: (value: string) => {
      setNote(value);
      setFieldErrors((e) => (e.note ? { ...e, note: undefined } : e));
    },
    sections,
    toggleSection,
    affected,
    toggleParty,
    impact,
    impactLoading,
    impactError,
    retryImpact: () => setImpactRetry((n) => n + 1),
    studyReportIssued,
    studyReport,
    setStudyReport: (value: ReturnInspectionStudyReportDecision) => {
      setStudyReport(value);
      setFieldErrors((e) => ({ ...e, studyReport: undefined }));
    },
    studyReportReason,
    setStudyReportReason: (value: string) => {
      setStudyReportReason(value);
      setFieldErrors((e) => ({ ...e, studyReportReason: undefined }));
    },
    fieldErrors,
    serverError,
    busy,
    result,
    submit,
  };
}
