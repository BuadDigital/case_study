import { describe, expect, it, vi } from "vitest";
import { buildPoListRowMoreItems } from "../po-list-row-menu";

function items(over: Partial<Parameters<typeof buildPoListRowMoreItems>[0]> = {}) {
  return buildPoListRowMoreItems({
    poNumber: "PO-1",
    status: "under_study",
    showEdit: false,
    showDelete: false,
    showLifecycleActions: false,
    showCancel: true,
    cancelDecides: false,
    deleting: false,
    lifecycleBusy: false,
    router: { push: vi.fn() },
    onDelete: vi.fn(),
    onCancel: vi.fn(),
    onStop: vi.fn(),
    ...over,
  });
}

describe("buildPoListRowMoreItems — «إلغاء أمر العمل»", () => {
  it("lets the specialist ask and the supervisor cancel", () => {
    expect(items().find((i) => i.id === "cancel-po")?.label).toBe("طلب إلغاء أمر العمل");
    expect(items({ cancelDecides: true }).find((i) => i.id === "cancel-po")?.label).toBe("إلغاء أمر العمل");
  });

  it("hides the item from roles that may not ask, and disables it on a cancelled order", () => {
    expect(items({ showCancel: false }).some((i) => i.id === "cancel-po")).toBe(false);
    expect(items({ status: "cancelled" }).find((i) => i.id === "cancel-po")?.disabled).toBe(true);
  });

  it("keeps «إيقاف أمر العمل» for the header editors only", () => {
    expect(items().some((i) => i.id === "stop-po")).toBe(false);
    expect(items({ showLifecycleActions: true }).some((i) => i.id === "stop-po")).toBe(true);
  });
});
