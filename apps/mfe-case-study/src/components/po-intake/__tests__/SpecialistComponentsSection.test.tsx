import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildingInventoryDto, BuildingInventoryLineDto } from "@platform/api-client";

const api = vi.hoisted(() => ({
  getBuildingInventory: vi.fn(),
  saveBuildingInventory: vi.fn(),
}));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  getBuildingInventory: api.getBuildingInventory,
  saveBuildingInventory: api.saveBuildingInventory,
}));
vi.mock("@platform/app-shared/app-data/work-orders-api-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/app-shared/app-data/work-orders-api-config")>()),
  workOrdersApiConfig: () => ({ token: "t" }),
}));

import { SpecialistComponentsSection } from "../SpecialistComponentsSection";

function dto(lines: BuildingInventoryLineDto[], componentsText = ""): BuildingInventoryDto {
  return { propertyId: "prop-1", hasStructuresToValue: lines.length ? "yes" : "no", componentsText, lines };
}

beforeEach(() => {
  api.getBuildingInventory.mockReset().mockResolvedValue({ ok: true, data: dto([], "فيلا دورين") });
  api.saveBuildingInventory
    .mockReset()
    .mockImplementation(async (_c: unknown, _po: string, _p: string, body: { lines: BuildingInventoryLineDto[]; componentsText?: string }) => ({
      ok: true,
      data: dto(body.lines.map((l, i) => ({ ...l, id: l.id ?? `srv-${i}` })), body.componentsText ?? ""),
    }));
});

// Omar 2026-11-19: «what is حفظ مكونات العقار?» — the section saves itself and says so.
describe("SpecialistComponentsSection", () => {
  it("has no save button, and saves the text a pause after typing", async () => {
    render(<SpecialistComponentsSection poNumber="PO-1" propertyId="prop-1" />);
    const text = await screen.findByLabelText("مكونات العقار (تُطبع في التقرير)");
    expect(screen.queryByRole("button", { name: /حفظ/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("محفوظ ✓");

    fireEvent.change(text, { target: { value: "فيلا دورين وملحق علوي" } });
    await waitFor(() => expect(api.saveBuildingInventory).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(api.saveBuildingInventory.mock.calls[0]![3]).toMatchObject({ componentsText: "فيلا دورين وملحق علوي" });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("محفوظ ✓"));
  });

  it("starts an empty table from one clear action", async () => {
    render(<SpecialistComponentsSection poNumber="PO-1" propertyId="prop-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "إضافة أول مبنى أو ملحق" }));
    expect(screen.getAllByLabelText("البند — السطر 1").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "إضافة مبنى أو ملحق" })).toBeTruthy();
  });

  it("shows a read-only table with no actions", async () => {
    render(<SpecialistComponentsSection poNumber="PO-1" propertyId="prop-1" disabled />);
    expect(await screen.findByText("لا توجد بنود.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
