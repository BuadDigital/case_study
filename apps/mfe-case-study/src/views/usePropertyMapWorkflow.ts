"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@platform/ui-kit";
import { useEscapeKey } from "@platform/app-shared/hooks/use-escape-key";
import { poPropertyPath } from "@platform/app-shared/domain/po-routes";
import { listComparableProperties } from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";

import { usePoRecordsQuery } from "../query/case-study-queries";
import { findPropertyPathByDeed } from "../lib/app-data/map-open-property";
import {
  mapComparableDtosToMapRecords,
  mapPoRecordsToMapProperties,
} from "../lib/app-data/map-live-records";
import {
  computeStats,
  distinctValues,
  filterComparables,
  filterProperties,
  groupForMap,
  nearbyOf,
  partitionProperties,
  type DatePreset,
  type LayerKey,
  type MapComparableRecord,
  type MapPropertyRecord,
  type PropertyKindCat,
  type PropertyUsageCat,
} from "../lib/app-data/map-locations-logic";
import type { MapViewCommand } from "../components/property-map/PropertyMapCanvas";
import {
  buildMapMarkers,
  hasActiveMapFilters,
  mapFilterCriteria,
  mapYearOptions,
  nodeKey,
  noCoordsSummary,
  recordsOfGrouped,
  selectedMarkerId,
  type PropertyMapBasemap,
  type PropertyMapLayerPanel,
  type PropertyMapSelection,
} from "../lib/app-data/property-map-view-state";

/**
 * Owns the property map screen: the two live sources, the layer/filter/
 * selection state, every derived list the canvas and panels read, and the
 * navigation out to a transaction or comparable record.
 */
export function usePropertyMapWorkflow() {
  const router = useRouter();
  const { showToast } = useToast();
  const { data: poRecords } = usePoRecordsQuery();
  const liveProperties = useMemo(
    () => mapPoRecordsToMapProperties(poRecords),
    [poRecords],
  );
  const { data: liveComparables = [] } = useQuery({
    queryKey: ["property-map", "comparables"],
    queryFn: async () => {
      const config = prototypeModulesApiConfig();
      if (!config) return [] as MapComparableRecord[];
      const res = await listComparableProperties(config, { take: 200 });
      if (!res.ok) return [] as MapComparableRecord[];
      return mapComparableDtosToMapRecords(res.data);
    },
    staleTime: 60_000,
  });

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
  const [selection, setSelection] = useState<PropertyMapSelection>(null);
  const [layerPanel, setLayerPanel] = useState<PropertyMapLayerPanel>(null);
  const [activeSel, setActiveSel] = useState<string[] | null>(null);
  const [archiveSel, setArchiveSel] = useState<string[] | null>(null);
  const [compSel, setCompSel] = useState<string[] | null>(null);
  const [basemap, setBasemap] = useState<PropertyMapBasemap>("satellite");
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

  const criteria = useMemo(
    () =>
      mapFilterCriteria({
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
      }),
    [
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
    ],
  );

  const filteredProperties = useMemo(
    () => filterProperties(liveProperties, criteria),
    [criteria, liveProperties],
  );
  const filteredComparables = useMemo(
    () => filterComparables(liveComparables, criteria),
    [criteria, liveComparables],
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

  const shownPropertyRecords = useMemo(() => recordsOfGrouped(grouped), [grouped]);
  const stats = useMemo(
    () => computeStats(shownPropertyRecords, shownComparables),
    [shownPropertyRecords, shownComparables],
  );
  const markers = useMemo(
    () => buildMapMarkers(grouped, shownComparables),
    [grouped, shownComparables],
  );

  const cities = distinctValues([...liveProperties, ...liveComparables], "city");
  const yearOpts = useMemo(
    () => mapYearOptions(liveProperties, liveComparables),
    [liveProperties, liveComparables],
  );

  const recordByPrefixedId = useMemo(() => {
    const map = new Map<string, MapPropertyRecord | MapComparableRecord>();
    for (const r of liveProperties) map.set(`p:${r.id}`, r);
    for (const c of liveComparables) map.set(`c:${c.id}`, c);
    return map;
  }, [liveProperties, liveComparables]);

  const selectedId = selectedMarkerId(selection);

  useEffect(() => {
    if (fitted.current || markers.length === 0) return;
    fitted.current = true;
    sendCommand({ type: "fit" });
  }, [markers]);

  useEscapeKey(true, () => {
    setSelection(null);
    setDateOpen(false);
    setLayerPanel(null);
  });

  function toggleLayer(key: LayerKey) {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
    setLayerPanel(null);
  }

  function openLayerPanel(key: LayerKey) {
    setLayers((prev) => ({ ...prev, [key]: true }));
    setLayerPanel((cur) => (cur === key ? null : key));
  }

  function hideLayer(key: LayerKey) {
    setLayers((prev) => ({ ...prev, [key]: false }));
    setLayerPanel(null);
  }

  function flyTo(coords: { lat: number; lng: number } | null | undefined) {
    if (coords) sendCommand({ type: "fly", coords });
  }

  function handleSelect(id: string) {
    if (id.startsWith("p:")) {
      const rec = liveProperties.find((r) => r.id === id.slice(2));
      if (rec) {
        setSelection({ kind: "property", record: rec });
        flyTo(rec.coords);
      }
      return;
    }
    if (id.startsWith("c:")) {
      const rec = liveComparables.find((r) => r.id === id.slice(2));
      if (rec) {
        setSelection({ kind: "comparable", record: rec });
        flyTo(rec.coords);
      }
      return;
    }
    if (id.startsWith("g:")) {
      const group = grouped.find(
        (p) => p.kind === "group" && `g:${p.groupId}` === id,
      );
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

  /** Later: after wiring the live source, poNumber/propertyId live on the record so deed search is unnecessary. */
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
    showToast("لا توجد معاملة مرتبطة بهذه النقطة بعد.", "info");
  }

  /** Later: open the specific comparable card instead of the comparables bank list. */
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

  /** Year picker — an explicit from/to range with the preset cleared. */
  function applyDateYear(year: number) {
    setDatePreset("all");
    setDateFrom(`${year}-01-01`);
    setDateTo(`${year}-12-31`);
    setDateLabel(`سنة ${year}`);
    setDateOpen(false);
  }

  function applyDateRange(label: string) {
    setDatePreset("all");
    setDateLabel(label);
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

  /** The alert chip forces both property layers on so the results are visible. */
  function toggleInfeasibleOnly() {
    setInfeasOnly((v) => {
      const next = !v;
      if (next)
        setLayers((prev) => ({ ...prev, active: true, archive: true }));
      return next;
    });
  }

  function selectComparable(record: MapComparableRecord) {
    setSelection({ kind: "comparable", record });
    flyTo(record.coords);
  }

  /** Jumping from a property card's nearby list switches the layer on first. */
  function revealComparable(record: MapComparableRecord) {
    setLayers((prev) => ({ ...prev, comparables: true }));
    selectComparable(record);
  }

  /** Nearby comparables shown inside a property card — 2 km, top 5. */
  const nearby =
    selection?.kind === "property" && selection.record.coords
      ? nearbyOf(selection.record.coords, liveComparables, 2, null).slice(0, 5)
      : [];

  const pickerNodes =
    layerPanel === "active"
      ? activeGrouped
      : layerPanel === "archive"
        ? archiveGrouped
        : [];

  return {
    // Filters and toolbar.
    query,
    setQuery,
    city,
    setCity,
    kindCat,
    setKindCat,
    usage,
    setUsage,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    dateLabel,
    dateOpen,
    setDateOpen,
    infeasOnly,
    toggleInfeasibleOnly,
    operationType,
    setOperationType,
    approvedOnly,
    setApprovedOnly,
    cities,
    yearOpts,
    hasFilters: hasActiveMapFilters(
      { query, city, kindCat, usage, dateFrom, dateTo, datePreset, infeasOnly },
      dateLabel,
    ),
    applyDatePreset,
    applyDateYear,
    applyDateRange,
    resetFilters,
    // Layers and selection.
    layers,
    toggleLayer,
    openLayerPanel,
    hideLayer,
    layerPanel,
    setLayerPanel,
    activeSel,
    setActiveSel,
    archiveSel,
    setArchiveSel,
    compSel,
    setCompSel,
    selection,
    setSelection,
    selectComparable,
    revealComparable,
    selectedId,
    recordByPrefixedId,
    handleSelect,
    // Derived data.
    partitioned,
    filteredComparables,
    comparableChoices,
    shownComparables,
    pickerNodes,
    markers,
    stats,
    nearby,
    // Canvas.
    basemap,
    setBasemap,
    command,
    sendCommand,
    flyTo,
    // Navigation.
    openProperty,
    openComparable,
    noCoordsParts: noCoordsSummary(layers, partitioned, filteredComparables),
  };
}

export type PropertyMapWorkflow = ReturnType<typeof usePropertyMapWorkflow>;
