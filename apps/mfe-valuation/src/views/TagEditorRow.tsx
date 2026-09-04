"use client";

/**
 * Quality-tag editor row of `ComparablePropertiesView` — reliability tag,
 * duplicate flag and the rationale. Records are tagged, never deleted.
 */

import { useState } from "react";
import {
  setComparableQualityTags,
  type ComparablePropertyDto,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import { Spinner, useToast } from "@platform/ui-kit";
import {
  opsBtnPrimary,
  opsFld,
  opsFldControl,
  opsFldFull,
  opsTfLbl,
} from "../lib/comparables-ops-tw";

export function TagEditorRow({
  row,
  onSaved,
}: {
  row: ComparablePropertyDto;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [tagDraft, setTagDraft] = useState(() => ({
    reliabilityTag: row.reliabilityTag || "normal",
    isDuplicateTagged: row.isDuplicateTagged,
    tagRationale: row.tagRationale ?? "",
  }));

  async function saveTags() {
    const config = apiConfig();
    if (!config) return;
    setSaving(true);
    const res = await setComparableQualityTags(config, row.id, {
      reliabilityTag: tagDraft.reliabilityTag,
      isDuplicateTagged: tagDraft.isDuplicateTagged,
      tagRationale: tagDraft.tagRationale.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ الوسم", "error");
      return;
    }
    showToast("حُفظ الوسم — السجل يبقى موسوماً لا يُحذف", "success");
    onSaved();
  }

  return (
    <div className="mt-3 grid gap-3 rounded-[10px] border border-border bg-surface-2 p-3 min-[561px]:grid-cols-2">
      <div className={opsFld}>
        <label className={opsTfLbl}>وسم الموثوقية</label>
        <select
          className={opsFldControl}
          value={tagDraft.reliabilityTag}
          disabled={saving}
          onChange={(e) =>
            setTagDraft((d) => ({
              ...d,
              reliabilityTag: e.target.value,
            }))
          }
        >
          <option value="normal">عادي</option>
          <option value="anomalous">شاذ</option>
          <option value="unreliable">غير موثوق</option>
        </select>
      </div>
      <label className="flex items-center gap-1.5 self-end pb-2 text-[12.5px] text-text-2">
        <input
          type="checkbox"
          className="size-4 accent-[var(--gold-d)]"
          checked={tagDraft.isDuplicateTagged}
          disabled={saving}
          onChange={(e) =>
            setTagDraft((d) => ({
              ...d,
              isDuplicateTagged: e.target.checked,
            }))
          }
        />
        مكرر (نفس العملية سُجّلت مرتين)
      </label>
      <div className={opsFldFull}>
        <label className={opsTfLbl}>مبرر الوسم (إلزامي عند أي وسم)</label>
        <input
          className={opsFldControl}
          value={tagDraft.tagRationale}
          disabled={saving}
          onChange={(e) =>
            setTagDraft((d) => ({
              ...d,
              tagRationale: e.target.value,
            }))
          }
        />
      </div>
      <div className="col-span-full">
        <button
          type="button"
          className={opsBtnPrimary}
          disabled={saving}
          aria-busy={saving || undefined}
          onClick={() => void saveTags()}
        >
          {saving ? <Spinner /> : null}
          <span>حفظ الوسم</span>
        </button>
      </div>
    </div>
  );
}
