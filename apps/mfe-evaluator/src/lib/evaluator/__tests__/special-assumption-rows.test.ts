import { describe, expect, it } from "vitest";
import {
  DEFAULT_NO_EXTERNAL_SPECIALIST_ASSUMPTION,
  EXTERNAL_SPECIALIST_USED_LABEL,
  assumptionsAfterSpecialistChoice,
  resolveNoSpecialistClause,
  specialAssumptionRows,
} from "../special-assumption-rows";

const noSpecialist = DEFAULT_NO_EXTERNAL_SPECIALIST_ASSUMPTION;

describe("specialAssumptionRows", () => {
  it("places the specialist-used item immediately above the no-specialist clause", () => {
    const rows = specialAssumptionRows([
      "ESG",
      "معاينة ظاهرية",
      noSpecialist,
      "ليست زائدة تنظيمية",
    ]);
    const labels = rows.map((row) =>
      row.kind === "specialist-used" ? EXTERNAL_SPECIALIST_USED_LABEL : row.text,
    );
    expect(labels).toEqual([
      "ESG",
      "معاينة ظاهرية",
      EXTERNAL_SPECIALIST_USED_LABEL,
      noSpecialist,
      "ليست زائدة تنظيمية",
    ]);
  });

  it("injects the default no-specialist clause when the library omits it", () => {
    const rows = specialAssumptionRows(["ESG"]);
    expect(rows.map((row) => row.kind)).toEqual([
      "clause",
      "specialist-used",
      "clause",
    ]);
    expect(rows[2]).toEqual({
      kind: "clause",
      key: noSpecialist,
      text: noSpecialist,
    });
  });
});

describe("assumptionsAfterSpecialistChoice", () => {
  it("keeps the two specialist options mutually exclusive", () => {
    expect(
      assumptionsAfterSpecialistChoice({
        specialistUsed: true,
        assumptions: ["ESG", noSpecialist],
        noSpecialistClause: noSpecialist,
      }),
    ).toEqual(["ESG"]);
    expect(
      assumptionsAfterSpecialistChoice({
        specialistUsed: false,
        assumptions: ["ESG"],
        noSpecialistClause: noSpecialist,
      }),
    ).toEqual(["ESG", noSpecialist]);
  });

  it("drops the specialist-used label if it was added as free text", () => {
    expect(
      assumptionsAfterSpecialistChoice({
        specialistUsed: true,
        assumptions: [EXTERNAL_SPECIALIST_USED_LABEL, "ESG"],
        noSpecialistClause: noSpecialist,
      }),
    ).toEqual(["ESG"]);
  });
});

describe("resolveNoSpecialistClause", () => {
  it("prefers the library wording when present", () => {
    const custom = "لم يستعن المقيّم بأي أخصائي خارجي في هذه المهمة.";
    expect(resolveNoSpecialistClause(["ESG", custom])).toBe(custom);
    expect(resolveNoSpecialistClause(["ESG"])).toBe(noSpecialist);
  });
});
