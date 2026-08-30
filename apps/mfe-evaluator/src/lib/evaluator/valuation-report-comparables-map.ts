/** Client-side map for §18 — subject + adopted comparables (Google Maps or SVG fallback). */

import { escHtml } from "./html-escape";

export type ComparablesMapPin = {
  lat: number;
  lng: number;
  label: string;
  kind: "subject" | "comp";
};

export const COMPARABLES_MAP_HOST_ID = "ejada-comps-map-host";
export const SATELLITE_MAP_HOST_ID = "ejada-satellite-map-host";
export const CLOSEUP_MAP_HOST_ID = "ejada-closeup-map-host";

function parseCoord(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const t = (value ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/** Subject property pin: inspector coords first, then optional city fallback. */
export function resolveSubjectMapCoords(input: {
  subjectLat?: string | number | null;
  subjectLng?: string | number | null;
  city?: string | null;
  fallbackLat?: number | null;
  fallbackLng?: number | null;
}): { lat: number; lng: number } | null {
  const lat = parseCoord(input.subjectLat);
  const lng = parseCoord(input.subjectLng);

  if (lat != null && lng != null && !(lat === 0 && lng === 0)) {
    return { lat, lng };
  }

  const fbLat = input.fallbackLat;
  const fbLng = input.fallbackLng;
  if (
    fbLat != null &&
    fbLng != null &&
    Number.isFinite(fbLat) &&
    Number.isFinite(fbLng) &&
    !(fbLat === 0 && fbLng === 0)
  ) {
    return { lat: fbLat, lng: fbLng };
  }
  return null;
}

export function formatSubjectCoordsLabel(lat: number, lng: number): string {
  return `${lat.toFixed(6)} ، ${lng.toFixed(6)}`;
}

export function collectComparablesMapPins(input: {
  subjectLat?: string | number | null;
  subjectLng?: string | number | null;
  city?: string | null;
  fallbackLat?: number | null;
  fallbackLng?: number | null;
  comps?: Array<{
    latitude?: number | null;
    longitude?: number | null;
    label?: string | null;
  }> | null;
}): ComparablesMapPin[] {
  const pins: ComparablesMapPin[] = [];
  const subject = resolveSubjectMapCoords(input);
  if (subject) {
    pins.push({
      lat: subject.lat,
      lng: subject.lng,
      label: "العقار",
      kind: "subject",
    });
  }
  (input.comps ?? []).forEach((c, i) => {
    const lat = parseCoord(c.latitude);
    const lng = parseCoord(c.longitude);
    if (lat == null || lng == null || (lat === 0 && lng === 0)) return;
    pins.push({
      lat,
      lng,
      label: (c.label ?? "").trim() || String(i + 1),
      kind: "comp",
    });
  });
  return pins;
}

/** Subject-only pin list for §33 location maps (both slots share this). */
export function subjectOnlyMapPins(
  pins: ComparablesMapPin[],
): ComparablesMapPin[] {
  const subject = pins.find((p) => p.kind === "subject");
  if (subject) return [{ ...subject, label: "العقار" }];
  const first = pins[0];
  return first
    ? [{ lat: first.lat, lng: first.lng, label: "العقار", kind: "subject" }]
    : [];
}

/** Google Static Maps — only when Maps Static API is enabled on the key. */
export function buildComparablesGoogleStaticMapUrl(
  pins: ComparablesMapPin[],
  apiKey: string,
  size = { w: 900, h: 420 },
): string | null {
  if (pins.length < 1 || !apiKey) return null;
  const params = new URLSearchParams({
    size: `${Math.min(size.w, 640)}x${Math.min(size.h, 640)}`,
    scale: "2",
    maptype: "hybrid",
    language: "ar",
    key: apiKey,
  });
  for (const p of pins) {
    if (p.kind === "subject") {
      params.append("markers", `color:0x12284C|label:S|${p.lat},${p.lng}`);
    } else {
      const digit = p.label.match(/^\d$/)?.[0];
      const label = digit ?? "C";
      params.append("markers", `color:0xC8B591|label:${label}|${p.lat},${p.lng}`);
    }
  }
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

export function resolveComparablesMapImage(pins: ComparablesMapPin[]): {
  url: string;
  contentType: string;
  fileName: string;
} | null {
  if (pins.length < 1) return null;
  // SVG for <img> slots (print + §33). Static Maps breaks when that API is off.
  // Interactive Google Map is used for §18 screen preview only.
  const svg = buildComparablesMapSvgDataUrl(pins);
  if (!svg) return null;
  return {
    url: svg,
    contentType: "image/svg+xml",
    fileName: "comparables-map.svg",
  };
}

/** Project WGS84 → SVG using a padded bounding box (equirectangular). */
export function buildComparablesMapSvgDataUrl(
  pins: ComparablesMapPin[],
  size = { w: 900, h: 420 },
): string | null {
  if (pins.length < 1) return null;

  let minLat = pins[0]!.lat;
  let maxLat = pins[0]!.lat;
  let minLng = pins[0]!.lng;
  let maxLng = pins[0]!.lng;
  for (const p of pins) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }

  const padLat = Math.max((maxLat - minLat) * 0.25, 0.004);
  const padLng = Math.max((maxLng - minLng) * 0.25, 0.004);
  minLat -= padLat;
  maxLat += padLat;
  minLng -= padLng;
  maxLng += padLng;

  const { w, h } = size;
  const margin = 36;
  const plotW = w - margin * 2;
  const plotH = h - margin * 2;

  const project = (lat: number, lng: number) => {
    const x = margin + ((lng - minLng) / (maxLng - minLng || 1)) * plotW;
    const y = margin + ((maxLat - lat) / (maxLat - minLat || 1)) * plotH;
    return { x, y };
  };

  const esc = escHtml;

  const grid: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const x = margin + (plotW * i) / 4;
    const y = margin + (plotH * i) / 4;
    grid.push(
      `<line x1="${x}" y1="${margin}" x2="${x}" y2="${h - margin}" stroke="#e6e1d6" stroke-width="1"/>`,
      `<line x1="${margin}" y1="${y}" x2="${w - margin}" y2="${y}" stroke="#e6e1d6" stroke-width="1"/>`,
    );
  }

  const markers = pins.map((p, idx) => {
    const { x, y } = project(p.lat, p.lng);
    if (p.kind === "subject") {
      return (
        `<g>` +
        `<circle cx="${x}" cy="${y}" r="11" fill="#102b4e" stroke="#fff" stroke-width="2"/>` +
        `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="#fff" font-size="10" font-family="IBM Plex Sans Arabic,Tajawal,sans-serif" font-weight="700">★</text>` +
        `<text x="${x}" y="${y + 26}" text-anchor="middle" fill="#102b4e" font-size="12" font-family="IBM Plex Sans Arabic,Tajawal,sans-serif" font-weight="600">${esc(p.label)}</text>` +
        `</g>`
      );
    }
    const n = p.label.match(/^\d+$/) ? p.label : String(idx);
    return (
      `<g>` +
      `<circle cx="${x}" cy="${y}" r="12" fill="#a4906f" stroke="#fff" stroke-width="2"/>` +
      `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="#fff" font-size="12" font-family="IBM Plex Sans Arabic,Tajawal,sans-serif" font-weight="700">${esc(n)}</text>` +
      `</g>`
    );
  });

  const legend =
    `<g font-family="IBM Plex Sans Arabic,Tajawal,sans-serif" font-size="11" fill="#3a3f4d">` +
    `<circle cx="28" cy="${h - 18}" r="7" fill="#102b4e"/>` +
    `<text x="42" y="${h - 14}">العقار محل التقييم</text>` +
    `<circle cx="180" cy="${h - 18}" r="7" fill="#a4906f"/>` +
    `<text x="194" y="${h - 14}">مقارن معتمد</text>` +
    `</g>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" direction="rtl">` +
    `<rect width="100%" height="100%" fill="#faf8f3"/>` +
    `<rect x="${margin}" y="${margin}" width="${plotW}" height="${plotH}" fill="#fff" stroke="#ddd8cc" stroke-width="1.5"/>` +
    grid.join("") +
    markers.join("") +
    legend +
    `</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Self-contained Google Maps bootstrap for standalone report HTML
 * (print tab / blob). Hosts must already exist with data-pins / data-lat.
 */
export function buildGoogleMapsHtmlBootstrap(apiKey: string): string {
  const key = apiKey.trim();
  if (!key) return "";
  return `<script>
(function(){
  var KEY=${JSON.stringify(key)};
  function mount(g){
    var hosts=[].slice.call(document.querySelectorAll("[data-ejada-gmap]"));
    hosts.forEach(function(el){
      var target=el.querySelector(".ejada-gmap-mount")||el;
      var pins=[];
      try{pins=JSON.parse(el.getAttribute("data-pins")||"[]");}catch(e){}
      if(!pins.length) return;
      var lat=Number(el.getAttribute("data-lat"));
      var lng=Number(el.getAttribute("data-lng"));
      var subject=pins.find(function(p){return p.kind==="subject";})||pins[0];
      var center={
        lat:isFinite(lat)?lat:Number(subject.lat),
        lng:isFinite(lng)?lng:Number(subject.lng)
      };
      if(!isFinite(center.lat)||!isFinite(center.lng)) return;
      var zoomAttr=el.getAttribute("data-zoom");
      var zoom=zoomAttr!=null&&zoomAttr!==""?Number(zoomAttr):null;
      var mapType=el.getAttribute("data-map-type")||"hybrid";
      var typeId=mapType==="satellite"?g.maps.MapTypeId.SATELLITE:
        mapType==="roadmap"?g.maps.MapTypeId.ROADMAP:
        mapType==="terrain"?g.maps.MapTypeId.TERRAIN:g.maps.MapTypeId.HYBRID;
      var bounds=new g.maps.LatLngBounds();
      pins.forEach(function(p){bounds.extend({lat:Number(p.lat),lng:Number(p.lng)});});
      var map=new g.maps.Map(target,{
        center:center,
        zoom:(zoom!=null&&isFinite(zoom))?zoom:(pins.length===1?16:14),
        mapTypeId:typeId,
        mapTypeControl:true,
        streetViewControl:false,
        fullscreenControl:true,
        zoomControl:true,
        gestureHandling:"cooperative"
      });
      if(zoom==null&&pins.length>1) map.fitBounds(bounds,48);
      else { map.setCenter(center); if(zoom!=null) map.setZoom(zoom); }
      pins.forEach(function(p){
        var isSubject=p.kind==="subject";
        new g.maps.Marker({
          map:map,
          position:{lat:Number(p.lat),lng:Number(p.lng)},
          title:p.label||"",
          label:isSubject?undefined:{text:String(p.label||"").slice(0,2),color:"#fff",fontWeight:"700",fontSize:"11px"},
          icon:isSubject?{
            path:g.maps.SymbolPath.CIRCLE,scale:10,fillColor:"#12284C",fillOpacity:1,strokeColor:"#fff",strokeWeight:2
          }:{
            path:g.maps.SymbolPath.CIRCLE,scale:9,fillColor:"#C8B591",fillOpacity:1,strokeColor:"#12284C",strokeWeight:1.5
          },
          zIndex:isSubject?1000:100
        });
      });
      setTimeout(function(){
        g.maps.event.trigger(map,"resize");
        map.setCenter(center);
      },50);
    });
  }
  window.__ejadaReportMapsInit=function(){
    if(window.google&&window.google.maps) mount(window.google);
  };
  if(window.google&&window.google.maps){mount(window.google);return;}
  var s=document.createElement("script");
  s.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(KEY)+"&loading=async&callback=__ejadaReportMapsInit";
  s.async=true;
  s.defer=true;
  document.head.appendChild(s);
})();
</script>`;
}
