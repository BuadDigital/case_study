import { describe, expect, it } from "vitest";
import {
  REQUEST_SUGGESTION_LIMIT,
  buildRegisterContact,
  buildRegisterEnvelopeInput,
  buildRequestSuggestions,
  feeNoticePresentation,
  filterRequestSuggestions,
  initialRegisterFormState,
  parseKeysCount,
  registerFormReducer,
  registerSuccessMessage,
  suggestionDeedSummary,
  validateRegisterForm,
  type FilePick,
  type RegisterFormState,
} from "../register-key-envelope-state";

function pick(attachmentId?: string): FilePick {
  return { file: new File(["x"], "a.jpg", { type: "image/jpeg" }), attachmentId };
}

function form(over: Partial<RegisterFormState> = {}): RegisterFormState {
  return { ...initialRegisterFormState(""), ...over };
}

/** A court draft that passes every check. */
function validCourt(over: Partial<RegisterFormState> = {}): RegisterFormState {
  return form({
    requestNumber: "REQ-9",
    photo: pick("ph"),
    receipt: pick("rc"),
    ...over,
  });
}

describe("registerFormReducer", () => {
  it("starts from the trimmed prefill with court defaults", () => {
    const state = initialRegisterFormState("  REQ-1 ");
    expect(state.requestNumber).toBe("REQ-1");
    expect(state.source).toBe("court");
    expect(state.keysCountActual).toBe("1");
    expect(state.keysCountLabeled).toBe("1");
    expect(state.photo).toBeNull();
  });

  it("sets text fields, source and error independently", () => {
    let state = registerFormReducer(form(), {
      type: "set-text",
      field: "partyName",
      value: "x",
    });
    state = registerFormReducer(state, { type: "set-source", source: "missing" });
    state = registerFormReducer(state, { type: "set-error", error: "e" });
    expect(state).toMatchObject({ partyName: "x", source: "missing", formError: "e" });
  });

  it("keeps labeled and actual counts in step", () => {
    const state = registerFormReducer(form(), { type: "set-keys-count", value: "4" });
    expect(state.keysCountLabeled).toBe("4");
    expect(state.keysCountActual).toBe("4");
  });

  it("picking a suggestion fills request, court, circuit and clears the error", () => {
    const state = registerFormReducer(form({ formError: "old" }), {
      type: "pick-suggestion",
      suggestion: {
        requestNumber: "R",
        court: "C",
        circuit: "D",
        deedCount: 1,
        sampleDeed: "1",
      },
    });
    expect(state).toMatchObject({
      requestNumber: "R",
      court: "C",
      circuit: "D",
      formError: "",
    });
  });

  it("linked defaults only fill blank court and circuit (typed values are trimmed)", () => {
    const state = registerFormReducer(form({ court: " typed ", circuit: "  " }), {
      type: "apply-linked-defaults",
      court: "from-api",
      circuit: "circ",
    });
    expect(state.court).toBe("typed");
    expect(state.circuit).toBe("circ");
  });

  it("stores and clears file picks per field", () => {
    const set = registerFormReducer(form(), {
      type: "set-pick",
      field: "receipt",
      pick: pick("id"),
    });
    expect(set.receipt?.attachmentId).toBe("id");
    const cleared = registerFormReducer(set, {
      type: "set-pick",
      field: "receipt",
      pick: null,
    });
    expect(cleared.receipt).toBeNull();
  });
});

describe("parseKeysCount", () => {
  it("parses integers and treats junk as zero", () => {
    expect(parseKeysCount("3")).toBe(3);
    expect(parseKeysCount("2.9")).toBe(2);
    expect(parseKeysCount("")).toBe(0);
    expect(parseKeysCount("abc")).toBe(0);
    expect(parseKeysCount("-1")).toBe(-1);
  });
});

describe("validateRegisterForm", () => {
  it("passes a complete court draft", () => {
    expect(validateRegisterForm(validCourt())).toBeNull();
  });

  it("checks the request number first", () => {
    expect(validateRegisterForm(form({ requestNumber: "  " }))).toBe(
      "رقم طلب إنفاذ مطلوب.",
    );
  });

  it("requires third-party name, phone and letter in order", () => {
    const base = form({ source: "third_party", requestNumber: "R" });
    expect(validateRegisterForm(base)).toBe("يلزم إدخال اسم الطرف المسلِّم.");
    expect(validateRegisterForm({ ...base, partyName: "n" })).toBe(
      "يلزم إدخال رقم جوال الطرف المسلِّم.",
    );
    expect(
      validateRegisterForm({ ...base, partyName: "n", partyPhone: "05" }),
    ).toBe("خطاب الطرف الثالث مطلوب.");
    expect(
      validateRegisterForm({
        ...base,
        partyName: "n",
        partyPhone: "05",
        thirdPartyLetter: pick("l"),
      }),
    ).toBeNull();
  });

  it("missing keys need contact phones and allow a zero count but not negative", () => {
    const base = form({ source: "missing", requestNumber: "R" });
    expect(validateRegisterForm(base)).toBe(
      "يلزم إدخال أرقام التواصل لسيناريو المفاتيح المفقودة.",
    );
    expect(
      validateRegisterForm({ ...base, missingPhones: "05", keysCountActual: "0" }),
    ).toBeNull();
    expect(
      validateRegisterForm({ ...base, missingPhones: "05", keysCountActual: "-2" }),
    ).toBe("عدد المفاتيح غير صالح.");
  });

  it("court needs at least one key, then the photo, then the receipt", () => {
    expect(validateRegisterForm(validCourt({ keysCountActual: "0" }))).toBe(
      "عدد المفاتيح الفعلي يجب أن يكون ١ على الأقل.",
    );
    expect(validateRegisterForm(validCourt({ photo: pick() }))).toBe(
      "صورة الظرف مطلوبة لإثبات أتعاب الاستلام.",
    );
    expect(validateRegisterForm(validCourt({ receipt: null }))).toBe(
      "خطاب الاستلام مطلوب لسيناريو المحكمة.",
    );
  });
});

describe("buildRegisterContact", () => {
  it("joins the third-party parts with their prefixes", () => {
    expect(
      buildRegisterContact(
        form({
          source: "third_party",
          partyName: " محمد ",
          partyOrg: "أبعاد",
          partyRole: "وكيل",
          partyPhone: "0500",
        }),
      ),
    ).toBe("محمد — ممثل أبعاد — بصفتها وكيل — 0500");
    expect(
      buildRegisterContact(
        form({ source: "third_party", partyName: "م", partyPhone: "05" }),
      ),
    ).toBe("م — 05");
  });

  it("uses the phones for missing keys and nothing for court", () => {
    expect(
      buildRegisterContact(form({ source: "missing", missingPhones: " 05 " })),
    ).toBe("05");
    expect(buildRegisterContact(form({ source: "court" }))).toBe("");
  });
});

describe("buildRegisterEnvelopeInput", () => {
  it("maps a court draft, defaulting blank court/circuit to «—»", () => {
    const input = buildRegisterEnvelopeInput(
      validCourt({ keysCountActual: "3", keysCountLabeled: "2", notes: "n" }),
      {
        operationsTaskId: " task ",
        linked: [
          {
            propertyId: "p1",
            poNumber: "PO",
            deedNumber: "D1",
            ownerName: "",
            city: "",
            court: "",
            circuit: "",
            requestNumber: "REQ-9",
          },
        ],
      },
    );
    expect(input).toEqual({
      requestNumber: "REQ-9",
      court: "—",
      circuit: "—",
      keysCountLabeled: 2,
      keysCountActual: 3,
      receiveScenario: "court",
      photoAttachmentId: "ph",
      receiptAttachmentId: "rc",
      thirdPartyLetterAttachmentId: undefined,
      contactPhones: "",
      notes: "n",
      operationsTaskId: "task",
      assignments: [{ deedNumber: "D1", propertyId: "p1" }],
    });
  });

  it("zeroes the counts for missing keys and drops a blank task id", () => {
    const input = buildRegisterEnvelopeInput(
      form({ source: "missing", requestNumber: "R", keysCountActual: "5" }),
      { operationsTaskId: "  ", linked: [] },
    );
    expect(input.keysCountActual).toBe(0);
    expect(input.keysCountLabeled).toBe(0);
    expect(input.operationsTaskId).toBeUndefined();
    expect(input.assignments).toEqual([]);
  });
});

describe("copy", () => {
  it("mentions the entitlement only when the API set it", () => {
    expect(registerSuccessMessage("R", false)).toBe("تم تسجيل الظرف R.");
    expect(registerSuccessMessage("R", true)).toBe(
      "تم تسجيل الظرف R وإثبات استحقاق أتعاب الاستلام من إنفاذ.",
    );
  });

  it("picks the fee notice by source and photo state", () => {
    expect(feeNoticePresentation("missing", false).ok).toBe(true);
    expect(feeNoticePresentation("court", true)).toMatchObject({
      ok: true,
      color: "#2f7a4d",
    });
    expect(feeNoticePresentation("court", false)).toMatchObject({
      ok: false,
      color: "#8a5e14",
    });
  });

  it("summarises the deed column of a suggestion", () => {
    expect(
      suggestionDeedSummary({
        requestNumber: "R",
        court: "",
        circuit: "",
        deedCount: 3,
        sampleDeed: "1",
      }),
    ).toBe("3 صكوك");
    expect(
      suggestionDeedSummary({
        requestNumber: "R",
        court: "",
        circuit: "",
        deedCount: 1,
        sampleDeed: "",
      }),
    ).toBe("صك —");
  });
});

describe("request suggestions", () => {
  it("indexes one entry per request, counts deeds, skips removed and blank", () => {
    const list = buildRequestSuggestions([
      {
        properties: [
          { requestNumber: "10", court: " c ", circuit: "d", deedNumber: "A" },
          { requestNumber: "10", court: "other", deedNumber: "B" },
          { requestNumber: "2", deedNumber: "Z" },
          { requestNumber: "", deedNumber: "skip" },
          { requestNumber: "3", isRemoved: true },
        ],
      },
      { properties: null },
    ]);
    expect(list).toEqual([
      { requestNumber: "2", court: "", circuit: "", deedCount: 1, sampleDeed: "Z" },
      { requestNumber: "10", court: "c", circuit: "d", deedCount: 2, sampleDeed: "A" },
    ]);
  });

  it("filters by substring and caps the list", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      requestNumber: `R${i}`,
      court: "",
      circuit: "",
      deedCount: 1,
      sampleDeed: "",
    }));
    expect(filterRequestSuggestions(many, "")).toHaveLength(
      REQUEST_SUGGESTION_LIMIT,
    );
    expect(filterRequestSuggestions(many, " R1 ").map((s) => s.requestNumber)).toEqual(
      ["R1", "R10", "R11", "R12", "R13", "R14", "R15", "R16", "R17", "R18", "R19"],
    );
  });
});
