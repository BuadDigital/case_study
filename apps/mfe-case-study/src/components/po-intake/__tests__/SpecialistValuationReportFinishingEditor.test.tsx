import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ level: "" as string, saved: [] as string[] }));
vi.mock("@platform/app-shared/organization/organization-settings-cache", () => ({
  getCachedOrganizationSettings: () => ({
    valuationReport: { finishingLuxury: "واجهات حجر طبيعي ورخام فاخر", finishingMedium: "", finishingOrdinary: "" },
  }),
  ensureOrganizationSettingsLoaded: () => new Promise(() => {}),
}));
vi.mock("@platform/app-shared/app-data/valuation-report-specialist-finishing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/app-shared/app-data/valuation-report-specialist-finishing")>()),
  loadSpecialistFinishingLevel: () => store.level,
  saveSpecialistFinishingLevel: (_id: string, level: string) => {
    store.saved.push(level);
  },
}));

import { SpecialistValuationReportFinishingEditor } from "../SpecialistValuationReportFinishingEditor";

beforeEach(() => {
  store.level = "";
  store.saved = [];
});

// Omar 2026-11-19: the dropdown hid what each level means — the report prints it.
describe("SpecialistValuationReportFinishingEditor", () => {
  it("shows the four levels with what the report prints for each, and saves a pick", () => {
    render(<SpecialistValuationReportFinishingEditor propertyId="p-1" />);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByText("واجهات حجر طبيعي ورخام فاخر")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /تشطيب فاخر/ }));
    expect(store.saved).toEqual(["luxury"]);
    expect(screen.getByRole<HTMLInputElement>("radio", { name: /تشطيب فاخر/ }).checked).toBe(true);
  });

  it("falls back to the report's own text where the organisation set none", () => {
    render(<SpecialistValuationReportFinishingEditor propertyId="p-1" />);
    expect(screen.getAllByText(/تشطيبات خارجية/).length).toBeGreaterThanOrEqual(2);
  });

  it("shows only the chosen level when read only", () => {
    store.level = "medium";
    render(<SpecialistValuationReportFinishingEditor propertyId="p-1" readOnly />);
    const radios = screen.getAllByRole<HTMLInputElement>("radio");
    expect(radios).toHaveLength(1);
    expect(radios[0]!.checked).toBe(true);
    expect(radios[0]!.disabled).toBe(true);
  });

  it("says nothing was chosen when read only without a level", () => {
    render(<SpecialistValuationReportFinishingEditor propertyId="p-1" readOnly />);
    expect(screen.getByText("لم يُحدَّد مستوى التشطيب بعد.")).toBeTruthy();
  });
});
