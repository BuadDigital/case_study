"use client";

import dynamic from "next/dynamic";
import { Badge, cn, opsFloatPanel } from "@platform/ui-kit";

import {
  POINT_FAMILIES,
  WORKFLOW_STATUS,
  comparableCard,
  fmtMoney,
  propertyCard,
} from "../lib/app-data/map-locations-logic";
import { workflowTone } from "../lib/app-data/property-map-view-state";
import {
  CompPickerList,
  DetailCard,
  LayerSidePanel,
  LegendDot,
  PickerList,
} from "../components/property-map/PropertyMapPanels";
import { PropertyMapToolbar } from "./PropertyMapToolbar";
import { usePropertyMapWorkflow } from "./usePropertyMapWorkflow";

const PropertyMapCanvas = dynamic(
  () =>
    import("../components/property-map/PropertyMapCanvasGoogle").then(
      (m) => m.PropertyMapCanvasGoogle,
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
 * Property map — toolbar over the canvas, with the layer pickers, the
 * selection card and the legend floating on top. All state lives in
 * `usePropertyMapWorkflow`.
 *
 * Remaining later (no polish):
 * - Property photo in the card + zoom (lightbox) from the transaction attachment.
 * - Precise field coordinates instead of approximate when available from the inspector.
 * - Open a specific comparable card, not the bank list.
 */
export function PropertyMapView() {
  const workflow = usePropertyMapWorkflow();
  const {
    layers,
    layerPanel,
    setLayerPanel,
    hideLayer,
    activeSel,
    setActiveSel,
    archiveSel,
    setArchiveSel,
    compSel,
    setCompSel,
    pickerNodes,
    comparableChoices,
    shownComparables,
    operationType,
    setOperationType,
    approvedOnly,
    setApprovedOnly,
    selection,
    setSelection,
    selectComparable,
    revealComparable,
    selectedId,
    recordByPrefixedId,
    handleSelect,
    markers,
    stats,
    nearby,
    noCoordsParts,
    basemap,
    setBasemap,
    command,
    sendCommand,
    flyTo,
    setDateOpen,
    openProperty,
    openComparable,
  } = workflow;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-bg" dir="rtl">
      <PropertyMapToolbar workflow={workflow} />

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
            onHide={() => hideLayer("comparables")}
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
              onZoom={selectComparable}
            />
          </LayerSidePanel>
        ) : null}

        {layerPanel === "active" || layerPanel === "archive" ? (
          <LayerSidePanel
            title={layerPanel === "active" ? "العقارات النشطة" : "العقارات المكتملة"}
            wide
            onHide={() => hideLayer(layerPanel)}
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
            onNearby={revealComparable}
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
          <div className={cn(opsFloatPanel, "absolute end-3.5 top-3.5 z-[1100] max-h-[70%] w-[280px] overflow-y-auto")}>
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
                const rec = recordByPrefixedId.get(id);
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

        <div className="pointer-events-none absolute inset-x-3.5 bottom-3.5 z-[400] flex flex-wrap items-center gap-3.5 rounded-[10px] border border-border bg-white/95 px-3.5 py-2 text-[12px] text-text-2 shadow-card">
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
