import { describe, expect, it } from "vitest";
import { MAP_PIN_SYMBOL_SIZE, mapPinSymbolSvg, mapPinSymbolUrl } from "../map-pin-symbol";

/** Omar 2026-11-11: the subject property is a navy circle carrying a house. */
describe("mapPinSymbolSvg", () => {
  it("draws a circle of the given colour with a white edge and the house inside", () => {
    const svg = mapPinSymbolSvg("home", "#12284C");
    expect(svg).toContain(`width="${MAP_PIN_SYMBOL_SIZE}"`);
    expect(svg).toContain('fill="#12284C" stroke="#fff"');
    expect(svg).toContain("M9 22V12h6v10");
  });

  it("lets nothing but a hex colour into the picture", () => {
    const svg = mapPinSymbolSvg("home", '"/><script>alert(1)</script>');
    expect(svg).not.toContain("script");
    expect(svg).toContain('fill="#378add"');
  });

  it("gives the picture as an image address", () => {
    const url = mapPinSymbolUrl("home", "#12284C");
    expect(url.startsWith("data:image/svg+xml;charset=UTF-8,")).toBe(true);
    expect(decodeURIComponent(url.split(",")[1])).toBe(mapPinSymbolSvg("home", "#12284C"));
  });
});
