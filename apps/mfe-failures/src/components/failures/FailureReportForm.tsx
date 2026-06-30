"use client";

import { useState } from "react";
import { Button, Card, CardBody, CardHeader } from "@platform/design-system";
import { failureProblemTypeLabel } from "../../lib/failure-types-data";
import { createFailure } from "../../lib/failures-repository";
import type { FailureSeverity } from "../../lib/failures-types";
import { FailureRaiseFields } from "./FailureRaiseFields";

export function FailureReportForm({
  poNumber,
  propertyId,
  deedNumber,
  specialist,
  raisedByRole = "الأخصائي",
  onDone,
  onCancel,
}: {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  specialist: string;
  raisedByRole?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [severity, setSeverity] = useState<FailureSeverity>("internal");
  const [problemTypeId, setProblemTypeId] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit() {
    if (!problemTypeId.trim()) return;
    void createFailure({
      poNumber,
      propertyId,
      deedNumber,
      problemTypeId,
      title: failureProblemTypeLabel(problemTypeId),
      severity,
      raisedByRole,
      internalNote: note,
      specialist,
    }).then(() => onDone());
  }

  return (
    <Card className="mb-4 overflow-hidden shadow-none">
      <CardHeader>
        <span className="text-[13px] font-semibold text-text">
          تسجيل تعذر — {deedNumber || poNumber}
        </span>
      </CardHeader>
      <CardBody>
        <FailureRaiseFields
          severity={severity}
          onSeverityChange={setSeverity}
          problemTypeId={problemTypeId}
          onProblemTypeIdChange={setProblemTypeId}
          note={note}
          onNoteChange={setNote}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!problemTypeId.trim()}
            onClick={handleSubmit}
          >
            {severity === "internal" ? "حفظ تعذر داخلي" : "تسجيل احتمال تعذر"}
          </Button>
          <Button type="button" size="sm" onClick={onCancel}>
            إلغاء
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
