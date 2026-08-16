"use client";

import { useState } from "react";
import { Button, Input, Label, useToast } from "@platform/design-system";
import { createComparableProperty } from "@platform/api-client";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";

/**
 * 11هـ2 feed #1 — الميداني يلتقط العروض والصفقات أثناء المعاينة.
 * Captured rows enter the shared company bank with intakeChannel = "field".
 */
export function FieldComparableCaptureSection({
  latitude,
  longitude,
  city,
  district,
  disabled,
}: {
  latitude?: string;
  longitude?: string;
  city?: string;
  district?: string;
  disabled?: boolean;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [propertyType, setPropertyType] = useState("");
  const [kind, setKind] = useState("offer");
  const [priceDescription, setPriceDescription] = useState("asking");
  const [price, setPrice] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [districtInput, setDistrictInput] = useState(district ?? "");
  const [lat, setLat] = useState(latitude ?? "");
  const [lon, setLon] = useState(longitude ?? "");
  const [description, setDescription] = useState("");

  async function save() {
    const config = workOrdersApiConfig();
    if (!config) return;
    setSaving(true);
    const res = await createComparableProperty(config, {
      comparablePropertyType: propertyType.trim(),
      transactionKind: kind,
      priceDescription: kind === "offer" ? priceDescription : null,
      source: "field",
      latitude: Number(lat.replace(",", ".")) || 0,
      longitude: Number(lon.replace(",", ".")) || 0,
      areaSqm: Number(areaSqm.replace(",", ".")) || 0,
      transactionDate,
      price: Number(price.replace(",", ".")) || 0,
      city: city?.trim() || null,
      district: districtInput.trim(),
      description: description.trim() || null,
      intakeChannel: "field",
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ المقارن الميداني", "error");
      return;
    }
    const anomaly = res.data.pricePerSqmAnomalyNoteAr;
    showToast(
      anomaly
        ? `حُفظ المقارن في بنك العقارات — ${anomaly}`
        : "حُفظ المقارن في بنك العقارات (رافد ميداني)",
      anomaly ? "error" : "success",
    );
    setPropertyType("");
    setPrice("");
    setAreaSqm("");
    setDescription("");
    setOpen(false);
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[12px] font-bold text-heading">
            رصد مقارن ميداني (بنك العقارات)
          </p>
          <p className="mt-0.5 text-[11px] text-text-2">
            عرض أو صفقة رُصدت أثناء المعاينة — تدخل البنك المشترك ببطاقة مصدر «ميداني».
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "إغلاق" : "إضافة رصد"}
        </Button>
      </div>

      {open ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-[10.5px] text-text-2">نوع العقار المقارن</Label>
            <Input
              value={propertyType}
              disabled={saving}
              onChange={(e) => setPropertyType(e.target.value)}
              placeholder="أرض سكنية / فيلا…"
              className="text-xs"
            />
          </div>
          <div>
            <Label className="text-[10.5px] text-text-2">نوع العملية</Label>
            <select
              className="w-full rounded-md border border-border-md bg-surface px-2 py-[7px] text-[12px]"
              value={kind}
              disabled={saving}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="offer">عرض</option>
              <option value="executed">صفقة منفذة</option>
            </select>
          </div>
          {kind === "offer" ? (
            <div>
              <Label className="text-[10.5px] text-text-2">وصف السعر</Label>
              <select
                className="w-full rounded-md border border-border-md bg-surface px-2 py-[7px] text-[12px]"
                value={priceDescription}
                disabled={saving}
                onChange={(e) => setPriceDescription(e.target.value)}
              >
                <option value="asking">حد</option>
                <option value="negotiable">قابل للتفاوض</option>
              </select>
            </div>
          ) : null}
          <div>
            <Label className="text-[10.5px] text-text-2">تاريخ العملية (جوهري)</Label>
            <Input
              type="date"
              dir="ltr"
              value={transactionDate}
              disabled={saving}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <Label className="text-[10.5px] text-text-2">السعر (ر.س)</Label>
            <Input
              inputMode="decimal"
              dir="ltr"
              value={price}
              disabled={saving}
              onChange={(e) => setPrice(e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <Label className="text-[10.5px] text-text-2">المساحة (م²)</Label>
            <Input
              inputMode="decimal"
              dir="ltr"
              value={areaSqm}
              disabled={saving}
              onChange={(e) => setAreaSqm(e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <Label className="text-[10.5px] text-text-2">الحي</Label>
            <Input
              value={districtInput}
              disabled={saving}
              onChange={(e) => setDistrictInput(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10.5px] text-text-2">خط العرض</Label>
              <Input
                dir="ltr"
                value={lat}
                disabled={saving}
                onChange={(e) => setLat(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-[10.5px] text-text-2">خط الطول</Label>
              <Input
                dir="ltr"
                value={lon}
                disabled={saving}
                onChange={(e) => setLon(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-[10.5px] text-text-2">وصف المقارن</Label>
            <Input
              value={description}
              disabled={saving}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="sm:col-span-2">
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
