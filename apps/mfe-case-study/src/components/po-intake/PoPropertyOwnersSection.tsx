"use client";

import { Button, Input, Label, cn } from "@platform/design-system";
import type { PoPropertyIntake } from "../../lib/prototype/po-intake-data";

type OwnerRow = { name: string; sharePct: string };

const OWNERSHIP_OPTIONS = [
  { value: "absolute", label: "ملكية مطلقة" },
  { value: "mortgaged", label: "مرهون" },
  { value: "investment", label: "استثمار" },
  { value: "shared", label: "مشاع" },
];

export function ownershipTypeLabel(value: string): string {
  return OWNERSHIP_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function parseRows(ownersJson: string): OwnerRow[] {
  if (!ownersJson.trim()) return [];
  try {
    const parsed = JSON.parse(ownersJson) as { name?: string; sharePct?: number | null }[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((o) => ({
      name: String(o?.name ?? ""),
      sharePct: o?.sharePct == null ? "" : String(o.sharePct),
    }));
  } catch {
    return [];
  }
}

function serializeRows(rows: OwnerRow[]): string {
  const cleaned = rows
    .filter((r) => r.name.trim() !== "")
    .map((r) => ({
      name: r.name.trim(),
      sharePct: r.sharePct.trim() === "" ? null : Number(r.sharePct.replace(",", ".")) || 0,
    }));
  return cleaned.length === 0 ? "" : JSON.stringify(cleaned);
}

/**
 * الملاك وحصصهم + نوع الملكية (مشتق قابل للتحرير).
 * Derivation: رهن ⟵ مرهون · حصص ⟵ مشاع · مالك واحد بلا قيود ⟵ مطلقة · استثمار يدويًا.
 */
export function PoPropertyOwnersSection({
  property,
  disabled,
  onPatch,
}: {
  property: PoPropertyIntake;
  disabled?: boolean;
  onPatch: <K extends keyof PoPropertyIntake>(
    key: K,
    value: PoPropertyIntake[K],
  ) => void;
}) {
  const rows = parseRows(property.ownersJson);

  function patchRows(next: OwnerRow[]) {
    onPatch("ownersJson", serializeRows(next));
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="m-0 text-[12px] font-bold text-heading">
        الملاك وحصصهم — تفريغ الصك
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        {rows.map((row, idx) => (
          <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
            <Input
              placeholder="اسم المالك"
              value={row.name}
              disabled={disabled}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, name: e.target.value };
                patchRows(next);
              }}
              className="text-xs"
            />
            <Input
              placeholder="الحصة ٪"
              inputMode="decimal"
              dir="ltr"
              value={row.sharePct}
              disabled={disabled}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, sharePct: e.target.value };
                patchRows(next);
              }}
              className="text-xs"
            />
            {!disabled ? (
              <Button
                type="button"
                size="sm"
                onClick={() => patchRows(rows.filter((_, i) => i !== idx))}
              >
                حذف
              </Button>
            ) : null}
          </div>
        ))}
        {!disabled ? (
          <div>
            <Button
              type="button"
              size="sm"
              onClick={() => patchRows([...rows, { name: "", sharePct: "" }])}
            >
              إضافة مالك
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <Label className="mb-1 block text-[11px] font-semibold text-text-2">
          نوع الملكية — مشتق قابل للتحرير (النظام يقترح والمقيّم يعتمد)
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[12px] text-text-2">
            <input
              type="checkbox"
              checked={property.ownershipTypeIsManual}
              disabled={disabled}
              onChange={(e) => {
                onPatch("ownershipTypeIsManual", e.target.checked);
                if (e.target.checked && !property.ownershipType) {
                  onPatch(
                    "ownershipType",
                    property.suggestedOwnershipType || "absolute",
                  );
                }
              }}
            />
            تجاوز يدوي (الاستثمار لا يُشتق — يدويًا بعقد مرفق)
          </label>
          {property.ownershipTypeIsManual ? (
            <select
              className="rounded-md border border-border-md bg-surface px-2 py-1 text-[12px]"
              value={property.ownershipType || "absolute"}
              disabled={disabled}
              onChange={(e) => onPatch("ownershipType", e.target.value)}
            >
              {OWNERSHIP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <span
              className={cn(
                "rounded-md border border-border px-2 py-1 text-[12px]",
                "bg-surface text-text-2",
              )}
            >
              المقترح: {ownershipTypeLabel(property.suggestedOwnershipType || "absolute")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
