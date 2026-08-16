"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  FormGroup,
  Input,
  Label,
  Note,
  Select,
  cn,
  useToast,
} from "@platform/design-system";
import {
  getBuildingInventory,
  saveBuildingInventory,
  type BuildingInventoryLineDto,
  type BuildingStructureKind,
} from "@platform/api-client";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";

const KIND_OPTIONS: { value: BuildingStructureKind; label: string }[] = [
  { value: "floor", label: "دور / طابق" },
  { value: "fence", label: "سور / تسوير" },
  { value: "annex", label: "ملحق" },
  { value: "basement", label: "قبو" },
  { value: "other", label: "إنشاء آخر" },
];

function emptyLine(sortOrder: number): BuildingInventoryLineDto {
  return {
    sortOrder,
    structureKind: "floor",
    label: "",
    areaSqm: "",
    notes: "",
  };
}

/**
 * Building/structure inventory — valuation spec + governing structures question.
 * Persisted on the property (not only inside inspection PayloadJson).
 */
export function BuildingInventorySection({
  poNumber,
  propertyId,
  disabled,
  mobile,
}: {
  poNumber: string;
  propertyId: string;
  disabled?: boolean;
  mobile?: boolean;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasStructures, setHasStructures] = useState<"" | "yes" | "no">("");
  const [lines, setLines] = useState<BuildingInventoryLineDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const config = workOrdersApiConfig();
    if (!config || !propertyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await getBuildingInventory(config, poNumber, propertyId);
    setLoading(false);
    if (!res.ok) {
      setError("تعذّر تحميل حصر الإنشاءات");
      return;
    }
    setError(null);
    const v = (res.data.hasStructuresToValue || "") as "" | "yes" | "no";
    setHasStructures(v);
    setLines(
      res.data.lines.length > 0
        ? res.data.lines
        : v === "yes"
          ? [emptyLine(0)]
          : [],
    );
  }, [poNumber, propertyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function persist(
    nextHas: "" | "yes" | "no",
    nextLines: BuildingInventoryLineDto[],
  ) {
    const config = workOrdersApiConfig();
    if (!config || disabled) return;
    setSaving(true);
    setError(null);
    const res = await saveBuildingInventory(config, poNumber, propertyId, {
      hasStructuresToValue: nextHas,
      lines: nextHas === "yes" ? nextLines : [],
    });
    setSaving(false);
    if (!res.ok) {
      const msg =
        res.errors?.lines ||
        res.errors?.hasStructuresToValue ||
        Object.values(res.errors ?? {})[0] ||
        "تعذّر حفظ حصر الإنشاءات";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    setHasStructures((res.data.hasStructuresToValue || "") as "" | "yes" | "no");
    setLines(res.data.lines);
    showToast("تم حفظ حصر الإنشاءات", "success");
  }

  function setAnswer(next: "" | "yes" | "no") {
    setHasStructures(next);
    if (next === "yes" && lines.length === 0) {
      const seeded = [emptyLine(0)];
      setLines(seeded);
      void persist("yes", seeded);
      return;
    }
    if (next === "no") {
      setLines([]);
      void persist("no", []);
      return;
    }
    void persist(next, lines);
  }

  function patchLine(index: number, patch: Partial<BuildingInventoryLineDto>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(prev.length)]);
  }

  function removeLine(index: number) {
    setLines((prev) =>
      prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, sortOrder: i })),
    );
  }

  if (!propertyId) return null;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface-2/40 p-3">
      <div>
        <p className="m-0 text-[12px] font-bold text-heading">
          حصر المباني والإنشاءات
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-text-2">
          سؤال حاكم للتقرير: أرض مسورة أو مبانٍ ⟵ نعم ⟵ تُقيَّم بالتكلفة. أسطر المساحة الصفرية لا تُطبع لاحقًا.
        </p>
      </div>

      {loading ? (
        <p className="text-[12px] text-text-2">جاري التحميل…</p>
      ) : (
        <>
          <FormGroup>
            <Label className="mb-2 text-[11px] font-semibold text-text-2">
              هل توجد مبانٍ / إنشاءات يجب تقييمها؟
            </Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "yes" as const, label: "نعم" },
                  { value: "no" as const, label: "لا" },
                ] as const
              ).map((opt) => {
                const on = hasStructures === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "inline-flex min-h-8 cursor-pointer items-center rounded-lg border px-3 text-[12px] font-medium",
                      on
                        ? "border-ink bg-ink text-white"
                        : "border-border-md bg-surface text-text-2",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input
                      type="radio"
                      name={`has-structures-${propertyId}`}
                      className="sr-only"
                      checked={on}
                      disabled={disabled || saving}
                      onChange={() => setAnswer(opt.value)}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </FormGroup>

          {hasStructures === "yes" ? (
            <div className="space-y-2.5">
              {lines.map((line, index) => (
                <div
                  key={line.id ?? `new-${index}`}
                  className={cn(
                    "grid gap-2 rounded-md border border-border bg-surface p-2.5",
                    mobile ? "grid-cols-1" : "sm:grid-cols-2",
                  )}
                >
                  <FormGroup>
                    <Label className="text-[10px] text-text-2">النوع</Label>
                    <Select
                      disabled={disabled || saving}
                      value={line.structureKind}
                      onChange={(e) =>
                        patchLine(index, {
                          structureKind: e.target.value as BuildingStructureKind,
                        })
                      }
                      className="text-xs"
                    >
                      {KIND_OPTIONS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </Select>
                  </FormGroup>
                  <FormGroup>
                    <Label className="text-[10px] text-text-2">التسمية</Label>
                    <Input
                      disabled={disabled || saving}
                      value={line.label}
                      onChange={(e) =>
                        patchLine(index, { label: e.target.value })
                      }
                      placeholder="مثال: الدور الأرضي / سور"
                      className="text-xs"
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label className="text-[10px] text-text-2">المساحة م²</Label>
                    <Input
                      type="number"
                      disabled={disabled || saving}
                      value={line.areaSqm ?? ""}
                      onChange={(e) =>
                        patchLine(index, { areaSqm: e.target.value })
                      }
                      className="text-xs"
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label className="text-[10px] text-text-2">ملاحظات</Label>
                    <Input
                      disabled={disabled || saving}
                      value={line.notes ?? ""}
                      onChange={(e) =>
                        patchLine(index, { notes: e.target.value })
                      }
                      className="text-xs"
                    />
                  </FormGroup>
                  {!disabled ? (
                    <div className="sm:col-span-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => removeLine(index)}
                      >
                        حذف البند
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              {!disabled ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={addLine}>
                    إضافة بند
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={saving}
                    disabled={saving}
                    onClick={() => void persist("yes", lines)}
                  >
                    حفظ الحصر
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <Note tone="warn">{error}</Note> : null}
        </>
      )}
    </div>
  );
}
