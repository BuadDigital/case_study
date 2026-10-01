"use client";

/**
 * «مكونات العقار» — the case specialist's part of the property description:
 * the report text (written from what the inspector sent: text or a photographed sheet) and
 * the components table. The table is always listed and printed when filled; whether the
 * components are valued is the appraiser's scope choice (land only / buildings only / land
 * with buildings). Report text is required before accepting; the table is optional.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Button,
  FormGroup,
  GentleBusy,
  Label,
  Note,
  Textarea,
  useToast,
} from "@platform/ui-kit";
import {
  getBuildingInventory,
  saveBuildingInventory,
  type BuildingInventoryLineDto,
} from "@platform/api-client";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";
import {
  componentLinesIssue,
  emptyComponentLine,
} from "../../lib/app-data/specialist-components";
import { SpecialistComponentsTable } from "./SpecialistComponentsTable";
import { InsReadField } from "./PropertyDetailInspectionFields";

export function SpecialistComponentsSection({
  poNumber,
  propertyId,
  disabled,
  inspectorReference,
  onSaved,
}: {
  poNumber: string;
  propertyId: string;
  disabled?: boolean;
  /** What the inspector sent (text / photo), shown read-only above the specialist's text. */
  inspectorReference?: ReactNode;
  onSaved?: () => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [lines, setLines] = useState<BuildingInventoryLineDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

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
      setError("تعذّر تحميل مكونات العقار");
      return;
    }
    setError(null);
    setText(res.data.componentsText ?? "");
    setLines(res.data.lines);
    setDirty(false);
  }, [poNumber, propertyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const locked = Boolean(disabled) || saving;

  async function save() {
    const config = workOrdersApiConfig();
    if (!config || disabled) return;
    const issue = componentLinesIssue(lines);
    if (issue) {
      setError(issue);
      showToast(issue, "error");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await saveBuildingInventory(config, poNumber, propertyId, {
      componentsText: text,
      lines: lines.map((l, i) => ({ ...l, sortOrder: i })),
    });
    setSaving(false);
    if (!res.ok) {
      const msg =
        res.kind === "forbidden"
          ? "مكونات العقار يعبّيها أخصائي دراسة الحالة"
          : res.errors?.lines ||
            res.errors?.componentsText ||
            Object.values(res.errors ?? {})[0] ||
            "تعذّر حفظ مكونات العقار";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    setText(res.data.componentsText ?? "");
    setLines(res.data.lines);
    setDirty(false);
    showToast("تم حفظ مكونات العقار", "success");
    onSaved?.();
  }

  if (!propertyId) return null;

  return (
    <div id="specialist-components" className="space-y-3">
      {inspectorReference ? (
        <div className="rounded-lg border border-border bg-surface-2/60 p-3">
          <p className="m-0 mb-2 text-[11px] font-semibold text-text-2">
            ما أرسله المعاين (للمرجعية — لا يُطبع)
          </p>
          {inspectorReference}
        </div>
      ) : null}

      {loading ? (
        <GentleBusy>
          <p className="text-[12px] text-text-2">جاري التحميل…</p>
        </GentleBusy>
      ) : (
        <>
          {disabled ? (
            <InsReadField label="مكونات العقار (تُطبع في التقرير)" value={text} multiline />
          ) : (
            <FormGroup>
              <Label htmlFor={`components-text-${propertyId}`} className="text-[12px] font-semibold">
                مكونات العقار (تُطبع في التقرير)
              </Label>
              <p className="m-0 mb-1.5 text-[11px] text-text-3">
                نسّق وصف المعاين هنا، أو اكتبه من الصورة إذا أرسل صورة فقط.
              </p>
              <Textarea
                id={`components-text-${propertyId}`}
                rows={5}
                disabled={locked}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setDirty(true);
                }}
                className="min-h-[110px] resize-y text-[13px]"
              />
            </FormGroup>
          )}

          <div>
            <p className="m-0 text-[12px] font-bold text-heading">جدول المكونات</p>
            {disabled ? null : (
              <p className="m-0 mt-0.5 text-[11px] text-text-3">
                اختياري — احصر المكونات (أدوار، ملاحق، سور…) عند الحاجة. تُطبع في التقرير،
                والمقيّم يقرّر هل تدخل في القيمة.
              </p>
            )}
          </div>
          {lines.length > 0 ? (
            <SpecialistComponentsTable
              lines={lines}
              disabled={locked}
              readView={Boolean(disabled)}
              onPatch={(index, next) => {
                setLines((prev) => prev.map((l, i) => (i === index ? next : l)));
                setDirty(true);
              }}
              onRemove={(index) => {
                setLines((prev) => prev.filter((_, i) => i !== index));
                setDirty(true);
              }}
            />
          ) : (
            <p className="m-0 text-[12px] text-text-3">{disabled ? "لا توجد بنود." : "لا توجد بنود بعد."}</p>
          )}

          {!disabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={locked}
                onClick={() => {
                  setLines((prev) => [...prev, emptyComponentLine(prev.length)]);
                  setDirty(true);
                }}
              >
                إضافة بند
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={saving}
                disabled={locked}
                onClick={() => void save()}
              >
                حفظ مكونات العقار
              </Button>
              {dirty ? <span className="text-[11px] text-warn-text">تعديلات غير محفوظة</span> : null}
            </div>
          ) : null}

          {error ? <Note tone="warn">{error}</Note> : null}
        </>
      )}
    </div>
  );
}
