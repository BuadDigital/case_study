import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ValuationApproachSettingsDto } from "@platform/api-client";

const api = vi.hoisted(() => ({
  getValuationApproachSettings: vi.fn(),
  saveValuationApproachSettings: vi.fn(),
}));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));
vi.mock("@platform/ui-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/ui-kit")>()),
  useToast: () => toast,
  useOptionalToast: () => toast,
}));
vi.mock("../lib/shell-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/shell-utils")>()),
  apiConfig: () => ({ token: "t" }),
}));

import { ApproachSettingsSection } from "../ApproachSettingsSection";

function settings(overrides: Partial<ValuationApproachSettingsDto> = {}): ValuationApproachSettingsDto {
  return {
    valuationRequestId: "vr-1",
    propertyId: "p-1",
    propertyType: "villa",
    isLandPropertyType: false,
    hasStructuresToValue: true,
    costApproachAllowed: true,
    marketApproachEnabled: true,
    costApproachEnabled: false,
    incomeApproachEnabled: false,
    ownershipInterestKey: "freehold",
    ownershipInterestLabelAr: "ملكية تامة",
    remainingLeaseYears: null,
    costBasisKey: "replacement",
    costBasisLabelAr: "الإحلال",
    costScopeKey: "land_and_building",
    costMeasurementUnitKey: "comparison_unit",
    costMeasurementUnitLabelAr: "",
    adjustmentsEditUnlocked: true,
    valuationPurposeKey: "financing",
    valuationPurposeLabelAr: "تمويل",
    externalSpecialistUsed: false,
    valuationDateMode: "issue",
    valuationDateModeLabelAr: "",
    selectedAssumptions: ["بند"],
    assumptionLibrary: ["بند"],
    isSaved: true,
    ...overrides,
  };
}

function renderSection(dto: ValuationApproachSettingsDto) {
  api.getValuationApproachSettings.mockResolvedValue({ ok: true, data: dto });
  api.saveValuationApproachSettings.mockResolvedValue({ ok: true, data: dto });
  return render(
    <ApproachSettingsSection
      valuationRequestId="vr-1"
      settings={dto}
      hydrateKey={1}
      saving={false}
      onSavingChange={() => {}}
      onSettingsSaved={() => {}}
    />,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ApproachSettingsSection — D9 / D11 / D17 fields", () => {
  it("sends the income toggle, the ownership interest and lease years instead of hard-coded values", async () => {
    renderSection(settings());
    fireEvent.click(screen.getByRole("checkbox", { name: /أسلوب الدخل/ }));
    fireEvent.change(screen.getByLabelText("نوع الملكية المقيَّمة"), {
      target: { value: "leased_land" },
    });
    fireEvent.change(screen.getByLabelText("المدة المتبقية (سنة)"), {
      target: { value: "٢٠" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الأساليب" }));
    await waitFor(() => expect(api.saveValuationApproachSettings).toHaveBeenCalled());
    expect(api.saveValuationApproachSettings.mock.calls[0][2]).toMatchObject({
      incomeApproachEnabled: true,
      ownershipInterestKey: "leased_land",
      remainingLeaseYears: 20,
      retrospectiveRationale: null,
    });
  });

  it("refuses a leasehold save without the remaining lease years", async () => {
    renderSection(settings());
    fireEvent.change(screen.getByLabelText("نوع الملكية المقيَّمة"), {
      target: { value: "usufruct" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الأساليب" }));
    await waitFor(() => expect(toast.showToast).toHaveBeenCalled());
    expect(api.saveValuationApproachSettings).not.toHaveBeenCalled();
  });

  it("requires and sends the retrospective rationale", async () => {
    renderSection(
      settings({ valuationDateMode: "retrospective", retrospectiveDate: "2026-01-15" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "حفظ الأساليب" }));
    await waitFor(() => expect(toast.showToast).toHaveBeenCalled());
    expect(api.saveValuationApproachSettings).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("مبرر التقييم بأثر رجعي"), {
      target: { value: "طلب الجهة القضائية تقدير القيمة في تاريخ الحجز" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الأساليب" }));
    await waitFor(() => expect(api.saveValuationApproachSettings).toHaveBeenCalled());
    expect(api.saveValuationApproachSettings.mock.calls[0][2]).toMatchObject({
      valuationDateMode: "retrospective",
      retrospectiveDate: "2026-01-15",
      retrospectiveRationale: "طلب الجهة القضائية تقدير القيمة في تاريخ الحجز",
    });
  });

  it("hydrates the saved rationale, interest and income flag", () => {
    renderSection(
      settings({
        valuationDateMode: "retrospective",
        retrospectiveDate: "2026-01-15",
        retrospectiveRationale: "مبرر محفوظ سابقاً",
        ownershipInterestKey: "usufruct",
        remainingLeaseYears: 12,
        incomeApproachEnabled: true,
      }),
    );
    expect(screen.getByLabelText("مبرر التقييم بأثر رجعي")).toHaveProperty(
      "value",
      "مبرر محفوظ سابقاً",
    );
    expect(screen.getByLabelText("نوع الملكية المقيَّمة")).toHaveProperty("value", "usufruct");
    expect(screen.getByLabelText("المدة المتبقية (سنة)")).toHaveProperty("value", "12");
    expect(screen.getByRole("checkbox", { name: /أسلوب الدخل/ })).toHaveProperty("checked", true);
  });
});
