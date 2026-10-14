import { describe, expect, it } from "vitest";
import type { OrganizationValuerRosterEntry } from "@platform/api-client";
import {
  certifiedBlockMessage,
  isIsoDate,
  isStockSignatureUrl,
  membershipCategoryLabel,
  reportSeatLabel,
  seatGaps,
  seatStatus,
  seatedUserIds,
  signatureUploaded,
} from "../users/report-seat-state";

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
  it("isIsoDate / reportSeatLabel / membershipCategoryLabel", () => {
    expect(isIsoDate("2026-09-05")).toBe(true);
    expect(isIsoDate("5/9/2026")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(reportSeatLabel("certified")).toBe("مقيّم معتمد");
    expect(reportSeatLabel("unknown")).toBe("unknown");
    expect(membershipCategoryLabel("fellow")).toContain("زميل");
    expect(membershipCategoryLabel(null)).toBe("—");
  });

  it("signature predicates ignore the stock asset", () => {
    expect(isStockSignatureUrl("/case-study/ejadah-signature.png")).toBe(true);
    expect(isStockSignatureUrl("")).toBe(true);
    expect(isStockSignatureUrl("data:x")).toBe(false);
    expect(signatureUploaded(row())).toBe(true);
    expect(signatureUploaded(row({ signatureUrl: "/case-study/ejadah-signature.png" }))).toBe(false);
  });
});

describe("seat status", () => {
  it("only the certified row needs a signature", () => {
    expect(seatGaps(row({ signatureUrl: null }), TODAY)).toEqual([]);
    expect(seatGaps(row({ role: "certified", signatureUrl: null }), TODAY)).toEqual(["التوقيع"]);
  });

  it("lists the gaps and flags an expired membership", () => {
    const gaps = seatGaps(
      row({ membershipCategory: "", membershipNumber: "", membershipExpiresAt: "2020-01-01" }),
      TODAY,
    );
    expect(gaps).toEqual(["فئة العضوية", "رقم العضوية", "عضوية منتهية"]);
    expect(seatStatus(row({ membershipExpiresAt: "2020-01-01" }), TODAY).tone).toBe("danger");
    expect(seatStatus(row({ membershipNumber: "" }), TODAY)).toMatchObject({ label: "غير مكتمل", tone: "warning" });
    expect(seatStatus(row(), TODAY)).toMatchObject({ label: "فعّال", tone: "success", blockReason: null });
    expect(seatStatus(row({ isActive: false }), TODAY).label).toBe("لا يظهر في التقرير");
  });

  it("certifiedBlockMessage explains why issuing is blocked", () => {
    expect(certifiedBlockMessage([row()], TODAY)).toBe("لم يُحدَّد مقيّم معتمد — يُمنع إصدار أي تقرير.");
    expect(certifiedBlockMessage([row({ role: "certified" })], TODAY)).toBe("");
    expect(
      certifiedBlockMessage(
        [row({ role: "certified", isActive: false, membershipExpiresAt: "2020-01-01", signatureUrl: null })],
        TODAY,
      ),
    ).toBe(
      "يُمنع إصدار أي تقرير — بيانات المقيّم المعتمد («عماد») غير صالحة: الحساب معطّل · العضوية منتهية · التوقيع غير مرفوع.",
    );
  });

  it("seatedUserIds lists accounts with an active linked row", () => {
    const ids = seatedUserIds([
      row({ id: "a", staffUserId: "u1" }),
      row({ id: "b", staffUserId: "u2", isActive: false }),
      row({ id: "c" }),
    ]);
    expect([...ids]).toEqual(["u1"]);
  });
});
