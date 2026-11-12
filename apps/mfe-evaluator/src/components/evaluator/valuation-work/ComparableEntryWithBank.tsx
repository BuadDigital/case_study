"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ComparablePropertyDto } from "@platform/api-client";
import type {
  ComparableEntryDraft,
  ComparableEntryFieldErrors,
} from "@platform/app-shared/app-data/comparable-entry";
import { useNearbyBankComparables } from "@platform/app-shared/comparables/NearbyBankComparables";
import { parseLatLng, type LatLng } from "@platform/app-shared/domain/geo";
import type { ComparableBankBrowse } from "@platform/app-shared/evaluator/comparable-entry-fields-slot";
import { useDebouncedValue } from "@platform/app-shared/hooks/use-debounced-value";
import { Input, Select } from "@platform/ui-kit";
import { ComparablePropertyEntryFields } from "../ComparablePropertyEntryFieldsSlot";
import {
  isVacantLandComparable,
  searchBankComparables,
  type BankDisplayRow,
} from "./lib/bank-ranking";
import {
  comparableFilterOptions,
  filterMapComparables,
  mapPickerPool,
} from "./lib/comparables-map";
import { apiConfig } from "./lib/shell-utils";

/** How far around the point the map rests on the bank is read. */
const MAP_BROWSE_RADIUS_KM = 10;

/**
 * The body of «إضافة مقارن» in the valuation (Omar 2026-11-11: one window for a comparable — the
 * separate «خريطة المقارنات» was folded into it): the entry form, whose map is also where the bank
 * is searched and a comparable chosen for the transaction.
 *
 * How it works: without search text the pins are the bank's comparables around the subject and
 * around wherever the map rests; with search text (reference code, district) they are the hits,
 * anywhere. The type and usage lists narrow the pins. Pressing a pin shows its details with one
 * action, by where the comparable stands (Omar 2026-11-12: adding is apart from adopting):
 * «إضافة للمعاملة» for a bank comparable — it joins the table, not adopted; «اعتماد المقارن» for
 * one already in the table; «إلغاء الاعتماد» for an adopted one. The window stays open to do
 * several. Pinning a spot on the map opens the fields of a new comparable.
 *
 * Edge cases: the table's own comparables always show (green when adopted), whatever the filters
 * or the search. A comparable with no coordinates has no pin — a search that finds only such ones
 * says so. The land table (`landOnly`) shows lands only. A search with one hit opens its details.
 */
export function ComparableEntryWithBank({
  draft,
  saving,
  fieldErrors,
  subjectPin,
  propertyId,
  subjectSqm,
  landOnly,
  rows,
  pendingAdopt,
  onToggleAdopt,
  onAdd,
  onChange,
  onLocationConfirmedChange,
}: {
  draft: ComparableEntryDraft;
  saving: boolean;
  fieldErrors: ComparableEntryFieldErrors;
  subjectPin: LatLng | null;
  propertyId?: string;
  subjectSqm: number | null;
  landOnly: boolean;
  /** The table's own rows — drawn always, and the source of what is adopted. */
  rows: BankDisplayRow[];
  /** Adoptions being saved, by comparable id. */
  pendingAdopt: ReadonlyMap<string, boolean>;
  onToggleAdopt: (comparable: ComparablePropertyDto, adopted: boolean) => void;
  /** Add a bank comparable to the transaction's table, not adopted. */
  onAdd: (comparable: ComparablePropertyDto) => void;
  onChange: (next: ComparableEntryDraft) => void;
  onLocationConfirmedChange: (confirmed: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [usageFilter, setUsageFilter] = useState("");
  const [center, setCenter] = useState<LatLng | null>(null);

  const search = useDebouncedValue(q.trim(), 350);
  const searching = search.length > 0;
  const searchQuery = useQuery({
    queryKey: ["comparable-bank-search", search, propertyId ?? "", subjectPin?.lat, subjectPin?.lng],
    enabled: searching,
    queryFn: async (): Promise<ComparablePropertyDto[]> => {
      const config = apiConfig();
      if (!config) return [];
      return searchBankComparables(config, {
        q: search,
        propertyId,
        subjectSqm,
        latitude: subjectPin?.lat,
        longitude: subjectPin?.lng,
      });
    },
  });
  const nearby = useNearbyBankComparables(
    subjectPin,
    searching ? null : center,
    MAP_BROWSE_RADIUS_KM,
  );

  const ownComparables = useMemo(() => rows.map((row) => row.comp), [rows]);
  const pool = useMemo(
    () =>
      mapPickerPool({
        own: ownComparables,
        bank: searching ? (searchQuery.data ?? []) : nearby,
        keep: landOnly ? (c) => isVacantLandComparable(c.comparablePropertyType) : undefined,
      }),
    [ownComparables, searching, searchQuery.data, nearby, landOnly],
  );
  const ownIds = useMemo(() => new Set(ownComparables.map((c) => c.id)), [ownComparables]);
  const options = useMemo(() => comparableFilterOptions(pool), [pool]);
  const shown = useMemo(
    () => filterMapComparables(pool, { type: typeFilter, usage: usageFilter, alwaysIds: ownIds }),
    [pool, typeFilter, usageFilter, ownIds],
  );

  const adoptedIds = useMemo(() => {
    const ids = new Set(rows.filter((row) => row.adopted).map((row) => row.comp.id));
    for (const [id, next] of pendingAdopt) {
      if (next) ids.add(id);
      else ids.delete(id);
    }
    return ids;
  }, [rows, pendingAdopt]);

  const searchHits = searching ? searchQuery.data : undefined;
  // What the search found among what is drawn — the table's own comparables are drawn whatever
  // the search, and are not its results.
  const found = useMemo(() => {
    const hitIds = new Set((searchHits ?? []).map((c) => c.id));
    const hits = shown.filter((c) => hitIds.has(c.id));
    const onMap = hits.filter((c) => parseLatLng(c.latitude, c.longitude) != null).length;
    return { count: hits.length, onMap };
  }, [searchHits, shown]);
  const withoutPin = found.count - found.onMap;
  // Said only when there is something to say: a search's outcome, or a subject with no location.
  const status = searching
    ? searchQuery.isPending
      ? "جاري البحث في البنك…"
      : found.count === 0
        ? "لا نتائج مطابقة في البنك — جرّب رقماً مرجعياً أو حياً آخر."
        : `${found.onMap} مقارن على الخريطة من نتائج البحث` +
          (withoutPin > 0 ? ` (${withoutPin} بلا إحداثيات لا تظهر على الخريطة)` : "")
    : subjectPin
      ? ""
      : "لا موقع مسجّل للعقار — ابحث بالرقم المرجعي أو الحي، أو حرّك الخريطة إلى المنطقة المطلوبة.";

  const bankBrowse: ComparableBankBrowse = {
    toolbar: (
      <div className="mb-2">
        <div className="flex flex-wrap items-center gap-2 max-lg:[&>*]:basis-full">
          <Input
            type="search"
            value={q}
            placeholder="ابحث في البنك بالرقم المرجعي أو الحي"
            aria-label="بحث في بنك المقارنات"
            className="min-w-0 flex-1 max-lg:text-[16px]"
            onChange={(e) => setQ(e.target.value)}
          />
          {landOnly ? null : (
            <Select
              value={typeFilter}
              aria-label="نوع العقار"
              className="lg:w-[160px]"
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">كل الأنواع</option>
              {options.types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          )}
          <Select
            value={usageFilter}
            aria-label="الاستخدام"
            className="lg:w-[160px]"
            onChange={(e) => setUsageFilter(e.target.value)}
          >
            <option value="">كل الاستخدامات</option>
            {options.usages.map((usage) => (
              <option key={usage} value={usage}>
                {usage}
              </option>
            ))}
          </Select>
        </div>
        {status ? (
          <p role="status" className="mb-0 mt-1 text-[11.5px] text-text-3">
            {status}
          </p>
        ) : null}
      </div>
    ),
    comparables: shown,
    adoptedIds,
    listedIds: ownIds,
    // Frame the pins once per search; the nearby ones open on the subject, as the map does.
    fitPinsKey: searchHits && found.onMap > 0 ? `search:${search}` : undefined,
    autoOpenId: searchHits?.length === 1 ? searchHits[0].id : null,
    onCenterChange: (lat, lng) => setCenter({ lat, lng }),
    action: (comparable) => {
      const busy = pendingAdopt.has(comparable.id);
      if (!ownIds.has(comparable.id)) {
        return { label: "إضافة للمعاملة", busy, run: () => onAdd(comparable) };
      }
      const adopted = adoptedIds.has(comparable.id);
      return {
        label: adopted ? "إلغاء الاعتماد" : "اعتماد المقارن",
        busy,
        run: () => onToggleAdopt(comparable, !adopted),
      };
    },
  };

  return (
    <ComparablePropertyEntryFields
      draft={draft}
      disabled={saving}
      fieldErrors={fieldErrors}
      subjectPin={subjectPin}
      onChange={onChange}
      onLocationConfirmedChange={onLocationConfirmedChange}
      bankBrowse={bankBrowse}
    />
  );
}
