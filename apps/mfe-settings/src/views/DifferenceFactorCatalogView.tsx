"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Input,
  Label,
  Note,
  PageGutter,
  PageShell,
  PageShellHeader,
  useToast,
} from "@platform/ui-kit";
import {
  getDifferenceFactorCatalog,
  saveDifferenceFactorCatalog,
  type DifferenceFactorDefinitionDto,
} from "@platform/api-client";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";

function emptyFactor(sortOrder: number): DifferenceFactorDefinitionDto {
  return {
    key: "",
    labelAr: "",
    definitionAr: "",
    excludesAr: "",
    sortOrder,
    isActive: true,
  };
}

/**
 * Decision 19.2  — difference-factor definitions are admin-managed
 * reference data with a version log; «ما لا يشمله» is the anti-double-counting control.
 */
export function DifferenceFactorCatalogView() {
  const { showToast } = useToast();
  const [factors, setFactors] = useState<DifferenceFactorDefinitionDto[]>([]);
  const [version, setVersion] = useState(0);
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
    const res = await getDifferenceFactorCatalog(config);
    setLoading(false);
    if (!res.ok) {
      setError("تعذّر تحميل تعريفات عوامل الاختلاف");
      return;
    }
    setError(null);
    setFactors(res.data.factors);
    setVersion(res.data.version);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function patch(idx: number, p: Partial<DifferenceFactorDefinitionDto>) {
    setFactors((prev) => prev.map((f, i) => (i === idx ? { ...f, ...p } : f)));
  }

  async function save() {
    const config = organizationSettingsApiConfig();
    if (!config) return;
    setSaving(true);
    const res = await saveDifferenceFactorCatalog(config, {
      factors: factors.map((f, i) => ({ ...f, sortOrder: i + 1 })),
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ التعريفات", "error");
      return;
    }
    setFactors(res.data.factors);
    setVersion(res.data.version);
    showToast(`تم الحفظ — النسخة ${res.data.version} (مسجَّلة في التدقيق)`, "success");
  }

  return (
    <PageShell>
      <PageShellHeader
        title="تعريفات عوامل الاختلاف"
        meta={`بيانات مرجعية تديرها الإدارة — النسخة الحالية: ${version}`}
      />
      <PageGutter>
        {error ? <Note tone="warn">{error}</Note> : null}
        {loading ? (
          <p className="text-[13px] text-text-2">جاري التحميل…</p>
        ) : (
          <div className="flex max-w-4xl flex-col gap-3">
            <Note tone="info">
              التعريف يظهر للمقيّم عند المرور على اسم العامل، و«ما لا يشمله» هو ضابط منع
              الازدواج بين العوامل. كل حفظ يرفع رقم النسخة ويُسجَّل في سجل التدقيق.
            </Note>
            {factors.map((f, idx) => (
              <div
                key={`${f.key}-${idx}`}
                className="grid gap-2 rounded-lg border border-border bg-surface px-3 py-2.5"
              >
                <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                  <div>
                    <Label className="text-[10.5px] text-text-2">المفتاح (لاتيني)</Label>
                    <Input
                      dir="ltr"
                      value={f.key}
                      disabled={saving}
                      onChange={(e) => patch(idx, { key: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10.5px] text-text-2">اسم العامل</Label>
                    <Input
                      value={f.labelAr}
                      disabled={saving}
                      onChange={(e) => patch(idx, { labelAr: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <label className="flex items-end gap-1.5 pb-1 text-[12px] text-text-2">
                    <input
                      type="checkbox"
                      checked={f.isActive}
                      disabled={saving}
                      onChange={(e) => patch(idx, { isActive: e.target.checked })}
                    />
                    مفعّل
                  </label>
                </div>
                <div>
                  <Label className="text-[10.5px] text-text-2">التعريف المعتمد</Label>
                  <Input
                    value={f.definitionAr}
                    disabled={saving}
                    onChange={(e) => patch(idx, { definitionAr: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10.5px] text-text-2">
                    ما لا يشمله (منع الازدواج)
                  </Label>
                  <Input
                    value={f.excludesAr}
                    disabled={saving}
                    onChange={(e) => patch(idx, { excludesAr: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={() => setFactors((prev) => [...prev, emptyFactor(prev.length + 1)])}
              >
                إضافة عامل
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={saving}
                disabled={saving}
                onClick={() => void save()}
              >
                حفظ (نسخة جديدة)
              </Button>
            </div>
          </div>
        )}
      </PageGutter>
    </PageShell>
  );
}
