"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { RegField, RegSelect } from "@platform/app-shared/registration/FormFields";
import { Button, cn } from "@platform/design-system";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import type { RoleId } from "@platform/types";
import {
  addFailureProblemType,
  removeFailureProblemType,
  resetFailureTypesCatalog,
} from "../lib/failure-types-storage";
import { useFailureTypesQuery } from "../query/failure-types-queries";

function canManageFailureTypes(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

const noteBase =
  "mb-3 rounded-[var(--radius-DEFAULT)] border border-e-[3px] px-3.5 py-2.5 text-xs leading-relaxed";

export function FailureTypesView() {
  const queryClient = useQueryClient();
  const { role } = usePrototype();
  const canEdit = canManageFailureTypes(role);
  const { data: catalog, isFetched } = useFailureTypesQuery();
  const [categoryId, setCategoryId] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: prototypeKeys.failureTypes(),
    });
  }, [queryClient]);

  useEffect(() => {
    if (!catalog?.categories.length) return;
    if (!categoryId) setCategoryId(catalog.categories[0].id);
  }, [catalog, categoryId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function handleAdd() {
    if (!canEdit || !categoryId || !label.trim()) return;
    await addFailureProblemType({
      categoryId,
      label,
      description,
    });
    await refresh();
    setLabel("");
    setDescription("");
    setToast("تمت إضافة نوع التعذر");
  }

  async function handleRemove(id: string) {
    if (!canEdit) return;
    await removeFailureProblemType(id);
    await refresh();
    setToast("تم الحذف");
  }

  async function handleReset() {
    if (!canEdit) return;
    await resetFailureTypesCatalog();
    await refresh();
    setToast("تمت استعادة القائمة الافتراضية");
  }

  const sortedCategories = [...(catalog?.categories ?? [])].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <div className={cn(!isFetched && "opacity-55")}>
      {toast ? (
        <div className={cn(noteBase, "border-success bg-success-bg text-success-text")}>
          {toast}
        </div>
      ) : null}

      {!canEdit ? (
        <div className={cn(noteBase, "border-info bg-info-bg text-info-text")}>
          وضع الاطلاع — صلاحية التعديل للمشرف ومسؤول النظام.
        </div>
      ) : null}

      <div className={cn(noteBase, "border-amber bg-amber-light text-amber-text")}>
        القائمة مبدئية وقابلة للتوسع — تُضاف أنواع جديدة دون الحاجة لتعديل في الكود
        (§4 وثيقة التعذرات).
      </div>

      {canEdit ? (
        <article className="mb-0 w-full overflow-hidden rounded-none border-none bg-surface shadow-none">
          <header className="mb-0 flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <h2 className="m-0 mb-1 text-base font-bold text-text">إضافة نوع تعذر</h2>
            </div>
          </header>
          <div className="grid gap-3 px-6 pb-3">
            <RegSelect
              id="failure_type_category"
              label="التصنيف"
              value={categoryId}
              onChange={setCategoryId}
              options={sortedCategories.map((c) => ({
                value: c.id,
                label: c.label,
              }))}
            />
            <RegField
              id="failure_type_label"
              label="اسم نوع المشكلة"
              value={label}
              onChange={setLabel}
            />
            <RegField
              id="failure_type_description"
              label="وصف (اختياري)"
              value={description}
              onChange={setDescription}
            />
          </div>
          <div className="flex gap-2 px-6 pb-4">
            <Button type="button" variant="primary" size="sm" onClick={() => void handleAdd()}>
              إضافة
            </Button>
            <Button type="button" size="sm" onClick={() => void handleReset()}>
              استعادة القائمة الافتراضية
            </Button>
          </div>
        </article>
      ) : null}

      {sortedCategories.map((category) => {
        const types = (catalog?.problemTypes ?? [])
          .filter((t) => t.categoryId === category.id)
          .sort((a, b) => a.order - b.order);
        return (
          <article
            key={category.id}
            className="mb-0 w-full overflow-hidden rounded-none border-none bg-surface shadow-none"
          >
            <header className="mb-0 flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <h2 className="m-0 mb-1 text-base font-bold text-text">{category.label}</h2>
              </div>
            </header>
            <div className="px-6 py-3">
              {types.length === 0 ? (
                <p className="text-[13px] text-text-3">لا أنواع.</p>
              ) : (
                types.map((type) => (
                  <div
                    key={type.id}
                    className="flex items-start justify-between gap-3 border-b border-dashed border-border py-2"
                  >
                    <div>
                      <div className="text-[13px] font-medium">{type.label}</div>
                      {type.description ? (
                        <div className="mt-0.5 text-xs text-text-3">
                          {type.description}
                        </div>
                      ) : null}
                    </div>
                    {canEdit && type.id.startsWith("custom-") ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => void handleRemove(type.id)}
                      >
                        حذف
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
