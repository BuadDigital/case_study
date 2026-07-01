"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button, cn } from "@platform/design-system";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { canEditProperty } from "../../lib/prototype/po-roles";
import {
  poPropertyEditPath,
} from "../../lib/po-routes";
import { caseStudyWorkspacePath } from "../../lib/my-task-routes";
import { caseStudyTaskForProperty } from "../../lib/prototype/tasks-storage";
import { canOpenCaseStudyWorkspace } from "../../lib/prototype/viewer-task-access";
import { usePoRecordQuery, useWorkflowTasksQuery } from "../../query/case-study-queries";

const linkButtonClass = (variant: "default" | "primary" = "default") =>
  cn(
    "inline-flex items-center justify-center gap-[5px] rounded-[var(--radius-DEFAULT)] border-[0.5px] border-solid px-2.5 py-1.5 text-xs font-normal no-underline transition-[background,border-color] duration-150 sm:whitespace-nowrap",
    variant === "primary"
      ? "border-primary bg-primary text-white hover:border-primary-mid hover:bg-primary-mid"
      : "border-border-md bg-surface text-text hover:bg-surface-2",
  );

export function PoPropertyDetailTopbarActions({
  poNumber,
  propertyId,
}: {
  poNumber: string;
  propertyId: string;
}) {
  const router = useRouter();
  const { role } = usePrototype();
  const showEdit = canEditProperty(role);
  const { data: record } = usePoRecordQuery(poNumber);
  const { data: tasks = [] } = useWorkflowTasksQuery();

  const property = useMemo(
    () => record?.properties.find((item) => item.id === propertyId) ?? null,
    [record, propertyId],
  );

  const task = useMemo(() => {
    if (!record || !property) return null;
    return caseStudyTaskForProperty(record.poNumber.trim(), property.id, tasks);
  }, [record, property, tasks]);

  const showCaseStudyLink = useMemo(() => {
    if (!task) return false;
    return canOpenCaseStudyWorkspace(role, task, tasks);
  }, [task, role, tasks]);

  if (!record || !property) return null;

  const needsBourse = !property.bourseDataCompleted;

  return (
    <div
      className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5 sm:gap-2"
      aria-label="إجراءات العقار"
    >
      {showEdit ? (
        <Button
          type="button"
          size="sm"
          onClick={() => router.push(poPropertyEditPath(poNumber, property.id))}
        >
          <span className="sm:hidden">تعديل</span>
          <span className="max-sm:hidden">تعديل العقار</span>
        </Button>
      ) : null}
      {needsBourse ? (
        <Link href="/bourse-inquiry" className={linkButtonClass()}>
          <span className="sm:hidden">البورصة</span>
          <span className="max-sm:hidden">استعلام البورصة</span>
        </Link>
      ) : null}
      {showCaseStudyLink && task ? (
        <Link
          href={caseStudyWorkspacePath(task.id)}
          className={linkButtonClass("primary")}
        >
          <span className="sm:hidden">دراسة الحالة</span>
          <span className="max-sm:hidden">فتح دراسة الحالة</span>
        </Link>
      ) : null}
    </div>
  );
}
