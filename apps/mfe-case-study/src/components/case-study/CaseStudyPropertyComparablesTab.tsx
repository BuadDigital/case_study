"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Note,
  Spinner,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from "@platform/ui-kit";
import {
  createComparableProperty,
  getValuationLists,
  linkPropertyComparable,
  listComparableProperties,
  listPropertyComparableLinks,
  patchPropertyComparableLinkDescription,
  suggestComparablePropertiesByProximity,
  unlinkPropertyComparable,
  type ComparablePropertyDto,
  type PropertyComparableLinkItemDto,
  type PropertyComparableLinkListDto,
  type ValuationListItemDto,
} from "@platform/api-client";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";
import {
  comparableDealLabel,
  comparableDraftToUpsert,
  comparableDtoToDraft,
  emptyComparableEntryDraft,
} from "../../lib/comparable-entry";
import { ComparablePropertyEntryFields } from "../comparables/ComparablePropertyEntryFields";
import type { PoPropertyIntake } from "../../lib/prototype/po-intake-data";

function specialistColumns(cols: ValuationListItemDto[]): ValuationListItemDto[] {
  const withoutCoords = cols.filter((c) => c.key !== "coords");
  if (withoutCoords.some((c) => c.key === "comp_desc" || c.name.includes("وصف"))) {
    return withoutCoords;
  }
  return [
    ...withoutCoords,
    {
      id: "comp_desc",
      key: "comp_desc",
      name: "وصف العقار",
      cells: [],
      isEnabled: true,
      defaultName: "وصف العقار",
      usage: 0,
      sortOrder: 999,
      isSystemDefault: true,
      isRequired: false,
      propertyTypeKeys: [],
    },
  ];
}

function cellValue(colKey: string, item: PropertyComparableLinkItemDto): string {
  const row = item.comparable;
  switch (colKey) {
    case "comp_type":
      return row.comparablePropertyType || "—";
    case "deal_kind":
      return comparableDealLabel(row);
    case "source":
      return row.sourceCard?.intakeChannelLabelAr || row.source || "—";
    case "listing_no":
      return row.listingNumber || row.transactionReference || "—";
    case "phone":
      return row.advertiserPhone || "—";
    case "area":
      return String(row.areaSqm ?? "—");
    case "deal_date":
      return row.transactionDate || "—";
    case "price":
      return String(row.price ?? "—");
    case "unit_price":
      return String(row.pricePerSqm ?? "—");
    case "city":
      return row.city || "—";
    case "district":
      return row.district || "—";
    case "plan_no":
      return row.planNumber || "—";
    case "plot":
      return row.plotNumber || "—";
    case "comp_desc":
      return item.description || row.description || "—";
    default:
      return "—";
  }
}

export function CaseStudyPropertyComparablesTab({
  property,
  poNumber,
}: {
  property: PoPropertyIntake;
  poNumber: string;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<PropertyComparableLinkListDto | null>(null);
  const [cols, setCols] = useState<ValuationListItemDto[]>([]);
  const [mode, setMode] = useState<"idle" | "create" | "bank">("idle");
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState(() =>
    emptyComparableEntryDraft({
      type: property.propertyType,
      city: property.city,
      district: property.district,
    }),
  );
  const [bankQ, setBankQ] = useState("");
  const [bankRows, setBankRows] = useState<ComparablePropertyDto[]>([]);
  const [nearby, setNearby] = useState<{ comparable: ComparablePropertyDto; distanceKm: number }[]>(
    [],
  );

  const linkedIds = useMemo(
    () => new Set((list?.items ?? []).map((x) => x.comparablePropertyId)),
    [list],
  );

  const reload = useCallback(async () => {
    const config = workOrdersApiConfig();
    if (!config) return;
    const [links, lists] = await Promise.all([
      listPropertyComparableLinks(config, property.id),
      getValuationLists(config),
    ]);
    if (links.ok) setList(links.data);
    else showToast("تعذّر تحميل المقارنات المربوطة", "error");
    if (lists.ok) {
      setCols(
        specialistColumns(
          (lists.data.lists.comparables ?? [])
            .filter((r) => r.isEnabled)
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder),
        ),
      );
    }
    setLoading(false);
  }, [property.id, showToast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createAndLink() {
    const config = workOrdersApiConfig();
    if (!config) return;
    setSaving(true);
    const created = await createComparableProperty(
      config,
      comparableDraftToUpsert(entry, {
        intakeChannel: "office",
        sourceWorkOrderNumber: poNumber,
        sourcePropertyId: property.id,
      }),
    );
    if (!created.ok) {
      setSaving(false);
      showToast(created.message ?? "تعذّر حفظ المقارن", "error");
      return;
    }
    if (entry.description.trim()) {
      await patchPropertyComparableLinkDescription(
        config,
        property.id,
        created.data.id,
        entry.description.trim(),
      );
    }
    setSaving(false);
    setMode("idle");
    setEntry(
      emptyComparableEntryDraft({
        type: property.propertyType,
        city: property.city,
        district: property.district,
      }),
    );
    showToast("أُضيف المقارن ورُبط بالعقار", "success");
    await reload();
  }

  async function searchBank() {
    const config = workOrdersApiConfig();
    if (!config) return;
    setSaving(true);
    const [bank, prox] = await Promise.all([
      listComparableProperties(config, {
        q: bankQ.trim() || undefined,
        city: property.city || undefined,
        district: property.district || undefined,
        take: 40,
      }),
      suggestComparablePropertiesByProximity(config, {
        propertyId: property.id,
        excludeIds: [...linkedIds].join(","),
        take: 12,
      }),
    ]);
    setSaving(false);
    if (bank.ok) setBankRows(bank.data);
    else showToast("تعذّر تحميل بنك العقارات", "error");
    if (prox.ok) setNearby(prox.data.items);
  }

  async function attach(comp: ComparablePropertyDto) {
    const config = workOrdersApiConfig();
    if (!config) return;
    setSaving(true);
    const res = await linkPropertyComparable(config, {
      propertyId: property.id,
      comparablePropertyId: comp.id,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر الربط", "error");
      return;
    }
    setList(res.data);
    showToast("رُبط المقارن بالعقار", "success");
  }

  async function detach(item: PropertyComparableLinkItemDto) {
    const config = workOrdersApiConfig();
    if (!config) return;
    setSaving(true);
    const res = await unlinkPropertyComparable(
      config,
      property.id,
      item.comparablePropertyId,
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر الاستبعاد", "error");
      return;
    }
    showToast("استُبعد المقارن من هذا العقار (يبقى في البنك)", "success");
    await reload();
  }

  async function saveDescription(item: PropertyComparableLinkItemDto, value: string) {
    const config = workOrdersApiConfig();
    if (!config) return;
    const res = await patchPropertyComparableLinkDescription(
      config,
      property.id,
      item.comparablePropertyId,
      value,
    );
    if (!res.ok) {
      showToast("تعذّر حفظ الوصف", "error");
      return;
    }
    await reload();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-3">
        <Spinner />
        <span className="text-[13px]">جاري تحميل العقارات المقارنة…</span>
      </div>
    );
  }

  const count = list?.linkedCount ?? 0;
  const min = list?.minimumRequired ?? 2;
  const ready = list?.meetsMinimumForAppraisalPrep ?? count >= min;

  return (
    <div className="flex flex-col gap-3 pt-4" dir="rtl">
      <div>
        <h2 className="m-0 text-[15px] font-bold text-heading">تقييم العقار — العقارات المقارنة</h2>
        <p className="mt-1 mb-0 text-[12px] text-text-2">
          راجع إدخال المعاين أو أضف من البنك أو أدخل مقارناً جديداً. لا يُرفع النموذج للمقيم قبل ربط{" "}
          {min} مقارنين على الأقل.
        </p>
      </div>

      <Note tone={ready ? "success" : "warn"}>
        {ready
          ? `${count} مقارن مربوط — يمكن رفع دراسة الحالة للمقيم.`
          : `مربوط ${count} من ${min} مطلوبين لإتمام التجهيز وإرسال التقييم للمقيم.`}
      </Note>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "create" ? "primary" : "default"}
          onClick={() => setMode((m) => (m === "create" ? "idle" : "create"))}
        >
          إدخال مقارن جديد
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "bank" ? "primary" : "default"}
          onClick={() => {
            setMode((m) => (m === "bank" ? "idle" : "bank"));
            if (mode !== "bank") void searchBank();
          }}
        >
          اختيار من بنك العقارات
        </Button>
      </div>

      {mode === "create" ? (
        <div className="rounded-lg border border-border p-3">
          <ComparablePropertyEntryFields
            draft={entry}
            disabled={saving}
            onChange={setEntry}
          />
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={saving}
              disabled={saving}
              onClick={() => void createAndLink()}
            >
              حفظ وربط بهذا العقار
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "bank" ? (
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex gap-2">
            <Input
              value={bankQ}
              onChange={(e) => setBankQ(e.target.value)}
              placeholder="بحث في البنك…"
              className="text-xs"
            />
            <Button type="button" size="sm" loading={saving} onClick={() => void searchBank()}>
              بحث
            </Button>
          </div>
          {nearby.length ? (
            <div className="mb-3">
              <p className="mb-1 text-[11px] font-bold text-heading">الأقرب حسب الإحداثيات</p>
              {nearby.map((row) => (
                <BankRow
                  key={row.comparable.id}
                  row={row.comparable}
                  extra={`${row.distanceKm.toFixed(2)} كم`}
                  linked={linkedIds.has(row.comparable.id)}
                  disabled={saving}
                  onAttach={() => void attach(row.comparable)}
                />
              ))}
            </div>
          ) : null}
          <p className="mb-1 text-[11px] font-bold text-heading">نتائج البنك</p>
          {bankRows.length === 0 ? (
            <p className="text-[12px] text-text-3">لا نتائج.</p>
          ) : (
            bankRows.map((row) => (
              <BankRow
                key={row.id}
                row={row}
                linked={linkedIds.has(row.id)}
                disabled={saving}
                onAttach={() => void attach(row)}
              />
            ))
          )}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <THead>
            <Tr>
              {cols.map((col) => (
                <Th key={col.id} className="whitespace-nowrap text-[11px]">
                  {col.name}
                </Th>
              ))}
              <Th className="whitespace-nowrap text-[11px]">إجراء</Th>
            </Tr>
          </THead>
          <TBody>
            {(list?.items ?? []).length === 0 ? (
              <Tr>
                <Td colSpan={cols.length + 1} className="text-[12px] text-text-3">
                  لا مقارنات مربوطة بعد.
                </Td>
              </Tr>
            ) : (
              (list?.items ?? []).map((item) => (
                <Tr key={item.linkId}>
                  {cols.map((col) => (
                    <Td key={col.id} className="text-[11.5px] align-top">
                      {col.key === "comp_desc" ? (
                        <Input
                          defaultValue={item.description ?? item.comparable.description ?? ""}
                          className="min-w-[10rem] text-xs"
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            const prev = (item.description ?? item.comparable.description ?? "").trim();
                            if (next !== prev) void saveDescription(item, next);
                          }}
                        />
                      ) : (
                        cellValue(col.key, item)
                      )}
                    </Td>
                  ))}
                  <Td>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={saving}
                      onClick={() => void detach(item)}
                    >
                      استبعاد
                    </Button>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

function BankRow({
  row,
  extra,
  linked,
  disabled,
  onAttach,
}: {
  row: ComparablePropertyDto;
  extra?: string;
  linked: boolean;
  disabled?: boolean;
  onAttach: () => void;
}) {
  const draft = comparableDtoToDraft(row);
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
      <div className="min-w-0 text-[11.5px]">
        <strong>{row.referenceCode}</strong>
        {" · "}
        {row.comparablePropertyType}
        {" · "}
        {comparableDealLabel(row)}
        {" · "}
        {row.district}
        {extra ? ` · ${extra}` : null}
        {draft.planNumber ? ` · مخطط ${draft.planNumber}` : null}
      </div>
      <Button
        type="button"
        size="sm"
        disabled={disabled || linked}
        onClick={onAttach}
      >
        {linked ? "مربوط" : "ربط"}
      </Button>
    </div>
  );
}
