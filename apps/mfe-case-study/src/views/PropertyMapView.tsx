"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Input,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  cn,
  useToast,
} from "@platform/ui-kit";
import { usePoRecordsQuery } from "../query/case-study-queries";
import { poPropertyPath } from "../lib/po-routes";
import { findPropertyPathByDeed } from "../lib/prototype/map-open-property";
import {
  POINT_FAMILIES,
  SEED_COMPARABLES,
  SEED_PROPERTIES,
  WORKFLOW_STATUS,
  comparableCard,
  computeStats,
  countWithoutCoords,
  distinctValues,
  filterComparables,
  filterProperties,
  fmtMoney,
  groupForMap,
  nearbyOf,
  partitionProperties,
  propertyCard,
  type DatePreset,
  type FilterCriteria,
  type LayerKey,
  type MapComparableRecord,
  type MapPropertyRecord,
  type PropertyKindCat,
  type PropertyUsageCat,
} from "../lib/prototype/map-locations-logic";
import type {
  MapBasemap,
  MapViewCommand,
  PropertyMapMarker,
} from "../components/property-map/PropertyMapCanvas";

const PropertyMapCanvas = dynamic(
  () =>
    import("../components/property-map/PropertyMapCanvas").then(
      (m) => m.PropertyMapCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-[#e8eef3] text-sm text-[#6b7c8a]">
        جاري تحميل الخريطة…
      </div>
    ),
  },
);

/**
 * خريطة العقارات — المتبقي لاحقاً (ربط بيانات حية، لا تجميل):
 * - صورة العقار في البطاقة + تكبير (lightbox) من مرفق المعاملة.
 * - مصدر النقاط الحي بدل SEED_* عند ربط أوامر العمل وبنك المقارنات.
 * - فتح سجل المقارن على بطاقة محددة لا قائمة البنك.
 */

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "كل الفترات" },
  { value: "today", label: "اليوم" },
  { value: "7d", label: "آخر 7 أيام" },
  { value: "month", label: "هذا الشهر" },
  { value: "year", label: "هذه السنة" },
];

const LAYER_CHIPS: {
  key: LayerKey;
  label: string;
  color: string;
  diamond?: boolean;
}[] = [
  { key: "active", label: "العقارات النشطة", color: "#12284C" },
  { key: "archive", label: "العقارات المكتملة", color: "#8a8d96" },
  { key: "comparables", label: "أرشيف المقارنات", color: "#a4906f", diamond: true },
];

type Selection =
  | { kind: "property"; record: MapPropertyRecord; groupCount?: number }
  | { kind: "comparable"; record: MapComparableRecord }
  | { kind: "cluster"; ids: string[] }
  | null;

type LayerPanel = LayerKey | null;

function LayerPill({
  active,
  label,
  count,
  color,
  diamond,
  menuOpen,
  onClick,
  onMenu,
}: {
  active: boolean;
  label: string;
  count: number;
  color: string;
  diamond?: boolean;
  menuOpen: boolean;
  onClick: () => void;
  onMenu: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-bold transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-[#ddd8cc] bg-white text-text-2 hover:border-gold hover:text-heading",
      )}
    >
      <span
        className="inline-block size-[7px] shrink-0"
        style={{
          background: active ? "#c8b591" : color,
          borderRadius: diamond ? 2 : 99,
          transform: diamond ? "rotate(45deg)" : undefined,
        }}
      />
      {label}
      <span
        className={cn(
          "grid min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-bold",
          active ? "bg-gold/25 text-gold" : "bg-[#f1ece2] text-gold-d",
        )}
      >
        {count}
      </span>
      {active ? (
        <span
          role="presentation"
          title="اختيار عناصر بعينها"
          onClick={(e) => {
            e.stopPropagation();
            onMenu();
          }}
          className={cn(
            "grid size-[18px] place-items-center rounded-full",
            menuOpen ? "bg-white/15" : "hover:bg-white/15",
          )}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      ) : null}
    </button>
  );
}

function workflowTone(key: MapPropertyRecord["workflowStatus"]) {
  if (key === "issued") return "success" as const;
  if (key === "infeasible") return "danger" as const;
  if (key === "infeasible_candidate") return "warning" as const;
  return "info" as const;
}

function fmtShort(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

export function PropertyMapView() {
  const router = useRouter();
  const { showToast } = useToast();
  const { data: poRecords } = usePoRecordsQuery();
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    active: true,
    archive: false,
    comparables: false,
  });
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [kindCat, setKindCat] = useState<PropertyKindCat | "">("");
  const [usage, setUsage] = useState<PropertyUsageCat | "">("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [infeasOnly, setInfeasOnly] = useState(false);
  const [operationType, setOperationType] = useState("");
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [layerPanel, setLayerPanel] = useState<LayerPanel>(null);
  const [activeSel, setActiveSel] = useState<string[] | null>(null);
  const [archiveSel, setArchiveSel] = useState<string[] | null>(null);
  const [compSel, setCompSel] = useState<string[] | null>(null);
  const [basemap, setBasemap] = useState<MapBasemap>("satellite");
  const [command, setCommand] = useState<MapViewCommand | null>(null);
  const cmdSeq = useRef(0);
  const fitted = useRef(false);

  function sendCommand(
    next:
      | { type: "home" }
      | { type: "fit" }
      | { type: "fly"; coords: { lat: number; lng: number }; zoom?: number },
  ) {
    cmdSeq.current += 1;
    setCommand({ ...next, seq: cmdSeq.current });
  }

  const criteria = useMemo((): FilterCriteria => {
    return {
      query: query.trim() || undefined,
      city: city || undefined,
      kindCat: kindCat || undefined,
      usage: usage || undefined,
      datePreset,
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59`) : null,
      infeasOnly: infeasOnly || undefined,
      operationType: operationType || undefined,
      approvedOnly: approvedOnly || undefined,
    };
  }, [
    query,
    city,
    kindCat,
    usage,
    datePreset,
    dateFrom,
    dateTo,
    infeasOnly,
    operationType,
    approvedOnly,
  ]);

  const filteredProperties = useMemo(
    // لاحقاً: استبدل SEED_PROPERTIES بأوامر العمل الحية (إحداثيات العقار + حالة الإغلاق).
    () => filterProperties(SEED_PROPERTIES, criteria),
    [criteria],
  );
  const filteredComparables = useMemo(
    // لاحقاً: استبدل SEED_COMPARABLES ببنك المقارنات الحي.
    () => filterComparables(SEED_COMPARABLES, criteria),
    [criteria],
  );

  const partitioned = useMemo(
    () => partitionProperties(filteredProperties),
    [filteredProperties],
  );

  const activeGrouped = useMemo(
    () => groupForMap(partitioned.active),
    [partitioned.active],
  );
  const archiveGrouped = useMemo(
    () => groupForMap(partitioned.archive),
    [partitioned.archive],
  );

  const nodeKey = (point: { kind: string; groupId?: string; record?: MapPropertyRecord }) =>
    point.kind === "group" && point.groupId
      ? `g:${point.groupId}`
      : `p:${point.record!.id}`;

  const shownActive = useMemo(() => {
    if (!layers.active) return [];
    return activeSel
      ? activeGrouped.filter((p) => activeSel.includes(nodeKey(p)))
      : activeGrouped;
  }, [layers.active, activeGrouped, activeSel]);

  const shownArchive = useMemo(() => {
    if (!layers.archive) return [];
    return archiveSel
      ? archiveGrouped.filter((p) => archiveSel.includes(nodeKey(p)))
      : archiveGrouped;
  }, [layers.archive, archiveGrouped, archiveSel]);

  const grouped = useMemo(
    () => [...shownActive, ...shownArchive],
    [shownActive, shownArchive],
  );

  const comparableChoices = useMemo(
    () => filteredComparables.filter((c) => c.coords),
    [filteredComparables],
  );

  const shownComparables = useMemo(() => {
    if (!layers.comparables) return [];
    return compSel
      ? comparableChoices.filter((c) => compSel.includes(c.id))
      : comparableChoices;
  }, [layers.comparables, comparableChoices, compSel]);

  const shownPropertyRecords = useMemo(() => {
    const list: MapPropertyRecord[] = [];
    for (const p of grouped) {
      if (p.kind === "single") list.push(p.record);
      else list.push(...p.members);
    }
    return list;
  }, [grouped]);

  const stats = useMemo(
    () => computeStats(shownPropertyRecords, shownComparables),
    [shownPropertyRecords, shownComparables],
  );

  const markers = useMemo((): PropertyMapMarker[] => {
    const list: PropertyMapMarker[] = [];
    for (const point of grouped) {
      const coords = point.coords;
      if (!coords) continue;
      if (point.kind === "single") {
        const inf =
          point.record.workflowStatus === "infeasible" ||
          point.record.workflowStatus === "infeasible_candidate";
        list.push({
          id: `p:${point.record.id}`,
          coords,
          layer: point.active ? "active" : "archive",
          pulse: point.active,
          archived: !point.active,
          infeasible: inf,
          title: point.record.refNo,
          subtitle: `${point.record.city} · ${point.record.district} · ${point.record.propertyType}`,
        });
      } else {
        const head = point.members[0]!;
        const inf =
          head.workflowStatus === "infeasible" ||
          head.workflowStatus === "infeasible_candidate";
        list.push({
          id: `g:${point.groupId}`,
          coords,
          layer: point.active ? "active" : "archive",
          pulse: point.active,
          archived: !point.active,
          infeasible: inf,
          count: point.deedCount,
          title: `${point.deedCount} صكوك — ${head.city}`,
          subtitle: `${head.city} · ${head.district} · ${head.propertyType}`,
        });
      }
    }
    for (const c of shownComparables) {
      if (!c.coords) continue;
      list.push({
        id: `c:${c.id}`,
        coords: c.coords,
        layer: "comparables",
        approved: c.approved,
        title: `${c.comparableType} — ${c.operationType}`,
        subtitle: `${c.city} · ${c.price != null ? c.price.toLocaleString("en-US") + " ريال" : ""}`,
      });
    }
    return list;
  }, [grouped, shownComparables]);

  const cities = distinctValues([...SEED_PROPERTIES, ...SEED_COMPARABLES], "city");
  const yearOpts = useMemo(() => {
    const years = new Set<number>();
    for (const r of SEED_PROPERTIES) {
      const d = r.valuationDate || r.openedDate;
      if (d) years.add(new Date(d).getFullYear());
    }
    for (const c of SEED_COMPARABLES) {
      if (c.operationDate) years.add(new Date(c.operationDate).getFullYear());
    }
    return [...years].sort((a, b) => b - a);
  }, []);

  const selectedId =
    selection?.kind === "property"
      ? selection.record.propertyGroupId
        ? `g:${selection.record.propertyGroupId}`
        : `p:${selection.record.id}`
      : selection?.kind === "comparable"
        ? `c:${selection.record.id}`
        : selection?.kind === "cluster"
          ? selection.ids[0] ?? null
          : null;

  useEffect(() => {
    if (fitted.current || markers.length === 0) return;
    fitted.current = true;
    sendCommand({ type: "fit" });
  }, [markers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelection(null);
      setDateOpen(false);
      setLayerPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleLayer(key: LayerKey) {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
    setLayerPanel(null);
  }

  function flyTo(coords: { lat: number; lng: number } | null | undefined) {
    if (coords) sendCommand({ type: "fly", coords });
  }

  function handleSelect(id: string) {
    if (id.startsWith("p:")) {
      const rec = SEED_PROPERTIES.find((r) => r.id === id.slice(2));
      if (rec) {
        setSelection({ kind: "property", record: rec });
        flyTo(rec.coords);
      }
      return;
    }
    if (id.startsWith("c:")) {
      const rec = SEED_COMPARABLES.find((r) => r.id === id.slice(2));
      if (rec) {
        setSelection({ kind: "comparable", record: rec });
        flyTo(rec.coords);
      }
      return;
    }
    if (id.startsWith("g:")) {
      const group = grouped.find((p) => p.kind === "group" && `g:${p.groupId}` === id);
      if (group?.kind === "group") {
        setSelection({
          kind: "property",
          record: group.members[0]!,
          groupCount: group.deedCount,
        });
        flyTo(group.coords);
      }
    }
  }

  /** لاحقاً: بعد ربط المصدر الحي تكون poNumber/propertyId على السجل نفسه فلا نحتاج البحث بالصك. */
  function openProperty(record: MapPropertyRecord) {
    if (record.poNumber && record.propertyId) {
      router.push(poPropertyPath(record.poNumber, record.propertyId));
      return;
    }
    const live = findPropertyPathByDeed(poRecords, record.deedNo);
    if (live) {
      router.push(live);
      return;
    }
    showToast("هذه نقطة معاينة — افتح المعاملة من أوامر العمل بعد ربط المصدر الحي.", "info");
  }

  /** لاحقاً: افتح بطاقة المقارن المحددة بدل قائمة بنك المقارنات. */
  function openComparable(record: MapComparableRecord) {
    router.push("/comparable-properties");
    showToast(`يُفتح سجل المقارن ${record.refNo}`, "info");
  }

  function applyDatePreset(preset: DatePreset, label: string) {
    setDatePreset(preset);
    setDateFrom("");
    setDateTo("");
    setDateLabel(preset === "all" ? "" : label);
    setDateOpen(false);
  }

  function resetFilters() {
    setQuery("");
    setCity("");
    setKindCat("");
    setUsage("");
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
    setDateLabel("");
    setDateOpen(false);
    setInfeasOnly(false);
  }

  const hasFilters = !!(
    query.trim() ||
    city ||
    kindCat ||
    usage ||
    dateLabel ||
    dateFrom ||
    dateTo ||
    (datePreset && datePreset !== "all") ||
    infeasOnly
  );

  const noCoordsParts: string[] = [];
  if (layers.active) noCoordsParts.push(`نشط ${partitioned.activeNoCoords}`);
  if (layers.archive) noCoordsParts.push(`أرشيف ${partitioned.archiveNoCoords}`);
  if (layers.comparables) noCoordsParts.push(`مقارنات ${countWithoutCoords(filteredComparables)}`);

  const nearby =
    selection?.kind === "property" && selection.record.coords
      ? nearbyOf(selection.record.coords, SEED_COMPARABLES, 2, null).slice(0, 5)
      : [];

  const pickerNodes =
    layerPanel === "active"
      ? activeGrouped
      : layerPanel === "archive"
        ? archiveGrouped
        : [];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-bg" dir="rtl">
      <div className="relative z-[1200] flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2">
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-[#faf8f3] p-[3px]">
          {LAYER_CHIPS.map((chip) => (
            <LayerPill
              key={chip.key}
              active={layers[chip.key]}
              label={chip.label}
              count={
                chip.key === "active"
                  ? partitioned.active.length
                  : chip.key === "archive"
                    ? partitioned.archive.length
                    : filteredComparables.filter((c) => c.coords).length
              }
              color={chip.color}
              diamond={chip.diamond}
              menuOpen={layerPanel === chip.key}
              onClick={() => toggleLayer(chip.key)}
              onMenu={() => {
                setLayers((prev) => ({ ...prev, [chip.key]: true }));
                setLayerPanel((cur) => (cur === chip.key ? null : chip.key));
              }}
            />
          ))}
          <button
            type="button"
            title="إظهار التعذرات فقط (مرشح تعذر + متعذر)"
            onClick={() => {
              setInfeasOnly((v) => {
                const next = !v;
                if (next) setLayers((prev) => ({ ...prev, active: true, archive: true }));
                return next;
              });
            }}
            className={cn(
              "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-bold",
              infeasOnly
                ? "border-[#d9694f] bg-[#d9694f] text-white"
                : "border-[#f0c9bf] bg-white text-[#d9694f]",
            )}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            التعذرات
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <OperationalToolbarSearch
            type="search"
            placeholder="بحث: صك، مرجع، حي، عميل..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="بحث"
            className="max-w-[200px] max-lg:min-w-0 max-lg:flex-1"
          />
          <OperationalToolbarSelect
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="المدينة"
          >
            <option value="">كل المدن</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </OperationalToolbarSelect>
          <OperationalToolbarSelect
            value={kindCat}
            onChange={(e) => setKindCat(e.target.value as PropertyKindCat | "")}
            aria-label="فئة العقار"
          >
            <option value="">كل الأنواع</option>
            <option value="أرض">أراضٍ</option>
            <option value="مبنى">مبانٍ</option>
          </OperationalToolbarSelect>
          <OperationalToolbarSelect
            value={usage}
            onChange={(e) => setUsage(e.target.value as PropertyUsageCat | "")}
            aria-label="الاستخدام"
          >
            <option value="">كل الاستخدامات</option>
            <option value="سكني">سكني</option>
            <option value="تجاري">تجاري</option>
            <option value="زراعي">زراعي</option>
            <option value="خدمات">خدمات</option>
            <option value="أخرى">أخرى</option>
          </OperationalToolbarSelect>
          <div className="relative">
            <button
              type="button"
              onClick={() => setDateOpen((v) => !v)}
              className={cn(
                "inline-flex h-[30px] shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-[12.5px] font-semibold",
                dateLabel
                  ? "border-gold bg-[#f1ece2] font-bold text-gold-d"
                  : "border-[#ddd8cc] bg-white text-text-2 hover:border-gold hover:text-gold-d",
              )}
              aria-label="فترة زمنية"
              title={dateLabel || "فلترة التاريخ"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {dateLabel ? <span>{dateLabel}</span> : null}
            </button>
            {dateOpen ? (
              <div className="absolute end-0 top-[calc(100%+6px)] z-[1100] w-[250px] rounded-[12px] border border-border bg-surface p-2 shadow-[var(--shadow-lg)]">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => applyDatePreset(p.value, p.label)}
                    className={cn(
                      "w-full rounded-lg px-2.5 py-2 text-start text-[12.5px]",
                      (p.value === "all" ? !dateLabel : dateLabel === p.label)
                        ? "bg-[#f1ece2] font-bold text-gold-d"
                        : "font-medium text-text hover:bg-[#faf6ee]",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <div className="my-1.5 h-px bg-border" />
                <div className="px-2 pb-1.5">
                  <div className="mb-1.5 text-[11.5px] font-bold text-gold-d">اختر سنة</div>
                  <select
                    className="mb-2 w-full rounded-lg border border-[#ddd8cc] bg-white px-2 py-1.5 text-[12px] text-text"
                    value={dateLabel.startsWith("سنة ") ? dateLabel.slice(4) : ""}
                    onChange={(e) => {
                      const y = Number(e.target.value);
                      if (!y) return;
                      setDatePreset("all");
                      setDateFrom(`${y}-01-01`);
                      setDateTo(`${y}-12-31`);
                      setDateLabel(`سنة ${y}`);
                      setDateOpen(false);
                    }}
                    aria-label="سنة"
                  >
                    <option value="">—</option>
                    {yearOpts.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <div className="mb-1.5 text-[11.5px] font-bold text-gold-d">بين تاريخين</div>
                  <div className="flex flex-col gap-1.5">
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    <div className="flex gap-1.5">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          if (!dateFrom && !dateTo) return;
                          setDatePreset("all");
                          const from = dateFrom ? new Date(dateFrom) : null;
                          const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
                          setDateLabel(`${from ? fmtShort(from) : "…"} — ${to ? fmtShort(to) : "…"}`);
                          setDateOpen(false);
                        }}
                      >
                        تطبيق
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => applyDatePreset("all", "")}
                      >
                        مسح الفلتر
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-[30px] items-center gap-1 rounded-lg px-2.5 text-[11.5px] font-bold text-[#d9694f] hover:bg-[#fdf1ee]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              مسح الفلاتر
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <PropertyMapCanvas
          markers={markers}
          selectedId={selectedId}
          basemap={basemap}
          command={command}
          onSelect={handleSelect}
          onBackgroundClick={() => {
            setSelection(null);
            setDateOpen(false);
            setLayerPanel(null);
          }}
          onBasemapChange={setBasemap}
          onRecenter={() => sendCommand({ type: "fit" })}
        />

        {layerPanel === "comparables" ? (
          <LayerSidePanel
            title="فلترة المقارنات"
            wide
            onHide={() => {
              setLayers((p) => ({ ...p, comparables: false }));
              setLayerPanel(null);
            }}
            onClose={() => setLayerPanel(null)}
          >
            <div className="flex flex-col gap-3 border-b border-border p-3.5">
              <div>
                <div className="mb-1.5 text-[11.5px] font-bold text-gold-d">نوع المقارن</div>
                <select
                  className="w-full rounded-lg border border-[#ddd8cc] bg-white px-2.5 py-1.5 text-[12.5px] text-text"
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  aria-label="نوع العملية"
                >
                  <option value="">عرض وتنفيذ</option>
                  <option value="عرض">عرض</option>
                  <option value="تنفيذ">تنفيذ</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-text">
                <input
                  type="checkbox"
                  checked={approvedOnly}
                  onChange={(e) => setApprovedOnly(e.target.checked)}
                />
                مقارن موثوق فقط
              </label>
            </div>
            <CompPickerList
              items={comparableChoices}
              selectedKeys={compSel}
              onSelectedKeys={setCompSel}
              onZoom={(item) => {
                setSelection({ kind: "comparable", record: item });
                flyTo(item.coords);
              }}
            />
          </LayerSidePanel>
        ) : null}

        {layerPanel === "active" || layerPanel === "archive" ? (
          <LayerSidePanel
            title={layerPanel === "active" ? "العقارات النشطة" : "العقارات المكتملة"}
            wide
            onHide={() => {
              setLayers((p) => ({ ...p, [layerPanel]: false }));
              setLayerPanel(null);
            }}
            onClose={() => setLayerPanel(null)}
          >
            <PickerList
              nodes={pickerNodes}
              selectedKeys={layerPanel === "active" ? activeSel : archiveSel}
              onSelectedKeys={layerPanel === "active" ? setActiveSel : setArchiveSel}
              onZoom={(point) => {
                if (point.kind === "group") {
                  setSelection({
                    kind: "property",
                    record: point.members[0]!,
                    groupCount: point.deedCount,
                  });
                  flyTo(point.coords);
                } else {
                  setSelection({ kind: "property", record: point.record });
                  flyTo(point.record.coords);
                }
              }}
            />
          </LayerSidePanel>
        ) : null}

        {selection?.kind === "property" ? (
          <DetailCard
            familyLabel={POINT_FAMILIES.property}
            title={propertyCard(selection.record).title}
            isProperty
            tags={
              <>
                <Badge tone={selection.record.closedDate ? "default" : "primary"}>
                  {selection.record.closedDate ? "مغلق (أرشيف)" : "نشط — لم يُغلق"}
                </Badge>
                <Badge tone={workflowTone(selection.record.workflowStatus)}>
                  {WORKFLOW_STATUS[selection.record.workflowStatus].label}
                </Badge>
                {propertyCard(selection.record).expired ? (
                  <Badge tone="danger">تجاوز صلاحية الـ90 يومًا</Badge>
                ) : null}
                {selection.groupCount ? (
                  <Badge tone="warning">عقار مجمع — {selection.groupCount} صكوك</Badge>
                ) : null}
              </>
            }
            rows={propertyCard(selection.record).rows}
            nearby={nearby}
            onNearby={(item) => {
              setLayers((p) => ({ ...p, comparables: true }));
              setSelection({ kind: "comparable", record: item });
              flyTo(item.coords);
            }}
            onClose={() => setSelection(null)}
            actionLabel="فتح المعاملة"
            onAction={() => openProperty(selection.record)}
          />
        ) : null}

        {selection?.kind === "comparable" ? (
          <DetailCard
            familyLabel={POINT_FAMILIES.comparable}
            title={comparableCard(selection.record).title}
            tags={
              <Badge tone={selection.record.approved ? "success" : "default"}>
                {selection.record.approved ? "معتمد" : "غير معتمد"}
              </Badge>
            }
            rows={comparableCard(selection.record).rows}
            nearby={[]}
            onClose={() => setSelection(null)}
            actionLabel="فتح سجل المقارن"
            onAction={() => openComparable(selection.record)}
          />
        ) : null}

        {selection?.kind === "cluster" ? (
          <div className="absolute end-3.5 top-3.5 z-[1100] max-h-[70%] w-[280px] overflow-y-auto rounded-[12px] border border-border bg-surface shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="text-[12.5px] font-bold text-heading">
                {selection.ids.length} مواقع في هذه النقطة
              </div>
              <button type="button" className="text-text-3" onClick={() => setSelection(null)} aria-label="إغلاق">
                ×
              </button>
            </div>
            <ul className="p-1.5">
              {selection.ids.map((id) => {
                const rec =
                  id.startsWith("c:")
                    ? SEED_COMPARABLES.find((r) => `c:${r.id}` === id)
                    : SEED_PROPERTIES.find((r) => `p:${r.id}` === id);
                if (!rec) return null;
                const isComp = "comparableType" in rec;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-start hover:bg-surface-2"
                      onClick={() => handleSelect(id)}
                    >
                      <span
                        className="mt-1 size-2 shrink-0"
                        style={{
                          background: isComp ? "#a4906f" : "#12284C",
                          borderRadius: isComp ? 2 : 99,
                          transform: isComp ? "rotate(45deg)" : undefined,
                        }}
                      />
                      <span>
                        <span className="block text-[12.5px] font-semibold text-heading">
                          {isComp ? rec.comparableType : rec.refNo}
                        </span>
                        <span className="block text-[11px] text-text-3">
                          {rec.district}، {rec.city}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-3.5 bottom-3.5 z-[400] flex flex-wrap items-center gap-3.5 rounded-[10px] border border-border bg-white/95 px-3.5 py-2 text-[12px] text-text-2 shadow-[var(--shadow)]">
          <LegendDot color="#12284C" label="نشط" ring />
          <LegendDot color="#8a8d96" label="أرشيف" />
          <LegendDot color="#a4906f" label="مقارن" diamond />
          <span className="inline-flex items-center gap-1.5">
            <span className="grid size-[13px] place-items-center rounded-full border-[1.5px] border-white bg-[#d9694f] text-[9px] font-extrabold leading-none text-white">
              !
            </span>
            تعذر
          </span>
          <span className="h-4 w-px bg-[#ddd8cc]" />
          <span>
            {stats.total
              ? `المعروض: ${stats.total} عقارًا (${stats.activeCount} نشط · ${stats.archivedCount} أرشيف)`
              : "لا نتائج ضمن الفلاتر الحالية"}
            {shownComparables.length ? ` · ${shownComparables.length} مقارنًا` : ""}
            {stats.expiredCount ? ` · ${stats.expiredCount} منتهي الصلاحية` : ""}
            {stats.issuedValueSum ? ` · ${fmtMoney(stats.issuedValueSum)}` : ""}
          </span>
          <span className="h-4 w-px bg-[#ddd8cc]" />
          <span className="font-medium text-[#d9694f]">
            بلا إحداثيات: {noCoordsParts.length ? noCoordsParts.join(" · ") : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function LayerSidePanel({
  title,
  wide,
  onHide,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  onHide: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute start-16 top-2.5 z-[960] flex max-h-[380px] flex-col overflow-hidden rounded-[12px] border border-border bg-surface shadow-[var(--shadow-lg)]",
        wide ? "w-[320px]" : "w-[250px]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-[#faf8f3] px-3.5 py-2.5">
        <span className="text-[13px] font-extrabold text-heading">{title}</span>
        <button
          type="button"
          onClick={onHide}
          className="ms-auto rounded-lg border border-[#ddd8cc] bg-white px-2.5 py-1 text-[11.5px] font-bold text-text-2 hover:border-[#d9694f] hover:text-[#d9694f]"
        >
          إخفاء الطبقة
        </button>
        <button type="button" onClick={onClose} className="text-[16px] leading-none text-text-3" aria-label="إغلاق">
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}

function PickerList({
  nodes,
  selectedKeys,
  onSelectedKeys,
  onZoom,
}: {
  nodes: ReturnType<typeof groupForMap>;
  selectedKeys: string[] | null;
  onSelectedKeys: (next: string[] | null) => void;
  onZoom: (point: ReturnType<typeof groupForMap>[number]) => void;
}) {
  const allKeys = nodes.map((n) =>
    n.kind === "group" ? `g:${n.groupId}` : `p:${n.record.id}`,
  );
  const allChecked = !selectedKeys;
  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 border-b border-border px-3.5 py-2.5 text-[13px] font-bold text-gold-d">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={() => onSelectedKeys(allChecked ? [] : null)}
        />
        اختيار الكل ({nodes.length})
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {nodes.map((n) => {
          const key = n.kind === "group" ? `g:${n.groupId}` : `p:${n.record.id}`;
          const head = n.kind === "group" ? n.members[0]! : n.record;
          const checked = !selectedKeys || selectedKeys.includes(key);
          const label =
            n.kind === "group"
              ? `${head.refNo} — ${head.district}، ${head.city} (مجمع ${n.deedCount})`
              : `${head.refNo} — ${head.district}، ${head.city}`;
          return (
            <div key={key} className="flex items-center gap-2 px-3.5 py-1.5 hover:bg-[#faf6ee]">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const cur = selectedKeys ?? allKeys;
                  let next = checked ? cur.filter((x) => x !== key) : [...cur, key];
                  if (next.length === allKeys.length) onSelectedKeys(null);
                  else onSelectedKeys(next);
                }}
              />
              <button
                type="button"
                className="text-start text-[12.5px] font-medium text-text hover:text-gold-d"
                onClick={() => onZoom(n)}
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CompPickerList({
  items,
  selectedKeys,
  onSelectedKeys,
  onZoom,
}: {
  items: MapComparableRecord[];
  selectedKeys: string[] | null;
  onSelectedKeys: (next: string[] | null) => void;
  onZoom: (item: MapComparableRecord) => void;
}) {
  const allKeys = items.map((x) => x.id);
  const allChecked = !selectedKeys;
  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 border-b border-border px-3.5 py-2.5 text-[13px] font-bold text-gold-d">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={() => onSelectedKeys(allChecked ? [] : null)}
        />
        اختيار الكل ({items.length})
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {items.map((item) => {
          const checked = !selectedKeys || selectedKeys.includes(item.id);
          return (
            <div key={item.id} className="flex items-center gap-2 px-3.5 py-1.5 hover:bg-[#faf6ee]">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const cur = selectedKeys ?? allKeys;
                  const next = checked
                    ? cur.filter((x) => x !== item.id)
                    : [...cur, item.id];
                  if (next.length === allKeys.length) onSelectedKeys(null);
                  else onSelectedKeys(next);
                }}
              />
              <button
                type="button"
                className="text-start text-[12.5px] font-medium text-text hover:text-gold-d"
                onClick={() => onZoom(item)}
              >
                {item.refNo} — {item.comparableType}، {item.district}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function LegendDot({
  color,
  label,
  diamond,
  ring,
}: {
  color: string;
  label: string;
  diamond?: boolean;
  ring?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block border-2 border-white"
        style={{
          width: diamond ? 10 : ring ? 12 : 11,
          height: diamond ? 10 : ring ? 12 : 11,
          background: color,
          borderRadius: diamond ? 2 : 99,
          transform: diamond ? "rotate(45deg)" : undefined,
          boxShadow: ring ? "0 0 0 2px rgba(164,144,111,.6)" : undefined,
        }}
      />
      {label}
    </span>
  );
}

function DetailCard({
  familyLabel,
  title,
  tags,
  rows,
  nearby,
  isProperty,
  onNearby,
  onClose,
  actionLabel,
  onAction,
}: {
  familyLabel: string;
  title: string;
  tags: ReactNode;
  rows: [string, string][];
  nearby: { item: MapComparableRecord; distanceKm: number }[];
  isProperty?: boolean;
  onNearby?: (item: MapComparableRecord) => void;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <aside className="absolute bottom-3.5 end-3.5 top-3.5 z-[950] flex w-[330px] max-w-[calc(100%-1.75rem)] flex-col overflow-hidden rounded-[12px] border border-border bg-surface shadow-[var(--shadow-lg)]">
      <div className="border-b border-border bg-[#faf8f3] px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-md bg-[#f1ece2] px-2 py-0.5 text-[11px] font-bold text-gold-d">
            {familyLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[18px] leading-none text-text-3 hover:text-heading"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          {isProperty ? (
            /* لاحقاً: اعرض صورة المعاملة (photoUrl / أول مرفق) مع تكبير lightbox؛ إن لم توجد صورة أظهر هذا المكان وأبلغ «لا توجد صورة مرفقة». */
            <div className="grid size-[84px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#f1ece2] text-[#c2b49a] shadow-[0_4px_12px_-6px_rgba(18,40,76,.45)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <circle cx="12" cy="12.5" r="3.2" />
              </svg>
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="m-0 text-[15px] font-extrabold leading-snug text-heading">{title}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{tags}</div>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-1.5">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between gap-3 border-b border-[#f3f0e9] py-2 text-[12.5px]"
          >
            <span className="shrink-0 text-text-3">{k}</span>
            <span className="text-start font-bold text-text">{v || "-"}</span>
          </div>
        ))}
        {nearby.length > 0 ? (
          <div className="mb-1 mt-2.5">
            <div className="mb-1.5 text-[11.5px] font-bold text-gold-d">مقارنات قريبة (≤ 2 كم)</div>
            <div className="flex flex-col gap-1.5">
              {nearby.map(({ item, distanceKm }) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNearby?.(item)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-[#faf8f3] px-2.5 py-2 text-start hover:border-gold hover:bg-[#f1ece2]"
                >
                  <span className="flex items-center gap-2 text-[12px] font-bold text-heading">
                    <span
                      className="size-2 shrink-0 rounded-[2px] bg-[#a4906f]"
                      style={{ transform: "rotate(45deg)" }}
                    />
                    {item.comparableType} — {item.district}
                  </span>
                  <span className="shrink-0 text-[11px] text-gold-d">
                    {distanceKm.toFixed(1)} كم · {item.operationType} · {fmtMoney(item.price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {actionLabel && onAction ? (
        <div className="border-t border-border p-3 px-4">
          <Button variant="primary" className="w-full" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
