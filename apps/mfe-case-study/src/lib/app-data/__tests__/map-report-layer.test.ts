import { describe, expect, it } from "vitest";
import {
  filterReports,
  reportCardRows,
  type MapReportRecord,
} from "../map-locations-logic";
import { buildMapMarkers, selectedMarkerId } from "../property-map-view-state";

const report = (over: Partial<MapReportRecord> = {}): MapReportRecord => ({
  id: "meqyas:039106",
  source: "meqyas",
  reportNumber: "039106",
  propertyType: "عمارة تجارية سكنية",
  usage: "تجاري",
  valuationDate: "2025-09-10",
  coords: { lat: 21.54, lng: 39.2 },
  ...over,
});

describe("imported valuation reports layer", () => {
  it("filters by report number, land/building, usage and date", () => {
    const land = report({ id: "meqyas:1", reportNumber: "000001", propertyType: "أرض", usage: "سكني", valuationDate: "2024-03-01" });
    const list = [report(), land];
    expect(filterReports(list, { query: "0391" })).toEqual([list[0]]);
    expect(filterReports(list, { kindCat: "أرض" })).toEqual([land]);
    expect(filterReports(list, { usage: "تجاري" })).toEqual([list[0]]);
    expect(
      filterReports(list, { dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") }),
    ).toEqual([list[0]]);
  });

  it("hides every report under a city filter — reports carry no city", () => {
    expect(filterReports([report()], { city: "جدة" })).toEqual([]);
  });

  it("draws reports on their own layer with a prefixed id", () => {
    const [marker] = buildMapMarkers([], [], [report()]);
    expect(marker).toMatchObject({ id: "r:meqyas:039106", layer: "reports" });
    expect(selectedMarkerId({ kind: "report", record: report() })).toBe("r:meqyas:039106");
  });

  it("leaves empty fields out of the card instead of showing «-»", () => {
    const rows = reportCardRows({ deedNumber: "320232002977", client: "", landArea: 0 });
    expect(rows).toEqual([["رقم الصك", "320232002977"]]);
  });
});
