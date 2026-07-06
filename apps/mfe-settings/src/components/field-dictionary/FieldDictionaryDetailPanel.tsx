"use client";

import { useEffect, useState } from "react";
import { Badge, Button, cn, useToast } from "@platform/design-system";
import {
  FIELD_DICTIONARY_SCREENS,
  FIELD_TYPE_LABELS,
  assignmentMode,
  assignmentReliability,
  fieldDictionaryRoleLabel,
  fieldDictionaryScreenName,
  fieldDictionaryLayer,
  FIELD_DICTIONARY_LAYER_LABELS,
  fieldReliabilityMode,
  type FieldDictionaryAssignment,
  type FieldDictionaryField,
} from "@platform/app-shared/prototype/field-dictionary";
import {
  FieldDictionaryAssignmentsEditor,
  normalizeFieldAssignments,
} from "./FieldDictionaryAssignmentsEditor";

type Props = {
  field: FieldDictionaryField;
  onUpdate: (field: FieldDictionaryField) => void;
  onDelete: () => void;
};

function copyRef(ref: string): void {
  try {
    void navigator.clipboard?.writeText(ref);
  } catch {
    /* ignore */
  }
}

export function FieldDictionaryDetailPanel({
  field,
  onUpdate,
  onDelete,
}: Props) {
  const { showToast } = useToast();
  const [editingAssignments, setEditingAssignments] = useState(false);
  const [draftAssignments, setDraftAssignments] = useState<
    FieldDictionaryAssignment[]
  >(field.assignments);

  useEffect(() => {
    setEditingAssignments(false);
    setDraftAssignments(field.assignments);
  }, [field.id, field.assignments]);

  const reliability = fieldReliabilityMode(field);
  const screenUsage = new Map<string, number>();
  field.assignments.forEach((assignment) => {
    assignment.screens.forEach((screenId) => {
      screenUsage.set(screenId, (screenUsage.get(screenId) ?? 0) + 1);
    });
  });

  function handleSaveAssignments(): void {
    const normalized = normalizeFieldAssignments(draftAssignments);
    if (normalized.length === 0) {
      showToast("اختر دوراً واحداً على الأقل مع شاشة.", "error");
      return;
    }
    onUpdate({ ...field, assignments: normalized });
    setEditingAssignments(false);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-text">{field.name}</h2>
        {reliability === "متعدد" ? (
          <Badge tone="warning">موثوقية متعددة</Badge>
        ) : null}
      </div>

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-text-3">الرقم المرجعي</dt>
          <dd>
            <button
              type="button"
              className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-2 hover:bg-primary/10 hover:text-primary"
              onClick={() => copyRef(field.ref)}
              title="اضغط لنسخ الرقم المرجعي"
            >
              {field.ref}
            </button>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-3">المفتاح التقني</dt>
          <dd className="font-mono text-[11px] text-text-2" dir="ltr">
            {field.key}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-3">وضع الموثوقية</dt>
          <dd>
            <Badge tone={reliability === "متعدد" ? "warning" : "success"}>
              {reliability}
            </Badge>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-3">المصدر</dt>
          <dd>
            <Badge
              tone={
                fieldDictionaryLayer(field) === "backend" ? "info" : "default"
              }
            >
              {FIELD_DICTIONARY_LAYER_LABELS[fieldDictionaryLayer(field)]}
            </Badge>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-3">النوع</dt>
          <dd>{FIELD_TYPE_LABELS[field.type]}</dd>
        </div>
        {field.source ? (
          <div className="flex justify-between gap-3">
            <dt className="text-text-3">مصدر القيم</dt>
            <dd className="text-end">{field.source}</dd>
          </div>
        ) : null}
        {field.parent ? (
          <div className="flex justify-between gap-3">
            <dt className="text-text-3">الحقل الأب</dt>
            <dd>{field.parent}</dd>
          </div>
        ) : null}
      </dl>

      <section className="mt-4 border-t border-border pt-3">
        <h3 className="mb-2 text-[11px] text-text-3">الوسوم</h3>
        <div className="flex flex-wrap gap-1.5">
          {field.tags.length ? (
            field.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-surface-2 px-2 py-0.5 text-[10px] text-text-2"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-xs text-text-3">—</span>
          )}
        </div>
      </section>

      <section className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] text-text-3">
            الإسناد — لكل دور شاشاته
          </h3>
          {!editingAssignments ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDraftAssignments(
                  field.assignments.map((assignment) => ({ ...assignment })),
                );
                setEditingAssignments(true);
              }}
            >
              تعديل الأدوار والصلاحيات
            </Button>
          ) : null}
        </div>

        {editingAssignments ? (
          <div className="space-y-3">
            <FieldDictionaryAssignmentsEditor
              assignments={draftAssignments}
              onChange={setDraftAssignments}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={handleSaveAssignments}>
                حفظ الإسناد
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraftAssignments(field.assignments);
                  setEditingAssignments(false);
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {field.assignments.length === 0 ? (
              <p className="text-xs text-text-3">لا توجد إسنادات — اضغط تعديل لإضافة أدوار.</p>
            ) : (
              field.assignments.map((assignment) => {
                const mode = assignmentMode(assignment);
                const rel =
                  reliability === "متعدد" && mode === "input"
                    ? assignmentReliability(field, assignment)
                    : null;
                return (
                  <div
                    key={`${assignment.role}-${mode}`}
                    className="overflow-hidden rounded-lg border border-border"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-teal-light px-3 py-2 text-xs font-semibold text-primary">
                      <span>{fieldDictionaryRoleLabel(assignment.role)}</span>
                      <div className="flex flex-wrap items-center gap-1">
                        {rel ? (
                          <Badge tone={rel === "معتمد" ? "success" : "warning"}>
                            {rel}
                          </Badge>
                        ) : null}
                        <Badge tone={mode === "view" ? "info" : "default"}>
                          {mode === "view" ? "عرض فقط" : "إدخال"}
                        </Badge>
                        {mode === "input" ? (
                          <Badge tone={assignment.required ? "danger" : "default"}>
                            {assignment.required ? "إلزامي" : "اختياري"}
                          </Badge>
                        ) : null}
                        {mode === "input" && assignment.final ? (
                          <Badge tone="success">معتمد نهائي</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-2.5">
                      {assignment.screens.map((screenId) => {
                        const screen = FIELD_DICTIONARY_SCREENS.find(
                          (item) => item.id === screenId,
                        );
                        const shared = (screenUsage.get(screenId) ?? 0) > 1;
                        return (
                          <span
                            key={screenId}
                            className={cn(
                              "rounded-md px-2 py-1 text-[11px]",
                              shared
                                ? "bg-warning-bg text-warning"
                                : "bg-primary/10 text-primary",
                              screen?.status === "مخططة" &&
                                "border border-dashed border-warning",
                            )}
                          >
                            {fieldDictionaryScreenName(screenId)}
                            {screen?.status === "مخططة" ? " • مخططة" : ""}
                            {shared ? " ↔" : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {field.child ? (
        <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
          ↳ قائمة «{field.child}» الفرعية تعتمد على هذا الحقل.
        </p>
      ) : null}
      {field.parent ? (
        <p className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
          ↳ قائمة مرتبطة بقيم حقل «{field.parent}».
        </p>
      ) : null}

      <section className="mt-4 border-t border-border pt-3">
        {field.persisted ? (
          <>
            <Button type="button" disabled className="opacity-60">
              لا يمكن حذف الحقل — مستخدم في النظام
            </Button>
            <p className="mt-1.5 text-[10px] text-text-3">
              يمكنك تعديل الإسناد والصلاحيات أعلاه. حذف الحقل نفسه يتطلب أرشفة
              لاحقاً عند ربط API.
            </p>
          </>
        ) : (
          <>
            <Button type="button" variant="dangerOutline" onClick={onDelete}>
              حذف الحقل نهائياً
            </Button>
            <p className="mt-1.5 text-[10px] text-text-3">
              غير مستخدم — يمكن حذفه وتحرير رقمه المرجعي.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
