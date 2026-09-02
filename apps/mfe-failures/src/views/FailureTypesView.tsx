"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  cn,
  EmptyState,
  InlineLoadingSkeleton,
  PageShell,
  Spinner,
  useToast,
  opsBtnGhost,
  opsBtnPrimary,
  opsFld,
  opsFldControl,
  opsFldFull,
  opsFormGrid,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsPpBadge,
  opsTfActions,
  opsTfLbl,
  opsTfNote,
} from "@platform/ui-kit";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
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

const FOLDER_ICON =
  "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z";
const PLUS_ICON = "M12 5v14M5 12h14";

function OpsIcon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

export function FailureTypesView() {
  const queryClient = useQueryClient();
  const { role } = useAppAccess();
  const canEdit = canManageFailureTypes(role);
  const { data: catalog, isFetched } = useFailureTypesQuery();
  const [categoryId, setCategoryId] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: appDataKeys.failureTypes(),
    });
  }, [queryClient]);

  const effectiveCategoryId = categoryId || catalog?.categories[0]?.id || "";

  async function handleAdd() {
    if (!canEdit || !effectiveCategoryId || !label.trim() || busy) return;
    setBusy(true);
    try {
      await addFailureProblemType({
        categoryId: effectiveCategoryId,
        label,
        description,
      });
      await refresh();
      setLabel("");
      setDescription("");
      showToast("تمت إضافة نوع التعذر", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "تعذّر إضافة نوع التعذر",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      await removeFailureProblemType(id);
      await refresh();
      showToast("تم الحذف", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "تعذّر حذف نوع التعذر",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      await resetFailureTypesCatalog();
      await refresh();
      showToast("تمت استعادة القائمة الافتراضية", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "تعذّر استعادة القائمة الافتراضية",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const sortedCategories = [...(catalog?.categories ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const problemTypes = catalog?.problemTypes ?? [];

  return (
    <PageShell
      variant="canvas"
      className={cn(
        "gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6",
        !isFetched && "opacity-55",
      )}
      dir="rtl"
    >
      {!isFetched ? <InlineLoadingSkeleton className="mb-3" /> : null}

      {!canEdit ? (
        <p className={cn(opsTfNote, "m-0 mb-3.5")}>
          وضع الاطلاع — صلاحية التعديل للمشرف ومسؤول النظام.
        </p>
      ) : null}

      <p className={cn(opsTfNote, "m-0 mb-3.5")}>
        القائمة مبدئية وقابلة للتوسع — تُضاف أنواع جديدة دون الحاجة لتعديل في الكود.
      </p>

      {canEdit ? (
        <section className={cn(opsLetterCard, "mb-3.5")}>
          <div className={opsLetterHead}>
            <div className="flex items-center gap-[11px]">
              <span className={opsIconBoxGold}>
                <OpsIcon path={PLUS_ICON} />
              </span>
              <div>
                <div className={opsLetterTitle}>إضافة نوع تعذر</div>
                <div className={opsLetterSub}>
                  يُضاف النوع الجديد تحت التصنيف المحدد ويظهر فوراً في شاشات رفع التعذر
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 pb-[18px] pt-4 sm:px-[18px]">
            <div className={opsFormGrid}>
              <div className={opsFld}>
                <label htmlFor="failure_type_category" className={opsTfLbl}>
                  التصنيف
                </label>
                <select
                  id="failure_type_category"
                  className={opsFldControl}
                  value={effectiveCategoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {sortedCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={opsFld}>
                <label htmlFor="failure_type_label" className={opsTfLbl}>
                  اسم نوع المشكلة
                </label>
                <input
                  id="failure_type_label"
                  className={opsFldControl}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div className={opsFldFull}>
                <label htmlFor="failure_type_description" className={opsTfLbl}>
                  وصف (اختياري)
                </label>
                <input
                  id="failure_type_description"
                  className={opsFldControl}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <div className={opsTfActions}>
              <button
                type="button"
                className={opsBtnPrimary}
                disabled={busy || !effectiveCategoryId || !label.trim()}
                aria-busy={busy || undefined}
                onClick={() => void handleAdd()}
              >
                {busy ? <Spinner /> : null}
                <span>✓ إضافة</span>
              </button>
              <button
                type="button"
                className={opsBtnGhost}
                disabled={busy}
                onClick={() => void handleReset()}
              >
                استعادة القائمة الافتراضية
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-3.5">
        {sortedCategories.map((category) => {
          const types = problemTypes
            .filter((t) => t.categoryId === category.id)
            .sort((a, b) => a.order - b.order);
          return (
            <section key={category.id} className={opsLetterCard}>
              <div className={opsLetterHead}>
                <div className="flex items-center gap-[11px]">
                  <span className={opsIconBoxGold}>
                    <OpsIcon path={FOLDER_ICON} />
                  </span>
                  <div>
                    <div className={opsLetterTitle}>{category.label}</div>
                    <div className={opsLetterSub}>
                      {types.length === 0
                        ? "لا أنواع تحت هذا التصنيف"
                        : `${types.length} ${types.length === 1 ? "نوع" : "أنواع"}`}
                    </div>
                  </div>
                </div>
                <span className={opsPpBadge}>{types.length}</span>
              </div>
              <div className="px-4 pb-2 sm:px-[18px]">
                {types.length === 0 ? (
                  <EmptyState line="لا أنواع." />
                ) : (
                  types.map((type) => (
                    <div
                      key={type.id}
                      className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-bold text-heading">
                            {type.label}
                          </span>
                          {type.id.startsWith("custom-") ? (
                            <span className="inline-flex items-center rounded-full bg-gold-soft px-2 py-0.5 text-[10.5px] font-bold text-gold-d">
                              مخصص
                            </span>
                          ) : null}
                        </div>
                        {type.description ? (
                          <div className="mt-0.5 text-[11.5px] leading-relaxed text-text-3">
                            {type.description}
                          </div>
                        ) : null}
                      </div>
                      {canEdit && type.id.startsWith("custom-") ? (
                        <button
                          type="button"
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-[#d9694f] transition-colors enabled:hover:border-[#d9694f]/40 enabled:hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void handleRemove(type.id)}
                        >
                          حذف
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
