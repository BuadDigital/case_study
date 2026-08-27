"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
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
  listPropertyComparableLinks,
  type ComparablePropertyDto,
  type PropertyComparableLinkItemDto,
  type ValuationListItemDto,
} from "@platform/api-client";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";
import {
  comparableDealLabel,
  comparableDraftToUpsert,
  emptyComparableEntryDraft,
} from "../../lib/comparable-entry";
import { ComparablePropertyEntryFields } from "../comparables/ComparablePropertyEntryFields";

function fieldColumns(cols: ValuationListItemDto[]): ValuationListItemDto[] {
  return cols
    .filter((c) => c.isEnabled)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function cellValue(
  colKey: string,
  row: ComparablePropertyDto,
  description?: string | null,
): string {
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
      return description || row.description || "—";
    case "coords":
      return row.latitude || row.longitude
        ? `${row.latitude}, ${row.longitude}`
        : "—";
    default:
      return "—";
  }
}

/**
 * Optional field capture during inspection. Rows enter the company bank
 * and are linked to this property when a property id is provided.
 * Columns follow Settings → قوائم التقييم → العقارات المقارنة.
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
  const [loading, setLoading] = useState(true);
  const [cols, setCols] = useState<ValuationListItemDto[]>([]);
  const [items, setItems] = useState<PropertyComparableLinkItemDto[]>([]);
  const [sessionRows, setSessionRows] = useState<ComparablePropertyDto[]>([]);
  const [draft, setDraft] = useState(() =>
    emptyComparableEntryDraft({
      type: propertyType,
      city,
      district,
      latitude,
      longitude,
    }),
  );

  const reload = useCallback(async () => {
    const config = workOrdersApiConfig();
    if (!config) {
      setLoading(false);
      return;
    }
    const lists = await getValuationLists(config);
    if (lists.ok) {
      setCols(fieldColumns(lists.data.lists.comparables ?? []));
    }
    if (propertyId) {
      const links = await listPropertyComparableLinks(config, propertyId);
      if (links.ok) {
        setItems(links.data.items);
        setSessionRows([]);
      }
    }
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      comparablePropertyType: prev.comparablePropertyType || propertyType || "",
      city: prev.city || city || "",
      district: prev.district || district || "",
      latitude: prev.latitude || latitude || "",
      longitude: prev.longitude || longitude || "",
    }));
  }, [propertyType, city, district, latitude, longitude]);

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
    if (propertyId) {
      await reload();
    } else {
      setSessionRows((prev) => [res.data, ...prev]);
    }
  }

  const tableRows: { key: string; row: ComparablePropertyDto; description?: string | null }[] =
    propertyId
      ? items.map((item) => ({
          key: item.linkId,
          row: item.comparable,
          description: item.description,
        }))
      : sessionRows.map((row) => ({
          key: row.id,
          row,
          description: row.description,
        }));

  return (
    <div dir="rtl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[11px] text-text-2">
          إدخال أولي أثناء المعاينة — الحقول من إعدادات «قوائم التقييم / العقارات
          المقارنة»، وتُحفظ في بنك العقارات.
        </p>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "إغلاق النموذج" : "إضافة مقارن"}
        </Button>
      </div>

      {open ? (
        <div className="mt-3 rounded-md border border-border bg-surface p-3">
          <ComparablePropertyEntryFields
            draft={draft}
            disabled={saving || disabled}
            onChange={setDraft}
          />
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={saving}
              disabled={saving || disabled}
              onClick={() => void save()}
            >
              حفظ في بنك العقارات
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-text-3">
            <Spinner />
            <span className="text-[12px]">جاري تحميل المقارنات…</span>
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                {cols.map((col) => (
                  <Th key={col.id} className="whitespace-nowrap text-[11px]">
                    {col.name}
                  </Th>
                ))}
              </Tr>
            </THead>
            <TBody>
              {tableRows.length === 0 ? (
                <Tr>
                  <Td
                    colSpan={Math.max(cols.length, 1)}
                    className="text-center text-[12px] text-text-3"
                  >
                    لا توجد مقارنات بعد — اضغط «إضافة مقارن».
                  </Td>
                </Tr>
              ) : (
                tableRows.map(({ key, row, description }) => (
                  <Tr key={key}>
                    {cols.map((col) => (
                      <Td key={col.id} className="whitespace-nowrap text-[11.5px] align-top">
                        {cellValue(col.key, row, description)}
                      </Td>
                    ))}
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
