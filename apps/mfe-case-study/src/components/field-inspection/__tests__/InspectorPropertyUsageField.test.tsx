import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ValuationListItemDto } from "@platform/api-client";

const state = vi.hoisted(() => ({
  rows: undefined as unknown,
  canReview: false,
  review: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@platform/app-shared/query/valuation-lists-query", () => ({
  useEnabledValuationListRows: () => state.rows,
  syncValuationListsCache: vi.fn(),
}));
vi.mock("@platform/app-shared/app-data/runtime-access", () => ({
  canManageWorkOrders: () => state.canReview,
}));
vi.mock("@platform/app-shared/auth/api-config", () => ({ apiConfig: () => ({ token: "t" }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  reviewPropertyUsage: state.review,
}));
vi.mock("@platform/ui-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/ui-kit")>()),
  useToast: () => ({ showToast: state.toast }),
}));

import { InspectorPropertyUsageField } from "../InspectorPropertyUsageField";

function row(name: string, status = "approved"): ValuationListItemDto {
  return { key: `k-${name}`, name, status, isEnabled: true, sortOrder: 1 } as ValuationListItemDto;
}

function openTyping(text: string) {
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "__add_usage__" } });
  fireEvent.change(screen.getByLabelText("استخدام غير موجود في القائمة"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "إضافة" }));
}

describe("InspectorPropertyUsageField", () => {
  beforeEach(() => {
    state.rows = [row("سكني"), row("تجاري إداري"), row("مستودعات")];
    state.canReview = false;
    state.review.mockReset();
  });

  it("offers the settings list and a way to write a name it lacks", () => {
    render(<InspectorPropertyUsageField value="" onChange={vi.fn()} />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["— اختر —", "سكني", "تجاري إداري", "مستودعات", "غير موجود في القائمة…"]);
  });

  it("falls back to the built-in list before the settings load, as on a phone offline", () => {
    state.rows = undefined;
    render(<InspectorPropertyUsageField value="" onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "سكني تجاري" })).toBeTruthy();
  });

  it("shows an old classification as no answer", () => {
    render(<InspectorPropertyUsageField value="مبنى مفرد" onChange={vi.fn()} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByRole("option", { name: "مبنى مفرد" })).toBeNull();
  });

  it("takes a new name as typed", () => {
    const onChange = vi.fn();
    render(<InspectorPropertyUsageField value="" onChange={onChange} />);
    openTyping("مغسلة سيارات");
    expect(onChange).toHaveBeenCalledWith("مغسلة سيارات");
  });

  it("takes the listed spelling of a name already on the list", () => {
    const onChange = vi.fn();
    render(<InspectorPropertyUsageField value="" onChange={onChange} />);
    openTyping("تجاري اداري");
    expect(onChange).toHaveBeenCalledWith("تجاري إداري");
  });

  it("asks «هل تقصد» for a look-alike and can still continue with the typed name", () => {
    const onChange = vi.fn();
    render(<InspectorPropertyUsageField value="" onChange={onChange} />);
    openTyping("مستودعاات");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "مستودعات" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "متابعة باسم «مستودعاات»" }));
    expect(onChange).toHaveBeenCalledWith("مستودعاات");
  });

  it("refuses a name that is not Arabic", () => {
    const onChange = vi.fn();
    render(<InspectorPropertyUsageField value="" onChange={onChange} />);
    openTyping("Shop");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("اكتب اسم الاستخدام بالعربية");
  });

  it("keeps a saved name that left the list selectable", () => {
    render(<InspectorPropertyUsageField value="مصلى" onChange={vi.fn()} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("مصلى");
  });

  describe("a name awaiting review", () => {
    beforeEach(() => {
      state.rows = [row("سكني"), row("مصلى", "pending")];
    });

    it("tells the inspector it is new, with no review actions", () => {
      render(<InspectorPropertyUsageField value="مصلى" onChange={vi.fn()} />);
      expect(screen.getByText("اسم جديد بانتظار الاعتماد")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "اعتماد" })).toBeNull();
    });

    it("lets the specialist approve it", async () => {
      state.canReview = true;
      state.review.mockResolvedValue({ ok: true, data: {} });
      render(<InspectorPropertyUsageField value="مصلى" onChange={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "اعتماد" }));
      await vi.waitFor(() =>
        expect(state.review).toHaveBeenCalledWith(expect.anything(), "k-مصلى", {
          action: "approve",
          nameAr: undefined,
        }),
      );
    });

    it("moves a specialist's correction onto the property too", async () => {
      state.canReview = true;
      state.review.mockResolvedValue({ ok: true, data: {} });
      const onChange = vi.fn();
      render(<InspectorPropertyUsageField value="مصلى" onChange={onChange} />);
      fireEvent.click(screen.getByRole("button", { name: "تصحيح" }));
      fireEvent.change(screen.getByLabelText("تصحيح اسم الاستخدام"), {
        target: { value: "مصلى عيد" },
      });
      fireEvent.click(screen.getByRole("button", { name: "تصحيح واعتماد" }));
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith("مصلى عيد"));
    });
  });
});
