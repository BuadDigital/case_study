"use client";

import { useCallback } from "react";
import { Button, useToast } from "@platform/ui-kit";
import { previewGeneratedValuationReport } from "../../lib/evaluator/issue-valuation-report";
import { openEvaluatorReportPreview } from "../../lib/evaluator/evaluator-report-attachments";

export function EvaluatorIssuedReportActions({
  taskId,
  propertyId,
  reportNo,
  depositCode,
  issued,
  disabled,
  area,
  propertyType,
  appraiserName,
}: {
  taskId: string;
  propertyId: string;
  reportNo?: string;
  depositCode?: string;
  issued: boolean;
  disabled?: boolean;
  area?: string;
  propertyType?: string;
  appraiserName?: string;
}) {
  const { showToast } = useToast();

  const openLivePreview = useCallback(async () => {
    try {
      await previewGeneratedValuationReport({
        propertyId,
        extras: {
          reportNumber: reportNo,
          depositCode,
        },
        area,
        propertyType,
        appraiserName,
      });
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر فتح استعراض تقرير التقييم",
        "error",
      );
    }
  }, [appraiserName, area, depositCode, propertyId, propertyType, reportNo, showToast]);

  const openIssuedSnapshot = useCallback(async () => {
    const opened = await openEvaluatorReportPreview(taskId);
    if (!opened) {
      await openLivePreview();
    }
  }, [openLivePreview, taskId]);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => void openLivePreview()}
      >
        استعراض تقرير التقييم
      </Button>
      {issued ? (
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void openIssuedSnapshot()}
        >
          تحميل تقرير التقييم المعتمد
        </Button>
      ) : null}
    </div>
  );
}
