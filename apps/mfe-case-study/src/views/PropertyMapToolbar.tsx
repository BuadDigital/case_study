"use client";

import {
  Button,
  Input,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  cn,
  opsFloatPanel,
} from "@platform/ui-kit";

import type {
  PropertyKindCat,
  PropertyUsageCat,
} from "../lib/app-data/map-locations-logic";
import {
  DATE_PRESETS,
  LAYER_CHIPS,
  fmtShort,
} from "../lib/app-data/property-map-view-state";
import { LayerPill } from "../components/property-map/PropertyMapPanels";
import {
  LAND_LAYER_CHIPS,
  parcelTilesBase,
  type LandLayerKey,
  type LandLayers,
} from "../lib/app-data/parcel-layer-logic";

/** The land layers' tile server — none set, no land chips. */
const PARCEL_TILES = parcelTilesBase();
import type { PropertyMapWorkflow } from "./usePropertyMapWorkflow";

/**
 * Map toolbar — layer chips (incl. «التعذّرات»), the text/city/kind/usage
 * selects and the date popover. Every value and setter comes from the map
 * workflow.
 */
export function PropertyMapToolbar({
  workflow,
}: {
  workflow: PropertyMapWorkflow;
}) {
  const {
    layers,
    layerPanel,
    toggleLayer,
    landLayers,
    toggleLandLayer,
    landOpen,
    setLandOpen,
    openLayerPanel,
    partitioned,
    filteredComparables,
    filteredReports,
    query,
    setQuery,
    city,
    setCity,
    cities,
    kindCat,
    setKindCat,
    usage,
    setUsage,
    dateOpen,
    setDateOpen,
    dateLabel,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    yearOpts,
    applyDatePreset,
    applyDateYear,
    applyDateRange,
    hasFilters,
    resetFilters,
  } = workflow;

  return (
    <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2">
      <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-surface-2 p-[3px]">
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
                  : chip.key === "failures"
                    ? partitioned.failures.length
                    : chip.key === "reports"
                      ? filteredReports.length
                      : filteredComparables.filter((c) => c.coords).length
            }
            color={chip.color}
            diamond={chip.diamond}
            hollow={chip.hollow}
            alert={chip.alert}
            menuOpen={layerPanel === chip.key}
            onClick={() => toggleLayer(chip.key)}
            onMenu={chip.noMenu ? undefined : () => openLayerPanel(chip.key)}
          />
        ))}
        {PARCEL_TILES ? (
          <LandLayersMenu
            layers={landLayers}
            open={landOpen}
            onOpenChange={setLandOpen}
            onToggle={toggleLandLayer}
          />
        ) : null}
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
                ? "border-gold bg-gold-soft font-bold text-gold-d"
                : "border-border-md bg-surface text-text-2 hover:border-gold hover:text-gold-d",
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
            <div className={cn(opsFloatPanel, "absolute end-0 top-[calc(100%+6px)] z-[1100] w-[250px] p-2")}>
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => applyDatePreset(p.value, p.label)}
                  className={cn(
                    "w-full rounded-lg px-2.5 py-2 text-start text-[12.5px]",
                    (p.value === "all" ? !dateLabel : dateLabel === p.label)
                      ? "bg-gold-soft font-bold text-gold-d"
                      : "font-medium text-text hover:bg-row-hover",
                  )}
                >
                  {p.label}
                </button>
              ))}
              <div className="my-1.5 h-px bg-border" />
              <div className="px-2 pb-1.5">
                <div className="mb-1.5 text-[11.5px] font-bold text-gold-d">اختر سنة</div>
                <select
                  className="mb-2 w-full rounded-lg border border-border-md bg-surface px-2 py-1.5 text-[12px] text-text"
                  value={dateLabel.startsWith("سنة ") ? dateLabel.slice(4) : ""}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    if (y) applyDateYear(y);
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
                        const from = dateFrom ? new Date(dateFrom) : null;
                        const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
                        applyDateRange(
                          `${from ? fmtShort(from) : "…"} — ${to ? fmtShort(to) : "…"}`,
                        );
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
  );
}

/**
 * «الأراضي» — one pill among the layers, its count the land layers switched on, opening the list
 * of the three (Omar 2026-11-16: three chips of their own wrapped the bar onto a second row).
 * Each is MOMRAH's data, apart from the properties' pins; the list says from which zoom it shows.
 */
function LandLayersMenu({
  layers,
  open,
  onOpenChange,
  onToggle,
}: {
  layers: LandLayers;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (key: LandLayerKey) => void;
}) {
  const on = LAND_LAYER_CHIPS.filter((c) => layers[c.key]).length;
  return (
    <div className="relative">
      <LayerPill
        active={on > 0}
        label="الأراضي"
        count={on}
        color="#d4880f"
        diamond
        menuOpen={open}
        onClick={() => onOpenChange(!open)}
        onMenu={() => onOpenChange(!open)}
      />
      {open ? (
        <div
          className={cn(opsFloatPanel, "absolute start-0 top-[calc(100%+6px)] z-[1100] w-[248px] p-2")}
          role="group"
          aria-label="طبقات الأراضي"
        >
          <div className="px-2 pb-1.5 pt-1">
            <div className="text-[12.5px] font-bold text-heading">طبقات الأراضي</div>
            <div className="text-[11px] text-text-3">من بيانات وزارة البلديات — مستقلة عن العقارات</div>
          </div>
          {LAND_LAYER_CHIPS.map((chip) => (
            <label
              key={chip.key}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[12.5px]",
                layers[chip.key] ? "bg-gold-soft" : "hover:bg-row-hover",
              )}
            >
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-[var(--ink)]"
                checked={layers[chip.key]}
                onChange={() => onToggle(chip.key)}
              />
              <span
                className="inline-block h-[3px] w-4 shrink-0 rounded-full"
                style={{ background: chip.color }}
                aria-hidden
              />
              <span className={cn("flex-1", layers[chip.key] ? "font-bold text-heading" : "font-medium text-text")}>
                {chip.label}
              </span>
              <span className="text-[10.5px] text-text-3">من تقريب {chip.minZoom}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
