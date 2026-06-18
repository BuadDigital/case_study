"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardBody, CardHeader, Button, cn, useToast } from "@platform/design-system";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { failureProblemTypeLabel } from "../../lib/failure-types-data";
import { createFailure } from "../../lib/failures-repository";
import {
  failureSeverityLabel,
  failureStatusLabel,
} from "../../lib/failures-local-storage";
import type { FailureSeverity } from "../../lib/failures-types";
import { isActiveFailureStatus } from "../../lib/failures-types";
import { useFailuresQuery } from "../../query/failures-queries";
import { FailureRaiseFields } from "./FailureRaiseFields";

const noteWarnClass = cn(
  "rounded-[var(--radius-DEFAULT)] border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text",
);

export function FailureRaisePanel({
  poNumber,
  propertyId,
  deedNumber,
  specialist,
  raisedByRole,
  onSubmitted,
}: {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  specialist: string;
  raisedByRole: string;
  onSubmitted?: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: failures = [] } = useFailuresQuery();
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState<FailureSeverity>("internal");
  const [problemTypeId, setProblemTypeId] = useState("");
  const [note, setNote] = useState("");

  const activeFailure = useMemo(
    () =>
      failures.find(
        (f) =>
          f.poNumber === poNumber &&
          f.propertyId === propertyId &&
          isActiveFailureStatus(f.status),
      ) ?? null,
    [failures, poNumber, propertyId],
  );

  function handleSubmit() {
    if (!problemTypeId || activeFailure) return;
    void createFailure({
      poNumber,
      propertyId,
      deedNumber,
      problemTypeId,
      severity,
      raisedByRole,
      internalNote: note,
      specialist,
    }).then(() => {
      void queryClient.invalidateQueries({ queryKey: prototypeKeys.failures() });
      setOpen(false);
      setProblemTypeId("");
      setNote("");
      showToast("تم تسجيل التعذر.", "success");
      onSubmitted?.();
    });
  }

  if (activeFailure && !open) {
    const title = failureProblemTypeLabel(
      activeFailure.problemTypeId,
      activeFailure.title,
    );
    return (
      <FailureCard>
        <div className={noteWarnClass}>
          <strong>تعذر مسجّل على هذا العقار:</strong> {title}
          <div className="mt-1.5 text-xs text-text-2">
            {failureSeverityLabel(activeFailure.severity)} ·{" "}
            {failureStatusLabel(activeFailure.status)}
          </div>
          <div className="mt-2.5">
            <Link
              href="/failures"
              className="inline-flex items-center justify-center rounded-[var(--radius-DEFAULT)] border border-border-md bg-surface px-2 py-1 text-[11px] text-text no-underline transition-colors hover:bg-surface-2"
            >
              إدارة التعذرات
            </Link>
          </div>
        </div>
      </FailureCard>
    );
  }

  return (
    <FailureCard>
      {!open ? (
        <Button
          type="button"
          variant="dangerOutline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          تسجيل تعذر على العقار
        </Button>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-semibold">رفع تعذر</span>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
          <FailureRaiseFields
            idPrefix={`raise-${propertyId}`}
            severity={severity}
            onSeverityChange={setSeverity}
            problemTypeId={problemTypeId}
            onProblemTypeIdChange={setProblemTypeId}
            note={note}
            onNoteChange={setNote}
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!problemTypeId}
            onClick={handleSubmit}
          >
            {severity === "internal" ? "حفظ تعذر داخلي" : "تسجيل احتمال تعذر"}
          </Button>
        </div>
      )}
    </FailureCard>
  );
}

function FailureCard({ children }: { children: ReactNode }) {
  return (
    <Card className="mt-4 overflow-hidden shadow-none">
      <CardHeader>
        <span className="text-[13px] font-semibold text-text">التعذرات</span>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}
