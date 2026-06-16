"use client";

import {
  formatPropertyDeedDisplay,
  requiresAssignmentDecree,
  type AssignmentType,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import { Button, Card, CardBody, CardHeader, cn } from "@platform/design-system";
import { isValidContactEntry } from "./po-property-validation";

export function PoPropertyStackCard({
  index,
  property,
  assignmentType,
  onEdit,
  onRemove,
}: {
  index: number;
  property: PoPropertyIntake;
  assignmentType: AssignmentType;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const contactCount = property.contacts.filter((c) =>
    isValidContactEntry(c),
  ).length;
  const location = property.bourseDataCompleted
    ? [property.city, property.district].filter(Boolean).join(" · ")
    : "بانتظار البورصة";
  const typeLabel =
    property.propertyType || property.classification || "—";
  const deedLabel = formatPropertyDeedDisplay(property);

  return (
    <Card
      className="rounded-[10px] bg-surface-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      aria-label={`عقار ${index}`}
    >
      <CardHeader className="items-start gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-bold text-primary">عقار {index}</span>
          <span className="break-all text-[13px] font-semibold text-text" dir="ltr">
            {deedLabel}
          </span>
          {property.taskNumber ? (
            <span className="text-[11px] text-text-3">
              مهمة: {property.taskNumber}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button type="button" size="sm" onClick={onEdit}>
            تعديل
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="border-red/30 bg-transparent hover:bg-danger-bg/60"
            onClick={onRemove}
          >
            حذف
          </Button>
        </div>
      </CardHeader>
      <CardBody className="px-4 py-3 text-xs leading-relaxed text-text-2">
        <p className="m-0">{location || "—"}</p>
        <p className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-text-3">
          <span>{typeLabel}</span>
          <span aria-hidden>·</span>
          <span>
            {contactCount}{" "}
            {contactCount === 1 ? "ضابط اتصال" : "ضباط اتصال"}
          </span>
          {requiresAssignmentDecree(assignmentType) ? (
            <>
              <span aria-hidden>·</span>
              <span
                className={cn(
                  property.assignmentDocFileName.trim()
                    ? "text-success-text"
                    : "font-semibold text-danger-text",
                )}
              >
                قرار الإسناد:{" "}
                {property.assignmentDocFileName.trim() || "غير مرفق"}
              </span>
            </>
          ) : null}
        </p>
      </CardBody>
    </Card>
  );
}
