"use client";

import { useEffect, useMemo, useState } from "react";
import { AppModal } from "@case-study/mfe/components/ui/AppModal";
import { RegField, RegSelect } from "@platform/app-shared/registration/FormFields";
import {
  Button,
  Note,
  cn,
  useToast,
} from "@platform/design-system";
import type { PriorDeedRegistrationDto } from "@platform/api-client";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import {
  copyPropertyFromPriorTransaction,
  findPriorDeedFull,
  type CopyPriorScope,
  type CopyPriorTargetOption,
} from "../../lib/prototype/po-intake-storage";

type Props = {
  open: boolean;
  poNumber: string;
  targets: CopyPriorTargetOption[];
  /** Pre-select a target key (e.g. from row ⋮). */
  initialTargetKey?: string | null;
  /** When true, target is fixed (row already chosen) — only pick the source. */
  lockTarget?: boolean;
  onClose: () => void;
  onCopied: () => void;
};

const scopePill = (selected: boolean) =>
  cn(
    "inline-flex cursor-pointer items-center justify-center rounded-[var(--radius-DEFAULT)] border-2 px-3 py-2 text-center font-[inherit] text-xs font-semibold transition-all",
    selected
      ? "border-primary bg-primary text-white"
      : "border-border bg-surface text-text-2 hover:border-primary-light hover:text-primary",
  );

export function CopyFromPriorTransactionModal({
  open,
  poNumber,
  targets,
  initialTargetKey = null,
  lockTarget = false,
  onClose,
  onCopied,
}: Props) {
  const { showToast } = useToast();
  const [targetKey, setTargetKey] = useState("");
  const [deedQuery, setDeedQuery] = useState("");
  const [scope, setScope] = useState<CopyPriorScope>("enfath");
  const [searching, setSearching] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hit, setHit] = useState<PriorDeedRegistrationDto | null>(null);
  const [searched, setSearched] = useState(false);

  const selectedTarget = useMemo(
    () => targets.find((t) => t.key === targetKey) ?? null,
    [targets, targetKey],
  );

  const targetOptions = useMemo(
    () => targets.map((t) => ({ value: t.key, label: t.label })),
    [targets],
  );

  useEffect(() => {
    if (!open) return;
    const preferred =
      (initialTargetKey &&
        targets.some((t) => t.key === initialTargetKey) &&
        initialTargetKey) ||
      (targets.length === 1 ? targets[0].key : "");
    setTargetKey(preferred || "");
    setDeedQuery("");
    setScope("enfath");
    setSearching(false);
    setCopying(false);
    setError(null);
    setHit(null);
    setSearched(false);
  }, [open, initialTargetKey, targets]);

  function handleClose() {
    if (copying) return;
    onClose();
  }

  async function handleSearch() {
    const deed = deedQuery.trim();
    if (!deed) {
      setError("أدخل رقم الصك للبحث");
      setHit(null);
      setSearched(false);
      return;
    }
    setSearching(true);
    setError(null);
    setHit(null);
    setSearched(false);
    try {
      // Allow same-PO matches; only skip the target property itself.
      const excludePropertyId =
        selectedTarget?.target.kind === "property"
          ? selectedTarget.target.propertyId
          : undefined;
      const result = await findPriorDeedFull(
        deed,
        undefined,
        excludePropertyId,
      );
      setSearched(true);
      if (!result) {
        setError("لا يوجد عقار بهذا رقم الصك (في هذا أمر العمل أو أوامر أخرى)");
        return;
      }
      setHit(result);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "تعذّر البحث عن المعاملة السابقة",
      );
    } finally {
      setSearching(false);
    }
  }

  async function handleCopy() {
    if (!hit || !selectedTarget) return;

    const sourceDeed = (
      deedQuery.trim() ||
      hit.deedNumber ||
      ""
    ).trim();
    const sourceOnSamePo =
      hit.poNumber.trim() === poNumber.trim();

    if (
      sourceOnSamePo &&
      selectedTarget.target.kind === "empty-slot" &&
      sourceDeed
    ) {
      setError(
        "هذا الصك مسجّل مسبقًا في نفس أمر العمل — لا يمكن إضافته كخانة جديدة بنفس الرقم. اختر صكًا من أمر عمل آخر، أو افتح العقار الموجود.",
      );
      return;
    }

    if (
      sourceOnSamePo &&
      selectedTarget.target.kind === "property" &&
      sourceDeed &&
      selectedTarget.label !== sourceDeed
    ) {
      // Overwriting another property on same PO with a sibling's deed hits unique-deed rule.
      setError(
        "لا يمكن نسخ رقم صك موجود على عقار آخر في نفس أمر العمل. انسخ من أمر عمل مختلف، أو عدّل العقار يدويًا.",
      );
      return;
    }

    if (selectedTarget.hasExistingData) {
      const ok = window.confirm(
        `استبدال بيانات «${selectedTarget.label}» بالبيانات المنسوخة؟`,
      );
      if (!ok) return;
    }

    setCopying(true);
    setError(null);
    try {
      const result = await copyPropertyFromPriorTransaction(
        poNumber,
        hit,
        sourceDeed,
        scope,
        selectedTarget.target,
      );
      if (!result.ok) {
        setError(result.error);
        showToast(result.error, "error");
        return;
      }
      showToast(
        scope === "bourse"
          ? "تم نسخ البيانات الأولية واستعلام البورصة على الصك المختار"
          : "تم نسخ البيانات الأولية على الصك المختار",
        "success",
      );
      onCopied();
      onClose();
    } finally {
      setCopying(false);
    }
  }

  return (
    <AppModal
      open={open}
      title="نسخ من معاملة سابقة"
      onClose={handleClose}
      footer={
        <>
          <Button
            type="button"
            variant="default"
            onClick={handleClose}
            disabled={copying}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!hit || !selectedTarget || copying || searching}
            onClick={() => void handleCopy()}
          >
            {copying ? "جارٍ النسخ…" : "نسخ"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Note tone="info">
          {lockTarget
            ? "ابحث برقم الصك عن عقار للنسخ منه — يمكن أن يكون من نفس أمر العمل أو من أمر عمل آخر."
            : (
              <>
                اختر الصك أو الخانة على أمر العمل{" "}
                <PoNumber value={poNumber} className="inline text-[12px]" />، ثم
                ابحث عن الصك المصدر (نفس أمر العمل أو أمر آخر).
              </>
            )}
        </Note>

        {targets.length === 0 ? (
          <Note tone="warn">
            لا توجد عقارات أو خانات فارغة للنسخ عليها في هذا أمر العمل.
          </Note>
        ) : lockTarget && selectedTarget ? (
          <div className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3 py-2.5 text-[12px]">
            <div className="mb-0.5 text-[11px] text-text-3">النسخ على</div>
            <div className="font-semibold text-text" dir="ltr">
              {selectedTarget.label}
            </div>
            <div className="mt-0.5 text-[11px] text-text-2">
              أمر العمل{" "}
              <PoNumber value={poNumber} className="inline text-[11px]" />
            </div>
          </div>
        ) : (
          <RegSelect
            id="copy-prior-target"
            label="الصك / الخانة المستهدفة"
            required
            options={targetOptions}
            value={targetKey}
            placeholder="اختر الهدف…"
            onChange={setTargetKey}
          />
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <RegField
              id="copy-prior-deed"
              label="رقم صك المعاملة السابقة"
              value={deedQuery}
              dir="ltr"
              onChange={(value) => {
                setDeedQuery(value);
                setHit(null);
                setSearched(false);
                setError(null);
              }}
            />
          </div>
          <Button
            type="button"
            variant="default"
            disabled={searching || !deedQuery.trim()}
            onClick={() => void handleSearch()}
          >
            {searching ? "جارٍ البحث…" : "بحث"}
          </Button>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-medium text-text-2">
            نطاق النسخ
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={scopePill(scope === "enfath")}
              onClick={() => setScope("enfath")}
            >
              بيانات أولية فقط
            </button>
            <button
              type="button"
              className={scopePill(scope === "bourse")}
              onClick={() => setScope("bourse")}
            >
              استعلام بورصة (مع الأولية)
            </button>
          </div>
          <p className="mt-1.5 m-0 text-[11px] text-text-3">
            {scope === "enfath"
              ? "يُنسخ فقط حقول البيانات الأولية على الهدف المختار."
              : "يُنسخ البيانات الأولية وحقول البورصة معًا على الهدف المختار."}
          </p>
        </div>

        {error ? <Note tone="warn">{error}</Note> : null}

        {hit ? (
          <div className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3 py-2.5 text-[12px]">
            <div className="mb-1 font-semibold text-text">نتيجة البحث</div>
            <div className="flex flex-col gap-1 text-text-2">
              <div>
                أمر العمل السابق:{" "}
                <PoNumber
                  value={hit.poNumber}
                  className="inline text-[12px] !font-medium"
                />
              </div>
              <div>
                المالك:{" "}
                <span className="font-medium text-text">
                  {hit.ownerName?.trim() || "—"}
                </span>
              </div>
              <div>
                الموقع:{" "}
                <span className="font-medium text-text">
                  {[hit.city, hit.district].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
              <div>
                التصنيف:{" "}
                <span className="font-medium text-text">
                  {[hit.classification, hit.propertyType]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </span>
              </div>
              <div>
                البورصة:{" "}
                <span className="font-medium text-text">
                  {hit.bourseDataCompleted ? "مكتملة" : "غير مكتملة"}
                </span>
              </div>
            </div>
          </div>
        ) : searched && !error ? (
          <Note tone="warn">لا توجد نتيجة</Note>
        ) : null}
      </div>
    </AppModal>
  );
}
