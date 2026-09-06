import { describe, expect, it } from "vitest";
import {
  computeKeysKpis,
  envelopeCardMeta,
  envelopeCardTone,
  envelopeSearchText,
  filterKeyEnvelopes,
  keysListHref,
  keysViewPermissions,
  listTabFromParam,
} from "../keys-view-state";
import type {
  KeyEnvelopeAssignment,
  KeyEnvelopeRow,
} from "../../lib/keys-envelope-types";

function assignment(status: string, deedNumber = "D"): KeyEnvelopeAssignment {
  return { id: `${deedNumber}-${status}`, deedNumber, status };
}

function envelope(over: Partial<KeyEnvelopeRow> = {}): KeyEnvelopeRow {
  return {
    id: "00000000-0000-0000-0000-000000000042",
    requestNumber: "REQ-1",
    referenceNumber: "KE-2026-00007",
    court: "محكمة جدة",
    circuit: "الدائرة 3",
    keysCountLabeled: 2,
    keysCountActual: 2,
    countMismatch: false,
    receiveScenario: "court",
    status: "reviewer",
    feeGenerated: false,
    createdByName: "clerk",
    createdAtUtc: "2026-03-01T00:00:00Z",
    assignments: [],
    handoffs: [],
    timeline: [],
    linkedProperties: [],
    ...over,
  };
}

describe("keysListHref", () => {
  it("builds the list, fees, envelope and register links", () => {
    expect(keysListHref()).toBe("/keys");
    expect(keysListHref({ tab: "fees" })).toBe("/keys?tab=fees");
    expect(keysListHref({ tab: "fees", envelope: "e1" })).toBe(
      "/keys?tab=fees&envelope=e1",
    );
    expect(keysListHref({ register: true, request: "R 1" })).toBe(
      "/keys?register=1&request=R+1",
    );
  });

  it("maps the tab param", () => {
    expect(listTabFromParam("fees")).toBe("fees");
    expect(listTabFromParam("other")).toBe("envelopes");
    expect(listTabFromParam(null)).toBe("envelopes");
  });
});

describe("keysViewPermissions", () => {
  const no = () => false;
  const finance = (c: string) => c === "manage-financial";

  it("locks the general manager to viewing", () => {
    expect(
      keysViewPermissions({ role: "general-manager", superAdmin: false, hasCapability: finance }),
    ).toEqual({
      viewOnly: true,
      canEditEnvelope: false,
      canRegisterEnvelope: false,
      canCollectFee: false,
    });
  });

  it("lets reviewers and supervisors register, inspectors and appraisers only edit", () => {
    expect(
      keysViewPermissions({ role: "government-reviewer", superAdmin: false, hasCapability: no }),
    ).toMatchObject({ canEditEnvelope: true, canRegisterEnvelope: true });
    expect(
      keysViewPermissions({ role: "section-supervisor", superAdmin: false, hasCapability: no }),
    ).toMatchObject({ canEditEnvelope: true, canRegisterEnvelope: true });
    expect(
      keysViewPermissions({ role: "field-inspector", superAdmin: false, hasCapability: no }),
    ).toMatchObject({ canEditEnvelope: true, canRegisterEnvelope: false });
    expect(
      keysViewPermissions({ role: "real-estate-appraiser", superAdmin: false, hasCapability: no }),
    ).toMatchObject({ canEditEnvelope: true, canRegisterEnvelope: false });
  });

  it("super admin can do everything; collection follows the finance capability", () => {
    expect(
      keysViewPermissions({ role: "cdo", superAdmin: true, hasCapability: finance }),
    ).toEqual({
      viewOnly: false,
      canEditEnvelope: true,
      canRegisterEnvelope: true,
      canCollectFee: true,
    });
    expect(
      keysViewPermissions({ role: "financial-officer", superAdmin: false, hasCapability: finance }),
    ).toMatchObject({ canEditEnvelope: false, canCollectFee: true });
  });
});

describe("computeKeysKpis", () => {
  it("counts custody, pending matches and envelopes ready to deliver", () => {
    const kpis = computeKeysKpis([
      envelope({ assignments: [assignment("matched"), assignment("pending", "E")] }),
      envelope({ id: "2", status: "external", assignments: [assignment("matched")] }),
      envelope({ id: "3", status: "returned", assignments: [assignment("matched")] }),
      envelope({ id: "4", status: "assessor", assignments: [assignment("matched")] }),
      envelope({ id: "5", assignments: [] }),
    ]);
    expect(kpis).toEqual({
      total: 5,
      delivered: 2,
      inCustody: 3,
      active: 3,
      pendingMatch: 1,
      readyToDeliver: 2,
    });
  });

  it("is all zeros for an empty list", () => {
    expect(computeKeysKpis([])).toEqual({
      total: 0,
      delivered: 0,
      inCustody: 0,
      active: 0,
      pendingMatch: 0,
      readyToDeliver: 0,
    });
  });
});

describe("filterKeyEnvelopes", () => {
  const rows = [
    envelope({ id: "a", status: "reviewer", court: "جدة" }),
    envelope({ id: "b", status: "external", court: "مكة", referenceNumber: null }),
    envelope({
      id: "c",
      status: "returned",
      requestNumber: "REQ-77",
      assignments: [assignment("matched", "9988")],
    }),
  ];

  it("hides out-of-custody rows on «all» unless the eye is open", () => {
    expect(
      filterKeyEnvelopes(rows, { query: "", statusFilter: "all", showOut: false }).map((r) => r.id),
    ).toEqual(["a"]);
    expect(
      filterKeyEnvelopes(rows, { query: "", statusFilter: "all", showOut: true }).map((r) => r.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("a status filter shows exactly that custody, ignoring the eye", () => {
    expect(
      filterKeyEnvelopes(rows, { query: "", statusFilter: "external", showOut: false }).map((r) => r.id),
    ).toEqual(["b"]);
  });

  it("matches reference, request, court, circuit and deeds case-insensitively", () => {
    const opts = { statusFilter: "all" as const, showOut: true };
    expect(filterKeyEnvelopes(rows, { ...opts, query: " مكة " }).map((r) => r.id)).toEqual(["b"]);
    expect(filterKeyEnvelopes(rows, { ...opts, query: "req-77" }).map((r) => r.id)).toEqual(["c"]);
    expect(filterKeyEnvelopes(rows, { ...opts, query: "9988" }).map((r) => r.id)).toEqual(["c"]);
    expect(filterKeyEnvelopes(rows, { ...opts, query: "ke-2026-00007" })).toHaveLength(2);
  });

  it("search text falls back to the derived reference when unnumbered", () => {
    expect(envelopeSearchText(rows[1]!)).toContain("ENV-2026-");
  });
});

describe("mobile card projection", () => {
  it("picks the tone by custody, mismatch and scenario", () => {
    expect(envelopeCardTone(envelope({ status: "returned" }))).toBe("done");
    expect(envelopeCardTone(envelope({ countMismatch: true }))).toBe("returned");
    expect(envelopeCardTone(envelope({ receiveScenario: "court" }))).toBe("pending");
    expect(envelopeCardTone(envelope({ receiveScenario: "" }))).toBe("new");
  });

  it("describes court, request and counts, with fallbacks", () => {
    expect(
      envelopeCardMeta(envelope({ assignments: [assignment("pending")] })),
    ).toEqual([
      { text: "محكمة جدة", kind: "place" },
      { text: "طلب REQ-1", kind: "po" },
      { text: "2 مفاتيح · 1 صك", kind: "type" },
    ]);
    expect(
      envelopeCardMeta(envelope({ court: " ", requestNumber: "", circuit: "" })),
    ).toEqual([
      { text: "بدون محكمة", kind: "place" },
      { text: "—", kind: "po" },
      { text: "2 مفاتيح · 0 صك", kind: "type" },
    ]);
  });
});
