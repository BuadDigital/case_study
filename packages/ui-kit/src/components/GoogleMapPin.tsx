"use client";

import { useEffect, useInsertionEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import {
  googleMapsApiKey,
  loadGoogleMapsApi,
  reverseGeocodeLocation,
} from "../lib/google-maps-loader";
import {
  MAP_PIN_EMPHASIS_SCALE,
  MAP_PIN_STILL_RING,
  mapPinPulseFrame,
  type MapPinPulseFrame,
} from "../lib/map-pin-pulse";
import { MAP_PIN_SYMBOL_SIZE, mapPinSymbolUrl, type MapPinSymbol } from "../lib/map-pin-symbol";
import { createMapPinNote, type MapPinNote } from "../lib/map-pin-note";
import { MapControlButton, MapControlGroup, MapControlStack } from "./MapControls";

const PIN_ZOOM = 16;
/** How far above its point each kind of pin reaches — where the pressed pin's note sits. */
const PRIMARY_PIN_TOP_PX = 44;
const CONTEXT_PIN_TOP_PX = 10;
const EMPHASIS_PIN_TOP_PX = 16;
/** The note belongs to the primary pin (the one being placed), not to a context pin. */
const PRIMARY_NOTE = "primary";
const OVERVIEW_ZOOM = 6;
const SAUDI_CENTER = { lat: 24.2, lng: 45.0 };

export type GoogleMapContextPin = {
  lat: number;
  lng: number;
  title?: string;
  /** Short label drawn on the marker; the first line of the pressed pin's note when no title. */
  label?: string;
  /**
   * The lines of the note shown when the pin is pressed, one under the other (the first in
   * bold). Without them the note is the title.
   */
  details?: string[];
  /** Identifies the pin to `onContextPinClick`. */
  id?: string;
  /** Marker fill; the default blue is the reference pin (the subject property). */
  color?: string;
  /**
   * The pin stands out among the others: a larger dot with a thick white edge, drawn on top, inside
   * a ring of its own colour that pulses (still when the device asks for reduced motion).
   */
  emphasis?: boolean;
  /** A symbol drawn in white inside the circle, instead of the `label` letters. */
  symbol?: MapPinSymbol;
};

/**
 * The base map with fewer places on it (Omar 2026-11-11): shops, restaurants and bus stops are
 * hidden, and the places that stay (mosques, schools, hospitals, parks, public buildings) keep
 * their name without their icon. Streets and districts are untouched.
 */
const QUIET_PLACES_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit.station.bus", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

export type GoogleMapLocationDetail = {
  lat: number;
  lng: number;
  formattedAddress?: string;
  city?: string;
  district?: string;
};

function parsePin(
  lat?: number | null,
  lng?: number | null,
): { lat: number; lng: number } | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GoogleMapLocationDetail> {
  return reverseGeocodeLocation(lat, lng);
}

/**
 * The ring that pulses around an emphasised pin; returns how to remove it.
 *
 * How it works: a second, unclickable marker under the dot whose circle is redrawn about twenty
 * times a second from `mapPinPulseFrame`.
 * Edge cases: with reduced motion the ring is drawn once and stays still.
 */
function drawPulsingRing(
  g: typeof google,
  map: google.maps.Map,
  position: google.maps.LatLngLiteral,
  color: string,
): () => void {
  const icon = (frame: MapPinPulseFrame): google.maps.Symbol => ({
    path: g.maps.SymbolPath.CIRCLE,
    scale: frame.scale,
    fillColor: color,
    fillOpacity: frame.opacity * 0.6,
    // A white edge keeps the ring visible when its own colour is as dark as the imagery under it.
    strokeColor: "#fff",
    strokeOpacity: Math.min(1, frame.opacity * 1.6),
    strokeWeight: 2,
  });
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const ring = new g.maps.Marker({
    map,
    position,
    clickable: false,
    zIndex: 899,
    icon: icon(still ? MAP_PIN_STILL_RING : mapPinPulseFrame(0)),
  });
  if (still) return () => ring.setMap(null);
  const startedAt = Date.now();
  const timer = window.setInterval(() => ring.setIcon(icon(mapPinPulseFrame(Date.now() - startedAt))), 50);
  return () => {
    window.clearInterval(timer);
    ring.setMap(null);
  };
}

/** Google Maps needs the network — the offline stand-in when no hint is given. */
const MAP_OFFLINE_MESSAGE =
  "الخريطة تحتاج اتصالاً بالشبكة — تظهر تلقائياً عند عودة الاتصال.";

export function GoogleMapPin({
  lat,
  lng,
  className,
  title = "خريطة موقع العقار",
  interactive = false,
  disabled = false,
  mapTypeControl = false,
  pinLabel,
  contextPins,
  initialCenter,
  viewCenter,
  viewEpoch = 0,
  resolvePlace = false,
  onCoordsChange,
  onLocationDetail,
  onContextPinClick,
  fitPinsKey,
  onCenterChange,
  onBackgroundClick,
  freePan = false,
  quietPlaces = false,
  homeCenter,
  homeLabel,
  offlineHint,
}: {
  lat?: number | null;
  lng?: number | null;
  className?: string;
  title?: string;
  /** Click the map or drag the pin to choose coordinates. */
  interactive?: boolean;
  disabled?: boolean;
  /** Show the streets / satellite switch among the map's controls. */
  mapTypeControl?: boolean;
  /** Caption for the primary pin (info window). */
  pinLabel?: string;
  /** Other pins shown for context (not draggable). */
  contextPins?: GoogleMapContextPin[];
  /** Map center when the primary pin is not placed yet. */
  initialCenter?: { lat: number; lng: number } | null;
  /** Pan here without moving the primary pin (e.g. return to the subject). */
  viewCenter?: { lat: number; lng: number } | null;
  viewEpoch?: number;
  /** Reverse-geocode after pick / when coords change and call onLocationDetail. */
  resolvePlace?: boolean;
  onCoordsChange?: (lat: number, lng: number) => void;
  onLocationDetail?: (detail: GoogleMapLocationDetail) => void;
  /** A context pin that carries an `id` was pressed (pressing a pin never moves the primary pin). */
  onContextPinClick?: (id: string) => void;
  /**
   * Frame all the context pins once per key: the view fits them the first time pins are drawn
   * under a new key, then is left to the user (panning does not snap back).
   */
  fitPinsKey?: string;
  /** The map came to rest on a new centre (after a pan or a zoom). */
  onCenterChange?: (lat: number, lng: number) => void;
  /** An empty spot of the map was pressed — not a pin (the host drops what a pin opened). */
  onBackgroundClick?: () => void;
  /** Scroll and drag move the map directly even when it is not picking (a map to browse). */
  freePan?: boolean;
  /**
   * A calmer base map for reading pins: shops, restaurants and bus stops are hidden, the places
   * that stay show their name only, and pressing a place opens nothing.
   */
  quietPlaces?: boolean;
  /**
   * The point the map is about (the subject property): the recenter control becomes a house
   * that brings the view back to it — wherever the map was moved and whatever pin is placed —
   * named `homeLabel`. Without it the control recentres on the placed pin or the opening point.
   */
  homeCenter?: { lat: number; lng: number } | null;
  homeLabel?: string;
  /**
   * Shown instead of the map while the device is offline (Google Maps needs the
   * network) — e.g. point the user to a GPS capture that works without it. The map
   * loads by itself once the connection returns.
   */
  offlineHint?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  // One note per map: pressing another pin moves it, pressing an empty spot hides it.
  const noteRef = useRef<MapPinNote | null>(null);
  const noteOwnerRef = useRef<string | null>(null);
  const contextMarkersRef = useRef<google.maps.Marker[]>([]);
  const picking = Boolean(interactive && !disabled && onCoordsChange);
  // Latest props for map listeners and the async map init — refreshed after each render
  // (before layout effects), not during it.
  const pickingRef = useRef(picking);
  const onCoordsChangeRef = useRef(onCoordsChange);
  const onLocationDetailRef = useRef(onLocationDetail);
  const onContextPinClickRef = useRef(onContextPinClick);
  const onCenterChangeRef = useRef(onCenterChange);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const fittedKeyRef = useRef<string | null>(null);
  const resolvePlaceRef = useRef(resolvePlace);
  const pinLabelRef = useRef(pinLabel);
  const coordsRef = useRef({ lat, lng });
  const initialCenterRef = useRef(initialCenter);
  useInsertionEffect(() => {
    pickingRef.current = picking;
    onCoordsChangeRef.current = onCoordsChange;
    onLocationDetailRef.current = onLocationDetail;
    onContextPinClickRef.current = onContextPinClick;
    onCenterChangeRef.current = onCenterChange;
    onBackgroundClickRef.current = onBackgroundClick;
    resolvePlaceRef.current = resolvePlace;
    pinLabelRef.current = pinLabel;
    coordsRef.current = { lat, lng };
    initialCenterRef.current = initialCenter;
  });
  const [mapReady, setMapReady] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [basemap, setBasemap] = useState<"roadmap" | "hybrid">("hybrid");
  const [fullscreen, setFullscreen] = useState(false);
  /** Bumped when the network returns after an offline failure — reloads the map. */
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [waitingForNetwork, setWaitingForNetwork] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    googleMapsApiKey()
      ? null
      : "أضف NEXT_PUBLIC_GOOGLE_MAPS_API_KEY لتفعيل خريطة Google.",
  );

  const emitPick = (latVal: number, lngVal: number) => {
    onCoordsChangeRef.current?.(latVal, lngVal);
    if (!resolvePlaceRef.current) return;
    void reverseGeocode(latVal, lngVal).then((detail) => {
      onLocationDetailRef.current?.(detail);
    });
  };

  const hideNote = () => {
    noteRef.current?.hide();
    noteOwnerRef.current = null;
  };

  /** The primary pin's caption as the map's note; without a caption there is no note for it. */
  const showPrimaryNote = (position: google.maps.LatLngLiteral) => {
    const label = pinLabelRef.current?.trim();
    if (!label) {
      if (noteOwnerRef.current === PRIMARY_NOTE) hideNote();
      return;
    }
    noteRef.current?.show(position, [label], PRIMARY_PIN_TOP_PX);
    noteOwnerRef.current = PRIMARY_NOTE;
  };

  useEffect(() => {
    if (!googleMapsApiKey()) return;

    let cancelled = false;
    loadGoogleMapsApi()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        const pin = parsePin(coordsRef.current.lat, coordsRef.current.lng);
        const seed = parsePin(
          initialCenterRef.current?.lat,
          initialCenterRef.current?.lng,
        );
        const center = pin ?? seed ?? SAUDI_CENTER;
        const map = new g.maps.Map(containerRef.current, {
          center,
          zoom: pin || seed ? PIN_ZOOM : OVERVIEW_ZOOM,
          mapTypeId: "hybrid",
          // The map's controls are the system's own (`MapControls`), drawn over the map below.
          disableDefaultUI: true,
          scaleControl: true,
          gestureHandling: pickingRef.current || freePan ? "greedy" : "cooperative",
          ...(quietPlaces ? { clickableIcons: false, styles: QUIET_PLACES_STYLE } : {}),
        });
        mapRef.current = map;
        noteRef.current = createMapPinNote(g, map);
        map.addListener("idle", () => {
          const c = map.getCenter();
          if (c) onCenterChangeRef.current?.(c.lat(), c.lng());
        });
        const marker = new g.maps.Marker({
          map: pin ? map : undefined,
          position: pin ?? undefined,
          draggable: pickingRef.current,
          title: title,
          zIndex: 1000,
        });
        markerRef.current = marker;

        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          // An empty spot was pressed: the note of whatever pin was pressed goes away.
          hideNote();
          onBackgroundClickRef.current?.();
          if (!pickingRef.current) return;
          const pos = event.latLng;
          if (!pos) return;
          marker.setMap(map);
          marker.setPosition(pos);
          map.panTo(pos);
          if ((map.getZoom() ?? 0) < PIN_ZOOM) map.setZoom(PIN_ZOOM);
          const latVal = pos.lat();
          const lngVal = pos.lng();
          showPrimaryNote({ lat: latVal, lng: lngVal });
          emitPick(latVal, lngVal);
        });

        marker.addListener("dragend", () => {
          if (!pickingRef.current) return;
          const pos = marker.getPosition();
          if (!pos) return;
          showPrimaryNote({ lat: pos.lat(), lng: pos.lng() });
          emitPick(pos.lat(), pos.lng());
        });

        marker.addListener("click", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          showPrimaryNote({ lat: pos.lat(), lng: pos.lng() });
        });

        if (pin) showPrimaryNote(pin);

        if (pin && resolvePlaceRef.current) {
          void reverseGeocode(pin.lat, pin.lng).then((detail) => {
            if (!cancelled) onLocationDetailRef.current?.(detail);
          });
        }

        if (!cancelled) {
          setError(null);
          setMapReady(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Offline is not a setup problem: say what works now and retry on reconnect.
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setWaitingForNetwork(true);
          setError(offlineHint ?? MAP_OFFLINE_MESSAGE);
          return;
        }
        setError(
          "تعذّر تحميل خريطة Google — تحقق من مفتاح API وإعادة تشغيل الواجهة.",
        );
      });

    return () => {
      cancelled = true;
      fittedKeyRef.current = null;
      setMapReady(false);
      noteRef.current?.hide();
      noteRef.current = null;
      noteOwnerRef.current = null;
      for (const m of contextMarkersRef.current) m.setMap(null);
      contextMarkersRef.current = [];
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
    // title / freePan / quietPlaces are setup-time options
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAttempt]);

  useEffect(() => {
    if (!waitingForNetwork) return;
    const onOnline = () => {
      setWaitingForNetwork(false);
      setError(null);
      setLoadAttempt((n) => n + 1);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [waitingForNetwork]);

  useEffect(() => {
    markerRef.current?.setDraggable(picking);
  }, [picking]);

  // A press anywhere outside the map drops the pressed pin's note too (Omar 2026-11-12: it
  // stayed up after the user had moved on to the rest of the window).
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && wrapRef.current?.contains(target)) return;
      noteRef.current?.hide();
      noteOwnerRef.current = null;
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const pin = parsePin(lat, lng);
    if (!pin) {
      marker.setMap(null);
      if (noteOwnerRef.current === PRIMARY_NOTE) hideNote();
      return;
    }
    marker.setMap(map);
    marker.setPosition(pin);
    map.panTo(pin);
    if ((map.getZoom() ?? 0) < PIN_ZOOM) map.setZoom(PIN_ZOOM);
  }, [lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewEpoch || !viewCenter) return;
    if (!Number.isFinite(viewCenter.lat) || !Number.isFinite(viewCenter.lng)) {
      return;
    }
    map.panTo(viewCenter);
    if ((map.getZoom() ?? 0) < PIN_ZOOM) map.setZoom(PIN_ZOOM);
  }, [viewEpoch, viewCenter, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    const g = window.google;
    for (const m of contextMarkersRef.current) m.setMap(null);
    contextMarkersRef.current = [];
    const pins = contextPins ?? [];
    const stopPulses: (() => void)[] = [];
    const noteKeys = new Set<string>();
    for (const p of pins) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      const noteKey = p.id ?? `${p.lat},${p.lng}`;
      noteKeys.add(noteKey);
      const fill = p.color ?? "#378add";
      const emphasis = p.emphasis === true;
      if (emphasis) {
        stopPulses.push(drawPulsingRing(g, map, { lat: p.lat, lng: p.lng }, fill));
      }
      const m = new g.maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        title: p.title ?? p.label ?? "مقارن في البنك",
        opacity: emphasis ? 1 : 0.72,
        zIndex: emphasis ? 900 : 100,
        label:
          p.label && !p.symbol
            ? {
                text: p.label.slice(0, 2),
                color: "#fff",
                fontSize: emphasis ? "12px" : "10px",
                fontWeight: "700",
              }
            : undefined,
        icon: p.symbol
          ? {
              url: mapPinSymbolUrl(p.symbol, fill),
              scaledSize: new g.maps.Size(MAP_PIN_SYMBOL_SIZE, MAP_PIN_SYMBOL_SIZE),
              anchor: new g.maps.Point(MAP_PIN_SYMBOL_SIZE / 2, MAP_PIN_SYMBOL_SIZE / 2),
            }
          : {
              path: g.maps.SymbolPath.CIRCLE,
              scale: emphasis ? MAP_PIN_EMPHASIS_SCALE : 8,
              fillColor: fill,
              fillOpacity: emphasis ? 1 : 0.95,
              strokeColor: "#fff",
              strokeWeight: emphasis ? 3 : 1.5,
            },
      });
      m.addListener("click", () => {
        noteRef.current?.show(
          { lat: p.lat, lng: p.lng },
          p.details?.length ? p.details : [p.title ?? p.label ?? ""],
          emphasis || p.symbol ? EMPHASIS_PIN_TOP_PX : CONTEXT_PIN_TOP_PX,
        );
        noteOwnerRef.current = noteKey;
      });
      if (p.id) {
        const id = p.id;
        m.addListener("click", () => onContextPinClickRef.current?.(id));
      }
      contextMarkersRef.current.push(m);
    }
    // The pressed pin is no longer on the map (a filter, a new search): its note goes with it.
    const owner = noteOwnerRef.current;
    if (owner && owner !== PRIMARY_NOTE && !noteKeys.has(owner)) {
      noteRef.current?.hide();
      noteOwnerRef.current = null;
    }
    const drawn = contextMarkersRef.current;
    if (fitPinsKey != null && fittedKeyRef.current !== fitPinsKey && drawn.length > 0) {
      fittedKeyRef.current = fitPinsKey;
      const bounds = new g.maps.LatLngBounds();
      for (const m of drawn) {
        const pos = m.getPosition();
        if (pos) bounds.extend(pos);
      }
      if (drawn.length === 1) {
        map.setCenter(bounds.getCenter());
      } else {
        map.fitBounds(bounds, 48);
      }
    }
    return () => {
      for (const stop of stopPulses) stop();
    };
  }, [contextPins, mapReady, fitPinsKey]);

  // The caption changed while the primary pin's note is up: rewrite it in place. A note that is
  // not showing is not opened here (it would appear while the user is typing).
  useEffect(() => {
    if (noteOwnerRef.current !== PRIMARY_NOTE) return;
    const label = pinLabel?.trim();
    if (label) {
      noteRef.current?.setLines([label]);
    } else {
      noteRef.current?.hide();
      noteOwnerRef.current = null;
    }
  }, [pinLabel]);

  if (error) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-surface-2 px-4 text-center text-[12px] text-text-3",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  const zoomBy = (step: number) => {
    const map = mapRef.current;
    if (map) map.setZoom((map.getZoom() ?? PIN_ZOOM) + step);
  };
  const chooseBasemap = (next: "roadmap" | "hybrid") => {
    setBasemap(next);
    mapRef.current?.setMapTypeId(next);
  };
  // Back to the pin being placed, or to the point the map opened on.
  const home = parsePin(homeCenter?.lat, homeCenter?.lng);
  const recenterOn =
    home ?? parsePin(lat, lng) ?? parsePin(initialCenter?.lat, initialCenter?.lng);
  const recenter = () => {
    const map = mapRef.current;
    if (!map || !recenterOn) return;
    map.panTo(recenterOn);
    if ((map.getZoom() ?? 0) < PIN_ZOOM) map.setZoom(PIN_ZOOM);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.();
  };

  return (
    <div ref={wrapRef} className={cn("relative h-full w-full bg-surface-2", className)}>
      <div
        ref={containerRef}
        role={picking ? "application" : "img"}
        aria-label={
          picking ? `${title} — اضغط على الخريطة لتحديد الموقع` : title
        }
        className={cn("h-full w-full", picking && "cursor-crosshair")}
      />
      {mapReady ? (
        <MapControlStack className="absolute right-2.5 top-2.5 z-[5]">
          <MapControlGroup>
            <MapControlButton label="تكبير" icon="zoom-in" onClick={() => zoomBy(1)} />
            <MapControlButton label="تصغير" icon="zoom-out" onClick={() => zoomBy(-1)} />
          </MapControlGroup>
          {mapTypeControl ? (
            <MapControlGroup>
              <MapControlButton
                label="شوارع"
                icon="streets"
                pressed={basemap === "roadmap"}
                onClick={() => chooseBasemap("roadmap")}
              />
              <MapControlButton
                label="قمر صناعي"
                icon="satellite"
                pressed={basemap === "hybrid"}
                onClick={() => chooseBasemap("hybrid")}
              />
            </MapControlGroup>
          ) : null}
          <MapControlGroup>
            {recenterOn ? (
              <MapControlButton
                label={home ? (homeLabel ?? "الرجوع إلى موقع العقار") : "إعادة توسيط الخريطة"}
                icon={home ? "home" : "recenter"}
                onClick={recenter}
              />
            ) : null}
            <MapControlButton
              label={fullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
              icon={fullscreen ? "exit-fullscreen" : "fullscreen"}
              onClick={toggleFullscreen}
            />
          </MapControlGroup>
        </MapControlStack>
      ) : null}
    </div>
  );
}
