import { describe, expect, it } from "vitest";
import type { OrganizationValuerRosterEntry } from "@platform/api-client";
import {
  catLabel,
  certBlockMessage,
  completenessGaps,
  filterRoster,
  isIsoDate,
  isLinkedStaffValuer,
  isRowComplete,
  isStockSignatureUrl,
  roleLabel,
  rosterEditHref,
  rowStatus,
  sigOk,
  sortRoster,
} from "../valuers-roster-state";

const TODAY = "2026-09-05";

function row(patch: Partial<OrganizationValuerRosterEntry> = {}): OrganizationValuerRosterEntry {
  return {
    id: "v1",
    nameAr: "عماد",
    role: "valuer",
    membershipCategory: "fellow",
    membershipNumber: "1210000003",
    membershipExpiresAt: "2027-01-01",
    isActive: true,
    signatureUrl: "data:image/png;base64,abc",
    ...patch,
  };
}

describe("labels and predicates", () => {
  it("isIsoDate / roleLabel / catLabel", () => {
    expect(isIsoDate("2026-09-05")).toBe(true);
    expect(isIsoDate("5/9/2026")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(roleLabel("certified")).toBe("مقيّم معتمد");
    expect(roleLabel("unknown")).toBe("unknown");
    expect(catLabel("fellow")).toContain("زميل");
    expect(catLabel(null)).toBe("—");
  });

  it("signature predicates ignore the stock asset", () => {
    expect(isStockSignatureUrl("/case-study/ejadah-signature.png")).toBe(true);
    expect(isStockSignatureUrl("")).toBe(true);
    expect(isStockSignatureUrl("data:x")).toBe(false);
    expect(sigOk(row())).toBe(true);
    expect(sigOk(row({ signatureUrl: "/case-study/ejadah-signature.png" }))).toBe(false);
    expect(isLinkedStaffValuer(row({ staffUserId: "u1" }))).toBe(true);
    expect(isLinkedStaffValuer(row())).toBe(false);
  });
});

describe("completeness / status", () => {
  it("only the certified row needs a signature", () => {
    expect(completenessGaps(row({ signatureUrl: null }), TODAY)).toEqual([]);
    expect(completenessGaps(row({ role: "certified", signatureUrl: null }), TODAY)).toEqual(["التوقيع"]);
    expect(isRowComplete(row(), TODAY)).toBe(true);
  });

  it("lists the gaps and flags an expired membership", () => {
    const gaps = completenessGaps(
      row({ membershipCategory: "", membershipNumber: "", membershipExpiresAt: "2020-01-01" }),
      TODAY,
    );
    expect(gaps).toEqual(["فئة العضوية", "رقم العضوية", "عضوية منتهية"]);
    expect(rowStatus(row({ membershipExpiresAt: "2020-01-01" }), TODAY).tone).toBe("danger");
    expect(rowStatus(row({ membershipNumber: "" }), TODAY)).toMatchObject({ label: "غير مكتمل", tone: "warning" });
    expect(rowStatus(row(), TODAY)).toMatchObject({ label: "فعّال", tone: "success", blockReason: null });
    expect(rowStatus(row({ isActive: false }), TODAY).label).toBe("لا يظهر في التقرير");
  });

  it("certBlockMessage explains why issuing is blocked", () => {
    expect(certBlockMessage([row()], TODAY)).toBe("لم يُحدَّد مقيّم معتمد — يُمنع إصدار أي تقرير.");
    expect(certBlockMessage([row({ role: "certified" })], TODAY)).toBe("");
    expect(
      certBlockMessage(
        [row({ role: "certified", isActive: false, membershipExpiresAt: "2020-01-01", signatureUrl: null })],
        TODAY,
      ),
    ).toBe(
      "يُمنع إصدار أي تقرير — بيانات المقيّم المعتمد («عماد») غير صالحة: الحساب معطّل · العضوية منتهية · التوقيع غير مرفوع.",
    );
  });
});

describe("ordering, filter and edit link", () => {
  it("sorts the certified row first, then by name, and filters by name", () => {
    const rows = [
      row({ id: "b", nameAr: "ياسر" }),
      row({ id: "c", nameAr: "أحمد", role: "certified" }),
      row({ id: "a", nameAr: "سعد" }),
    ];
    expect(sortRoster(rows).map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(filterRoster(rows, " سعد ")).toHaveLength(1);
    expect(filterRoster(rows, "")).toHaveLength(3);
  });

  it("links a row to its user card only when it has an account", () => {
    expect(rosterEditHref(row({ staffUserId: "u 1" }))).toBe("/users?edit=u%201");
    expect(rosterEditHref(row())).toBeNull();
  });
});
