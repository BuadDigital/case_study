/**
 * The quiet note a map shows over a pressed pin (Omar 2026-11-11), in place of Google's balloon:
 * a small dark label with a few lines, no close button. A map has one note, so pressing another
 * pin moves it instead of stacking a second one, and pressing an empty spot removes it.
 */

export type MapPinNote = {
  /** Show these lines over a point; `offsetPx` is how far above the point the pin's top is. */
  show: (position: google.maps.LatLngLiteral, lines: readonly string[], offsetPx: number) => void;
  /** Replace the lines of the note while it stays where it is. */
  setLines: (lines: readonly string[]) => void;
  hide: () => void;
};

const NOTE_STYLE = [
  "position:absolute",
  "pointer-events:none",
  "width:max-content",
  "max-width:240px",
  "padding:6px 9px",
  "border-radius:8px",
  "background:rgba(18,40,76,.93)",
  "border:1px solid rgba(255,255,255,.22)",
  "box-shadow:0 4px 14px rgba(0,0,0,.28)",
  "color:#fff",
  "font:500 11px/1.55 Tajawal,system-ui,sans-serif",
  "direction:rtl",
  "text-align:start",
].join(";");

/** Space kept between the note and the map's edges, and between the note and its pin. */
const EDGE_GAP = 6;

/** The usable lines of a note: trimmed, without the empty ones. */
export function mapPinNoteLines(lines: readonly (string | null | undefined)[]): string[] {
  return lines.map((line) => (line ?? "").trim()).filter(Boolean);
}

/**
 * Where the note sits for a pin at (`x`, `y`) inside a map of `mapWidth`: centred above the pin,
 * pushed sideways to stay inside the map, and below the pin when there is no room above. Pure.
 */
export function placeMapPinNote(input: {
  x: number;
  y: number;
  mapWidth: number;
  noteWidth: number;
  noteHeight: number;
  offsetPx: number;
}): { dx: number; dy: number } {
  const { x, y, mapWidth, noteWidth, noteHeight, offsetPx } = input;
  const half = noteWidth / 2;
  const minX = EDGE_GAP + half;
  const maxX = mapWidth - EDGE_GAP - half;
  const centre = maxX < minX ? mapWidth / 2 : Math.min(Math.max(x, minX), maxX);
  const above = y - offsetPx - EDGE_GAP - noteHeight;
  return {
    dx: centre - x - half,
    dy: above >= EDGE_GAP ? -offsetPx - EDGE_GAP - noteHeight : EDGE_GAP + 10,
  };
}

/**
 * The one note of a map.
 *
 * How it works: a map overlay holding one element; it is drawn in the map's float pane, follows
 * the map as it moves, and lets clicks through (pressing it presses the map under it).
 * Edge cases: a note with no usable line is hidden.
 */
export function createMapPinNote(g: typeof google, map: google.maps.Map): MapPinNote {
  const el = document.createElement("div");
  el.style.cssText = NOTE_STYLE;
  el.setAttribute("role", "status");
  let position: google.maps.LatLngLiteral | null = null;
  let offset = 0;

  class NoteOverlay extends g.maps.OverlayView {
    onAdd() {
      this.getPanes()?.floatPane.appendChild(el);
    }
    draw() {
      const projection = this.getProjection();
      if (!projection || !position) return;
      const at = new g.maps.LatLng(position);
      const inPane = projection.fromLatLngToDivPixel(at);
      const inMap = projection.fromLatLngToContainerPixel(at);
      if (!inPane || !inMap) return;
      const { dx, dy } = placeMapPinNote({
        x: inMap.x,
        y: inMap.y,
        mapWidth: map.getDiv().clientWidth,
        noteWidth: el.offsetWidth,
        noteHeight: el.offsetHeight,
        offsetPx: offset,
      });
      el.style.left = `${inPane.x + dx}px`;
      el.style.top = `${inPane.y + dy}px`;
    }
    onRemove() {
      el.remove();
    }
  }
  const overlay = new NoteOverlay();

  const write = (lines: readonly string[]) => {
    el.replaceChildren(
      ...lines.map((line, index) => {
        const row = document.createElement("div");
        row.textContent = line;
        row.style.cssText = index === 0 ? "font-weight:700" : "opacity:.86";
        return row;
      }),
    );
  };

  return {
    show(at, lines, offsetPx) {
      const usable = mapPinNoteLines(lines);
      if (usable.length === 0) {
        overlay.setMap(null);
        return;
      }
      position = at;
      offset = offsetPx;
      write(usable);
      if (overlay.getMap() === map) overlay.draw();
      else overlay.setMap(map);
    },
    setLines(lines) {
      const usable = mapPinNoteLines(lines);
      if (usable.length === 0) {
        overlay.setMap(null);
        return;
      }
      write(usable);
      if (overlay.getMap() === map) overlay.draw();
    },
    hide() {
      overlay.setMap(null);
    },
  };
}
