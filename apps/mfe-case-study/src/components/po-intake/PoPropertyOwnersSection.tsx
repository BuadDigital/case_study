"use client";

import { Button, Input, cn } from "@platform/ui-kit";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";

type OwnerRow = { name: string };

export function ownershipTypeLabel(value: string): string {
  return value === "shared" ? "مشاع" : "ملكية مطلقة";
}

function parseRows(ownersJson: string): OwnerRow[] {
  if (!ownersJson.trim()) return [];
  try {
    const parsed = JSON.parse(ownersJson) as { name?: string }[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((o) => ({ name: String(o?.name ?? "") }));
  } catch {
    return [];
  }
}

/** Keep empty draft rows in UI state — API submit filters via parseOwnersDraft. */
function serializeRows(rows: OwnerRow[]): string {
  if (rows.length === 0) return "";
  return JSON.stringify(rows.map((r) => ({ name: r.name })));
}

/**
 * The deed owners. The ownership type follows their count: one owner → ملكية مطلقة, several → مشاع.
 * The server derives and stores nothing about it; the badge here only previews the same rule while typing.
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
  const namedOwners = rows.filter((r) => r.name.trim() !== "").length;
  const ownershipType = namedOwners > 1 ? "shared" : "absolute";

  function patchRows(next: OwnerRow[]) {
    onPatch("ownersJson", serializeRows(next));
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="m-0 text-[12px] font-bold text-heading">
        الملاك — تفريغ الصك
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        {rows.map((row, idx) => (
          <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              placeholder="اسم المالك"
              value={row.name}
              disabled={disabled}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { name: e.target.value };
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
              onClick={() => patchRows([...rows, { name: "" }])}
            >
              إضافة مالك
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-text-2">
        <span className="font-semibold">نوع الملكية:</span>
        <span
          className={cn(
            "rounded-md border border-border px-2 py-1",
            "bg-surface text-text-2",
          )}
        >
          {ownershipTypeLabel(ownershipType)}
        </span>
        <span className="text-[11px] text-text-3">
          مالك واحد: ملكية مطلقة · أكثر من مالك: مشاع
        </span>
      </div>
    </div>
  );
}
