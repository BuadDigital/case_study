/**
 * The land layers of the Google properties map — plans, parcel outlines and parcel numbers —
 * as deck.gl vector-tile layers on a `GoogleMapsOverlay`. Imported on demand (the first land layer
 * switched on), so the map loads without deck.gl.
 */
import { CollisionFilterExtension, type CollisionFilterExtensionProps } from "@deck.gl/extensions";
import { GoogleMapsOverlay } from "@deck.gl/google-maps";
import { MVTLayer } from "@deck.gl/geo-layers";
import { MVTLoader } from "@loaders.gl/mvt";
import {
  PARCEL_LABEL_MIN_ZOOM,
  PARCEL_MAX_TILE_ZOOM,
  PARCEL_MIN_ZOOM,
  PLAN_LABEL_MIN_ZOOM,
  PLAN_MIN_ZOOM,
  parcelHighlightColor,
  parcelKey,
  parcelLineStyle,
  parcelNumberText,
  parcelTileUrls,
  planNumberText,
  planStyle,
  type LandLayers,
  type ParcelProps,
} from "../../lib/app-data/parcel-layer-logic";

type ParcelFeature = { properties: ParcelProps };
type PlanFeature = { properties: { plan?: string | null } };

/**
 * Decode the tiles in the page with the full MVT loader: deck.gl's default loader only works in a
 * worker that loaders.gl fetches from unpkg, which the app's Content-Security-Policy refuses
 * (seen 2026-11-16) — and it should keep refusing it.
 */
const TILE_LOADING = { loaders: [MVTLoader], loadOptions: { core: { worker: false } } };

/** The plans' tiles hold two layers: the plans' outlines and a point per plan for its number. */
const planTileLayer = (layer: "plans" | "plan_labels") => ({
  loaders: TILE_LOADING.loaders,
  loadOptions: { ...TILE_LOADING.loadOptions, mvt: { layers: [layer] } },
});

/**
 * Text on the map, in the app's own font (Tajawal), with a thin halo so it reads on imagery and
 * streets alike. Labels that would overlap are left out — one collision group for the plans' and
 * the parcels' numbers, a plan's number winning (Omar 2026-11-16: the numbers piled on each other).
 */
const TEXT = {
  pointType: "text",
  binary: false,
  textOutlineWidth: 3,
  textFontWeight: 700,
  textFontFamily: "Tajawal, Tahoma, sans-serif",
  textFontSettings: { sdf: true, fontSize: 64, buffer: 6 },
  textCharacterSet: "auto",
} as const;
const COLLISION = { extensions: [new CollisionFilterExtension()], collisionGroup: "land-labels" };

export type LandView = { zoom: number; satellite: boolean; show: LandLayers };

export type ParcelsOverlay = {
  /** Redraw for a new zoom, base map or set of switched-on layers. */
  update(view: LandView): void;
  /** Forget the highlighted parcel. */
  clearSelection(): void;
  destroy(): void;
};

/**
 * Puts the land layers on `map`, each drawn only while its switch is on. A click on a parcel (with
 * «حدود القطع» on) highlights it — every piece of it across tiles — and hands its attributes and
 * the clicked point to `onPick`.
 */
export function createParcelsOverlay(
  map: google.maps.Map,
  options: {
    tilesBase: string;
    view: LandView;
    onPick: (parcel: ParcelProps, at: { lat: number; lng: number }) => void;
  },
): ParcelsOverlay {
  const urls = parcelTileUrls(options.tilesBase);
  let view = options.view;
  let selected: string | null = null;

  const layers = () => {
    const line = parcelLineStyle(view.zoom, view.satellite);
    const highlight = parcelHighlightColor(view.satellite);
    const plan = planStyle(view.satellite);
    const halo: [number, number, number, number] = [255, 255, 255, view.satellite ? 220 : 255];
    return [
      new MVTLayer<{ plan?: string | null }>({
        id: "plans",
        data: urls.plans,
        ...planTileLayer("plans"),
        visible: view.show.plans,
        minZoom: PLAN_MIN_ZOOM,
        maxZoom: PARCEL_MAX_TILE_ZOOM,
        filled: false,
        stroked: true,
        getLineColor: plan.line,
        getLineWidth: view.zoom < 14 ? 1 : 1.6,
        lineWidthUnits: "pixels",
      }),
      new MVTLayer<ParcelProps>({
        id: "parcels",
        data: urls.parcels,
        ...TILE_LOADING,
        visible: view.show.parcels,
        minZoom: PARCEL_MIN_ZOOM,
        maxZoom: PARCEL_MAX_TILE_ZOOM,
        pickable: true,
        filled: true,
        stroked: true,
        getFillColor: (f: ParcelFeature) =>
          parcelKey(f.properties) === selected ? highlight : [0, 0, 0, 0],
        getLineColor: line.color,
        getLineWidth: line.width,
        lineWidthUnits: "pixels",
        updateTriggers: { getFillColor: [selected, view.satellite] },
        onClick: (info) => {
          const feature = info.object as ParcelFeature | undefined;
          if (!feature || !info.coordinate) return false;
          selected = parcelKey(feature.properties);
          options.onPick(feature.properties, { lng: info.coordinate[0]!, lat: info.coordinate[1]! });
          overlay.setProps({ layers: layers() });
          return true;
        },
      }),
      new MVTLayer<ParcelProps, CollisionFilterExtensionProps>({
        id: "parcel-numbers",
        data: urls.labels,
        ...TILE_LOADING,
        ...TEXT,
        ...COLLISION,
        minZoom: PARCEL_MAX_TILE_ZOOM,
        maxZoom: PARCEL_MAX_TILE_ZOOM,
        visible: view.show.numbers && view.zoom >= PARCEL_LABEL_MIN_ZOOM,
        getText: (f: ParcelFeature) => parcelNumberText(f.properties),
        getTextSize: 11,
        getCollisionPriority: 0,
        getTextColor: view.satellite ? [17, 17, 17, 255] : [18, 40, 76, 255],
        textOutlineColor: halo,
      }),
      // The plans' numbers last, above the parcels' numbers where both are on.
      new MVTLayer<{ plan?: string | null }, CollisionFilterExtensionProps>({
        id: "plan-numbers",
        data: urls.plans,
        ...planTileLayer("plan_labels"),
        ...TEXT,
        ...COLLISION,
        minZoom: PLAN_MIN_ZOOM,
        maxZoom: PARCEL_MAX_TILE_ZOOM,
        visible: view.show.plans && view.zoom >= PLAN_LABEL_MIN_ZOOM,
        getText: (f: PlanFeature) => planNumberText(f.properties.plan),
        getTextSize: 12,
        getCollisionPriority: 1,
        getTextColor: plan.text,
        textOutlineColor: view.satellite ? [40, 30, 10, 230] : halo,
      }),
    ];
  };

  const overlay = new GoogleMapsOverlay({ layers: layers() });
  overlay.setMap(map);

  return {
    update(next) {
      view = next;
      overlay.setProps({ layers: layers() });
    },
    clearSelection() {
      if (selected === null) return;
      selected = null;
      overlay.setProps({ layers: layers() });
    },
    destroy() {
      overlay.setMap(null);
      overlay.finalize();
    },
  };
}
