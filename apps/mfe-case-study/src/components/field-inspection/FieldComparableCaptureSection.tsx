"use client";

import { useState } from "react";
import { Button, useToast } from "@platform/ui-kit";
import { createComparableProperty } from "@platform/api-client";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";
import {
  comparableDraftToUpsert,
  emptyComparableEntryDraft,
} from "../../lib/comparable-entry";
import { ComparablePropertyEntryFields } from "../comparables/ComparablePropertyEntryFields";

/**
 * Optional field capture during inspection. Rows enter the company bank
 * and are linked to this property when a property id is provided.
 */
export function FieldComparableCaptureSection({
  latitude,
  longitude,
  city,
  district,
  propertyType,
  poNumber,
  propertyId,
  disabled,
}: {
  latitude?: string;
  longitude?: string;
  city?: string;
  district?: string;
  propertyType?: string;
  poNumber?: string;
  propertyId?: string;
  disabled?: boolean;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(() =>
    emptyComparableEntryDraft({
      type: propertyType,
      city,
      district,
      latitude,
      longitude,
    }),
  );

  async function save() {
    const config = workOrdersApiConfig();
    if (!config) return;
    setSaving(true);
    const res = await createComparableProperty(
      config,
      comparableDraftToUpsert(draft, {
        intakeChannel: "field",
        sourceWorkOrderNumber: poNumber ?? null,
        sourcePropertyId: propertyId || null,
      }),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ المقارن الميداني", "error");
      return;
    }
    const anomaly = res.data.pricePerSqmAnomalyNoteAr;
    showToast(
      anomaly
        ? `حُفظ المقارن ورُبط بالعقار — ${anomaly}`
        : "حُفظ المقارن في البنك ورُبط بهذا العقار",
      anomaly ? "error" : "success",
    );
    setDraft(
      emptyComparableEntryDraft({
        type: propertyType,
        city,
        district,
        latitude,
        longitude,
      }),
    );
    setOpen(false);
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[12px] font-bold text-heading">العقارات المقارنة (اختياري)</p>
          <p className="mt-0.5 text-[11px] text-text-2">
            إدخال أولي إن توفرت أثناء المعاينة — تُحفظ في بنك العقارات ويمكن للأخصائي
            مراجعتها أو استبدالها.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "إغلاق" : "إضافة مقارن"}
        </Button>
      </div>

      {open ? (
        <div className="mt-2">
          <ComparablePropertyEntryFields
            draft={draft}
            disabled={saving}
            onChange={setDraft}
          />
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={saving}
              disabled={saving}
              onClick={() => void save()}
            >
              حفظ في بنك العقارات
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
