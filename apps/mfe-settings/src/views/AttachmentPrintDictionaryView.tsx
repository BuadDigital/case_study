"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  FormGroup,
  Input,
  Label,
  Note,
  PageGutter,
  PageShell,
  PageShellHeader,
  Select,
  cn,
  useToast,
} from "@platform/design-system";
import { getAttachmentPrintDictionary, saveAttachmentPrintDictionary, type AttachmentPrintTypeDto } from "@platform/api-client";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";

const PROPERTY_TYPE_HINT = "اتركها فارغة لكل الأنواع، أو افصل بفواصل: فيلا، عمارة، شقة…";

function emptyType(sortOrder: number): AttachmentPrintTypeDto {
  return {
    id: "",
    key: "",
    labelAr: "",
    propertyTypeKeys: [],
    isRequired: false,
    isSystemDefault: false,
    sortOrder,
    isActive: true,
  };
}

export function AttachmentPrintDictionaryView() {
  const { showToast } = useToast();
  const [types, setTypes] = useState<AttachmentPrintTypeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const config = organizationSettingsApiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    setLoading(true);
    const res = await getAttachmentPrintDictionary(config);
    setLoading(false);
    if (!res.ok) {
      setError("تعذّر تحميل قاموس المرفقات");
      return;
    }
    setError(null);
    setTypes(res.data.types);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function patchType(index: number, patch: Partial<AttachmentPrintTypeDto>) {
    setTypes((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addType() {
    setTypes((prev) => [...prev, emptyType(prev.length + 1)]);
  }

  function removeType(index: number) {
    setTypes((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((row, i) => ({ ...row, sortOrder: i + 1 })),
    );
  }

  async function persist() {
    const config = organizationSettingsApiConfig();
    if (!config) return;
    setSaving(true);
    setError(null);
    const payload = types.map((t, i) => ({
      ...t,
      id: t.id || t.key,
      key: t.key.trim().toLowerCase(),
      labelAr: t.labelAr.trim(),
      sortOrder: t.sortOrder || i + 1,
      propertyTypeKeys: t.propertyTypeKeys,
    }));
    const res = await saveAttachmentPrintDictionary(config, { types: payload });
    setSaving(false);
    if (!res.ok) {
      setError("تعذّر حفظ القاموس");
      showToast("تعذّر حفظ قاموس المرفقات", "error");
      return;
    }
    setTypes(res.data.types);
    showToast("تم حفظ قاموس مرفقات التقرير", "success");
  }

  return (
    <PageShell>
      <PageShellHeader title="قاموس مرفقات التقرير">
        <p className="m-0 text-[11px] text-text-3">
          أنواع المرفقات القابلة للطباعة في تقرير التقييم. مستندات المعاملة تبقى في
          المكتبة؛ لا يُطبع إلا ما صُنّف وعُلّم «يُطبع في التقرير».
        </p>
      </PageShellHeader>
      <PageGutter className="space-y-4 pb-8">
        {loading ? (
          <p className="text-sm text-text-2">جاري التحميل…</p>
        ) : (
          <>
            <Note tone="info">
              الأنواع الافتراضية: الصك، الرفع المساحي، الكروكي التنظيمي، رخصة المباني.
              يمكنك إضافة أنواع أخرى بحرّية.
            </Note>

            <div className="space-y-3">
              {types.map((row, index) => (
                <div
                  key={`${row.id || "new"}-${index}`}
                  className={cn(
                    "grid gap-3 rounded-lg border border-border bg-surface p-3",
                    "sm:grid-cols-2 lg:grid-cols-3",
                  )}
                >
                  <FormGroup>
                    <Label className="text-[11px]">المفتاح (إنجليزي)</Label>
                    <Input
                      value={row.key}
                      disabled={row.isSystemDefault}
                      onChange={(e) =>
                        patchType(index, {
                          key: e.target.value,
                          id: row.id || e.target.value,
                        })
                      }
                      placeholder="deed"
                      className="text-xs"
                      dir="ltr"
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label className="text-[11px]">التسمية بالعربية</Label>
                    <Input
                      value={row.labelAr}
                      onChange={(e) =>
                        patchType(index, { labelAr: e.target.value })
                      }
                      placeholder="الصك"
                      className="text-xs"
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label className="text-[11px]">أنواع العقار المرتبطة</Label>
                    <Input
                      value={row.propertyTypeKeys.join("، ")}
                      onChange={(e) =>
                        patchType(index, {
                          propertyTypeKeys: e.target.value
                            .split(/[,،]/)
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder={PROPERTY_TYPE_HINT}
                      className="text-xs"
                    />
                  </FormGroup>
                  <FormGroup>
                    <Label className="text-[11px]">إلزامي؟</Label>
                    <Select
                      value={row.isRequired ? "yes" : "no"}
                      onChange={(e) =>
                        patchType(index, {
                          isRequired: e.target.value === "yes",
                        })
                      }
                      className="text-xs"
                    >
                      <option value="no">لا</option>
                      <option value="yes">نعم</option>
                    </Select>
                  </FormGroup>
                  <FormGroup>
                    <Label className="text-[11px]">نشط؟</Label>
                    <Select
                      value={row.isActive ? "yes" : "no"}
                      onChange={(e) =>
                        patchType(index, {
                          isActive: e.target.value === "yes",
                        })
                      }
                      className="text-xs"
                    >
                      <option value="yes">نعم</option>
                      <option value="no">لا</option>
                    </Select>
                  </FormGroup>
                  <div className="flex items-end">
                    {!row.isSystemDefault ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => removeType(index)}
                      >
                        حذف
                      </Button>
                    ) : (
                      <span className="text-[11px] text-text-3">نوع نظامي</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={addType}>
                إضافة نوع
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={saving}
                disabled={saving}
                onClick={() => void persist()}
              >
                حفظ القاموس
              </Button>
            </div>

            {error ? <Note tone="warn">{error}</Note> : null}
          </>
        )}
      </PageGutter>
    </PageShell>
  );
}
