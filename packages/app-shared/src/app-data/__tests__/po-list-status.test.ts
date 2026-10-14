import { describe, expect, it } from "vitest";
import {
  isPoListStatusTerminal,
  normalizePoListStatus,
  PO_LIST_STATUS_OPTIONS,
  poListStatusMeta,
  poListStatusOptions,
  studyStatusOf,
} from "../po-list-status";
import { canSeeBillingStatuses } from "../role-access";

describe("poListStatusOptions", () => {
  it("offers the buckets first, then every status, to the roles that see billing", () => {
    const values = poListStatusOptions({ billing: true }).map((o) => o.value);
    expect(values.slice(0, 3)).toEqual(["", "active", "closed"]);
    expect(values).toContain("ready_for_enfaz");
    expect(values).toContain("partially_billed");
    expect(values).toContain("fully_billed");
    expect(PO_LIST_STATUS_OPTIONS).toEqual(poListStatusOptions({ billing: true }));
  });

  it("hides the billing labels from the roles that work the study cycle", () => {
    const values = poListStatusOptions({ billing: false }).map((o) => o.value);
    expect(values).toEqual([
      "",
      "active",
      "closed",
      "new",
      "under_study",
      "ready_for_enfaz",
      "completed",
      "stopped",
      "cancelled",
    ]);
  });

  it("labels the handover backlog with the approved term", () => {
    expect(poListStatusMeta("ready_for_enfaz").label).toBe("جاهز للرفع على إنفاذ");
    expect(
      poListStatusOptions({ billing: false }).find((o) => o.value === "active")?.label,
    ).toBe("النشطة");
  });
});

describe("status rules", () => {
  it("keeps «جاهز للرفع» open work — only delivery, a stop or a cancel is terminal", () => {
    expect(isPoListStatusTerminal("ready_for_enfaz")).toBe(false);
    expect(isPoListStatusTerminal("under_study")).toBe(false);
    expect(isPoListStatusTerminal("completed")).toBe(true);
    expect(isPoListStatusTerminal("fully_billed")).toBe(true);
    expect(isPoListStatusTerminal("stopped")).toBe(true);
  });

  it("accepts the new status and still falls back to «جديد» on an unknown value", () => {
    expect(normalizePoListStatus("ready_for_enfaz")).toBe("ready_for_enfaz");
    expect(normalizePoListStatus("archived")).toBe("new");
  });

  it("maps a billing label back to its study status for an older server", () => {
    expect(studyStatusOf("fully_billed")).toBe("completed");
    expect(studyStatusOf("partially_billed")).toBe("under_study");
    expect(studyStatusOf("ready_for_enfaz")).toBe("ready_for_enfaz");
  });
});

describe("canSeeBillingStatuses", () => {
  it("is Finance's and management's view, not the specialist's or the parties'", () => {
    expect(canSeeBillingStatuses("financial-officer")).toBe(true);
    expect(canSeeBillingStatuses("section-supervisor")).toBe(true);
    expect(canSeeBillingStatuses("general-manager")).toBe(true);
    expect(canSeeBillingStatuses("cdo")).toBe(true);
    expect(canSeeBillingStatuses("case-specialist")).toBe(false);
    expect(canSeeBillingStatuses("real-estate-appraiser")).toBe(false);
    expect(canSeeBillingStatuses("field-inspector")).toBe(false);
  });
});
