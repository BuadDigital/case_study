"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  FormGroup,
  Input,
  Label,
  Note,
  cn,
  useToast,
} from "@platform/ui-kit";
import {
  getInspectionLimits,
  saveInspectionLimits,
  type UninspectedUnitEntryDto,
} from "@platform/api-client";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";

const SCOPE_OPTIONS = [
  { value: "full", label: "كاملة (داخل وخارج)" },
  { value: "external", label: "خارجية فقط" },
  { value: "desktop", label: "مكتبية عن بُعد" },
] as const;

/**
 * حدود المعاينة = القيود على المعاينة (القرار 24 + ق-7): مدخلات منظّمة لا نص حر —
 * النظام يركّب نص التحفّظ ويضعه ضمن الافتراضات الخاصة. نطاق المعاينة إلزامي،
 * والمكتبية عن بُعد حاجب إصدار حتى يعتمدها المقيّم المعتمد.
 */
export function InspectionLimitsSection({
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
  const [scope, setScope] = useState<string>("");
  const [reason, setReason] = useState("");
  const [units, setUnits] = useState<UninspectedUnitEntryDto[]>([]);
  const [reservation, setReservation] = useState("");
  const [remoteApproved, setRemoteApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const config = workOrdersApiConfig();
    if (!config || !propertyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await getInspectionLimits(config, poNumber, propertyId);
    setLoading(false);
    if (!res.ok) {
      setError("تعذّر تحميل حدود المعاينة");
      return;
    }
    setError(null);
    setScope(res.data.inspectionScopeKey || "");
    setReason(res.data.inspectionRestrictionReason ?? "");
    setUnits(res.data.uninspectedUnits);
    setReservation(res.data.reservationTextAr);
    setRemoteApproved(res.data.remoteInspectionApproved);
  }, [poNumber, propertyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    const config = workOrdersApiConfig();
    if (!config || disabled) return;
    setSaving(true);
    setError(null);
    const res = await saveInspectionLimits(config, poNumber, propertyId, {
      inspectionScopeKey: scope,
      inspectionRestrictionReason: reason.trim() || null,
      uninspectedUnits: units,
    });
    setSaving(false);
    if (!res.ok) {
      const msg =
        Object.values(res.errors ?? {})[0] || "تعذّر حفظ حدود المعاينة";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    setScope(res.data.inspectionScopeKey || "");
    setReason(res.data.inspectionRestrictionReason ?? "");
    setUnits(res.data.uninspectedUnits);
    setReservation(res.data.reservationTextAr);
    setRemoteApproved(res.data.remoteInspectionApproved);
    showToast("تم حفظ حدود المعاينة", "success");
  }

  function patchUnit(index: number, patch: Partial<UninspectedUnitEntryDto>) {
    setUnits((prev) =>
      prev.map((u, i) => (i === index ? { ...u, ...patch } : u)),
    );
  }

  if (!propertyId) return null;

  const limited = scope !== "" && scope !== "full";

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface-2/40 p-3">
      <div>
        <p className="m-0 text-[12px] font-bold text-heading">
          حدود المعاينة (القيود على المعاينة)
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-text-2">
          نطاق المعاينة إلزامي في كل تقرير. المعاينة المحدودة تنبيه بمبرر
          إلزامي، والمكتبية عن بُعد لا يمر إصدارها حتى يعتمدها المقيّم المعتمد.
        </p>
      </div>

      {loading ? (
        <p className="text-[12px] text-text-2">جاري التحميل…</p>
      ) : (
        <>
          <FormGroup>
            <Label className="mb-2 text-[11px] font-semibold text-text-2">
              نطاق المعاينة *
            </Label>
            <div className="flex flex-wrap gap-2">
              {SCOPE_OPTIONS.map((opt) => {
                const on = scope === opt.value;
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
                      name={`inspection-scope-${propertyId}`}
                      className="sr-only"
                      checked={on}
                      disabled={disabled || saving}
                      onChange={() => setScope(opt.value)}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </FormGroup>

          {scope === "desktop" ? (
            <Note tone={remoteApproved ? undefined : "warn"}>
              {remoteApproved
                ? "نطاق «مكتبية عن بُعد» معتمد من المقيّم المعتمد ✓"
                : "حاجب ق-7: لا يمر الإصدار حتى يعتمد المقيّم المعتمد هذا النطاق من نافذة التقييم."}
            </Note>
          ) : null}

          <div className="space-y-2.5">
            <Label className="text-[11px] font-semibold text-text-2">
              وحدات لم تُعايَن — عدد + سبب كل حالة
            </Label>
            {units.map((u, index) => (
              <div
                key={index}
                className={cn(
                  "grid gap-2 rounded-md border border-border bg-surface p-2.5",
                  mobile ? "grid-cols-1" : "sm:grid-cols-[7rem_1fr_auto]",
                )}
              >
                <FormGroup>
                  <Label className="text-[10px] text-text-2">العدد</Label>
                  <Input
                    type="number"
                    min={1}
                    disabled={disabled || saving}
                    value={u.count ? String(u.count) : ""}
                    onChange={(e) =>
                      patchUnit(index, { count: Number(e.target.value) || 0 })
                    }
                    className="text-xs"
                  />
                </FormGroup>
                <FormGroup>
                  <Label className="text-[10px] text-text-2">السبب</Label>
                  <Input
                    disabled={disabled || saving}
                    value={u.reason}
                    onChange={(e) => patchUnit(index, { reason: e.target.value })}
                    placeholder="مثال: إشغال بمستأجرين / تعذّر دخول"
                    className="text-xs"
                  />
                </FormGroup>
                {!disabled ? (
                  <div className="self-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        setUnits((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      حذف
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {!disabled ? (
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={() =>
                  setUnits((prev) => [...prev, { count: 1, reason: "" }])
                }
              >
                إضافة حالة
              </Button>
            ) : null}
          </div>

          <FormGroup>
            <Label className="text-[11px] font-semibold text-text-2">
              سبب تقييد المعاينة
              {limited || units.length > 0 ? " (إلزامي)" : ""}
            </Label>
            <Input
              disabled={disabled || saving}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: وعورة الطريق / منع دخول مبنى حكومي"
              className="text-xs"
            />
          </FormGroup>

          {reservation ? (
            <Note>
              <span className="text-[11px]">
                نص التحفّظ المركّب (يدخل الافتراضات الخاصة آلياً): {reservation}
              </span>
            </Note>
          ) : null}

          {!disabled ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={saving}
              onClick={() => void save()}
            >
              حفظ حدود المعاينة
            </Button>
          ) : null}

          {error ? <Note tone="warn">{error}</Note> : null}
        </>
      )}
    </div>
  );
}
