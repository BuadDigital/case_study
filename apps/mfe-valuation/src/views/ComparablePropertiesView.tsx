"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createComparableProperty,
  deactivateComparableProperty,
  getApiBase,
  listComparableProperties,
  type ComparablePropertyDto,
  type UpsertComparablePropertyRequest,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
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

function apiConfig() {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

function emptyForm(): UpsertComparablePropertyRequest {
  return {
    comparablePropertyType: "",
    transactionKind: "offer",
    priceDescription: "asking",
    source: "listing_platform",
    listingNumber: "",
    advertiserPhone: "",
    latitude: 24.7136,
    longitude: 46.6753,
    areaSqm: 0,
    transactionDate: "",
    price: 0,
    city: "",
    district: "",
    description: "",
    intakeChannel: "office",
    isActive: true,
  };
}

/**
 * Phase 2 scaffold — company-wide comparable bank CRUD.
 * Selection / adopt into a valuation request lives on the appraiser workspace (المقارنات tab).
 */
export function ComparablePropertiesView() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<ComparablePropertyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<UpsertComparablePropertyRequest>(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const reload = useCallback(async () => {
    const config = apiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    setLoading(true);
    const res = await listComparableProperties(config, { q: q || undefined, take: 100 });
    setLoading(false);
    if (!res.ok) {
      setError("تعذّر تحميل بنك المقارنات");
      return;
    }
    setError(null);
    setRows(res.data);
  }, [q]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate() {
    const config = apiConfig();
    if (!config) return;
    setSaving(true);
    const res = await createComparableProperty(config, {
      ...form,
      priceDescription:
        form.transactionKind === "offer" ? form.priceDescription : null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر الحفظ", "error");
      return;
    }
    const anomaly = res.data.pricePerSqmAnomalyNoteAr;
    showToast(
      anomaly ? `أُضيف المقارن إلى البنك — ${anomaly}` : "أُضيف المقارن إلى البنك",
      anomaly ? "error" : "success",
    );
    setForm(emptyForm());
    setShowForm(false);
    await reload();
  }

  async function onDeactivate(id: string) {
    const config = apiConfig();
    if (!config) return;
    const res = await deactivateComparableProperty(config, id);
    if (!res.ok) {
      showToast("تعذّر التعطيل", "error");
      return;
    }
    showToast("عُطّل المقارن (بدون حذف صلب)", "success");
    await reload();
  }

  return (
    <PageShell>
      <PageShellHeader title="بنك العقارات المقارنة">
        <p className="m-0 text-[11px] text-text-3">
          سجل مشترك على مستوى الشركة — تاريخ العملية إلزامي. بطاقة المصدر تُعرض لكل صف.
          لا تسويات ولا أوزان في هذه الشاشة بعد.
        </p>
      </PageShellHeader>
      <PageGutter className="space-y-4 pb-8">
        <Note tone="info">
          مرحلة 2 هيكل فقط: إدخال/بحث/تعطيل. اختيار المقارنات للتقييم والخرائط والمحرك لاحقًا.
        </Note>

        <div className="flex flex-wrap items-end gap-2">
          <FormGroup className="min-w-[12rem] flex-1">
            <Label className="text-[11px]">بحث</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="مرجع / نوع / حي / إعلان…"
              className="text-xs"
            />
          </FormGroup>
          <Button type="button" size="sm" onClick={() => void reload()}>
            تحديث
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "إخفاء النموذج" : "إضافة مقارن"}
          </Button>
        </div>

        {showForm ? (
          <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <FormGroup>
                <Label className="text-[10px]">نوع العقار المقارن *</Label>
                <Input
                  value={form.comparablePropertyType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      comparablePropertyType: e.target.value,
                    }))
                  }
                  placeholder="أرض سكنية"
                  className="text-xs"
                />
              </FormGroup>
              <FormGroup>
                <Label className="text-[10px]">نوع العملية *</Label>
                <Select
                  value={form.transactionKind}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, transactionKind: e.target.value }))
                  }
                  className="text-xs"
                >
                  <option value="offer">عرض</option>
                  <option value="executed">تنفيذ</option>
                </Select>
              </FormGroup>
              {form.transactionKind === "offer" ? (
                <FormGroup>
                  <Label className="text-[10px]">وصف السعر *</Label>
                  <Select
                    value={form.priceDescription ?? "asking"}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        priceDescription: e.target.value,
                      }))
                    }
                    className="text-xs"
                  >
                    <option value="asking">حد</option>
                    <option value="negotiable">تفاوض</option>
                  </Select>
                </FormGroup>
              ) : null}
              <FormGroup>
                <Label className="text-[10px]">المصدر</Label>
                <Select
                  value={form.source}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, source: e.target.value }))
                  }
                  className="text-xs"
                >
                  <option value="listing_platform">منصة إعلان</option>
                  <option value="bourse">بورصة</option>
                  <option value="field">ميدان</option>
                  <option value="prior_valuation">معاملة سابقة</option>
                  <option value="other">أخرى</option>
                </Select>
              </FormGroup>
              <FormGroup>
                <Label className="text-[10px]">رافد الإدخال</Label>
                <Select
                  value={form.intakeChannel}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, intakeChannel: e.target.value }))
                  }
                  className="text-xs"
                >
                  <option value="office">مكتبي</option>
                  <option value="field">ميداني</option>
                  <option value="system">اقتراح النظام</option>
                </Select>
              </FormGroup>
              <FormGroup>
                <Label className="text-[10px]">تاريخ العملية *</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={form.transactionDate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      transactionDate: e.target.value,
                    }))
                  }
                  className="text-xs"
                />
              </FormGroup>
              <FormGroup>
                <Label className="text-[10px]">المساحة م² *</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={form.areaSqm || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      areaSqm: Number(e.target.value) || 0,
                    }))
                  }
                  className="text-xs"
                />
              </FormGroup>
              <FormGroup>
                <Label className="text-[10px]">السعر *</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={form.price || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      price: Number(e.target.value) || 0,
                    }))
                  }
                  className="text-xs"
                />
              </FormGroup>
              <FormGroup>
                <Label className="text-[10px]">الحي *</Label>
                <Input
                  value={form.district}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, district: e.target.value }))
                  }
                  className="text-xs"
                />
              </FormGroup>
              <FormGroup>
                <Label className="text-[10px]">المدينة</Label>
                <Input
                  value={form.city ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                  className="text-xs"
                />
              </FormGroup>
              <FormGroup>
                <Label className="text-[10px]">خط العرض *</Label>
                <Input
                  type="number"
                  step="0.000001"
                  dir="ltr"
                  value={form.latitude}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      latitude: Number(e.target.value),
                    }))
                  }
                  className="text-xs"
                />
              </FormGroup>
              <FormGroup>
                <Label className="text-[10px]">خط الطول *</Label>
                <Input
                  type="number"
                  step="0.000001"
                  dir="ltr"
                  value={form.longitude}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      longitude: Number(e.target.value),
                    }))
                  }
                  className="text-xs"
                />
              </FormGroup>
              <FormGroup>
                <Label className="text-[10px]">رقم الإعلان</Label>
                <Input
                  dir="ltr"
                  value={form.listingNumber ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      listingNumber: e.target.value,
                    }))
                  }
                  className="text-xs"
                />
              </FormGroup>
              <FormGroup className="sm:col-span-2">
                <Label className="text-[10px]">الوصف</Label>
                <Input
                  value={form.description ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="text-xs"
                />
              </FormGroup>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={saving}
              onClick={() => void onCreate()}
            >
              حفظ في البنك
            </Button>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-text-2">جاري التحميل…</p>
        ) : error ? (
          <Note tone="warn">{error}</Note>
        ) : rows.length === 0 ? (
          <p className="text-sm text-text-2">لا مقارنات بعد.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <article
                key={row.id}
                className={cn(
                  "rounded-lg border border-border bg-surface p-3",
                  !row.isActive && "opacity-60",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="m-0 text-[13px] font-bold text-heading">
                      {row.referenceCode} · {row.comparablePropertyType}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-2">
                      {row.transactionKindLabelAr}
                      {row.priceDescriptionLabelAr
                        ? ` / ${row.priceDescriptionLabelAr}`
                        : ""}{" "}
                      · {row.district}
                      {row.city ? ` · ${row.city}` : ""} ·{" "}
                      {row.transactionDate} · {row.areaSqm} م² ·{" "}
                      {row.price.toLocaleString("ar-SA")} ر.س ·{" "}
                      {row.pricePerSqm.toLocaleString("ar-SA")} ر.س/م²
                    </p>
                    <p className="mt-1 text-[10px] text-text-3">
                      بطاقة المصدر: {row.sourceCard.intakeChannelLabelAr} ·{" "}
                      {row.sourceCard.freshnessLabelAr}
                      {row.sourceCard.fromPriorDeal
                        ? ` · من معاملة سابقة${
                            row.sourceCard.sourceWorkOrderNumber
                              ? ` (${row.sourceCard.sourceWorkOrderNumber})`
                              : ""
                          }`
                        : ""}
                    </p>
                  </div>
                  {row.isActive ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void onDeactivate(row.id)}
                    >
                      تعطيل
                    </Button>
                  ) : (
                    <span className="text-[10px] text-text-3">معطّل</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </PageGutter>
    </PageShell>
  );
}
