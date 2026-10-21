import { describe, expect, it } from "vitest";
import {
  envelopeHolderLabelAr,
  keyHandedToInspectorText,
  keyLocationLabelAr,
} from "../property-key-custody";

const base = {
  keyHandedToInspector: "no",
  envelopeHolderKind: "reviewer",
  envelopeHolderUserId: "rev-1",
  envelopeHolderLabel: "سالم",
  keyLocation: "in_envelope",
  keyHolderUserId: null,
  keyHolderLabel: null,
};

describe("keyHandedToInspectorText (decision 2026-10-20)", () => {
  it("says yes when this deed's inspector holds the envelope", () => {
    const r = keyHandedToInspectorText(
      { ...base, envelopeHolderKind: "internal_user", envelopeHolderUserId: "ahmad", envelopeHolderLabel: "أحمد" },
      { id: "ahmad", name: "أحمد" },
    );
    expect(r).toEqual({ handed: true, text: "نعم — عند أحمد" });
  });

  it("never says yes for deed B while the envelope is with deed A's inspector", () => {
    const r = keyHandedToInspectorText(
      { ...base, keyHandedToInspector: "yes", envelopeHolderKind: "internal_user", envelopeHolderUserId: "ahmad", envelopeHolderLabel: "أحمد" },
      { id: "saad", name: "سعد" },
    );
    expect(r.handed).toBe(false);
    expect(r.text).toBe("الظرف عند أحمد (معاين صك آخر)");
  });

  it("says yes when the envelope went back but the deed's key stayed with its inspector", () => {
    const r = keyHandedToInspectorText(
      { ...base, keyLocation: "with_user", keyHolderUserId: "ahmad", keyHolderLabel: "أحمد" },
      { id: "ahmad", name: null },
    );
    expect(r).toEqual({ handed: true, text: "نعم — عند أحمد" });
  });

  it("names the key holder when the key is with someone else", () => {
    const r = keyHandedToInspectorText(
      { ...base, keyLocation: "with_user", keyHolderUserId: "ahmad", keyHolderLabel: "أحمد" },
      { id: "saad" },
    );
    expect(r).toEqual({ handed: false, text: "المفتاح عند أحمد" });
  });

  it("falls back to the legacy flag when nothing is with a user", () => {
    expect(keyHandedToInspectorText(base, null).text).toBe("لم يُسلَّم");
    expect(keyHandedToInspectorText({ ...base, keyHandedToInspector: "yes" }, null).text).toBe("تم التسليم");
    expect(keyHandedToInspectorText(null, null).text).toBe("لم تُحدَّد بعد");
  });
});

describe("labels", () => {
  it("names the envelope holder by kind", () => {
    expect(envelopeHolderLabelAr("reviewer", "")).toBe("المراجع الحكومي");
    expect(envelopeHolderLabelAr("internal_user", "أحمد")).toBe("أحمد");
    expect(envelopeHolderLabelAr("external", "شركة")).toBe("طرف خارجي: شركة");
    expect(envelopeHolderLabelAr("court", null)).toBe("المحكمة");
    expect(envelopeHolderLabelAr(undefined, null)).toBe("—");
  });

  it("names the key place", () => {
    expect(keyLocationLabelAr("in_envelope", null)).toBe("في الظرف");
    expect(keyLocationLabelAr("with_user", "أحمد")).toBe("عند أحمد");
    expect(keyLocationLabelAr("returned_court", null)).toBe("أُعيد للمحكمة");
    expect(keyLocationLabelAr("missing", null)).toBe("مفقود");
    expect(keyLocationLabelAr(null, null)).toBe("—");
  });
});
