import { describe, expect, it } from "vitest";
import type { PartyQuestionContribution } from "../case-study-party-answers";
import {
  applyInspectorAnswersToSpecialist,
  bourseAnswersForStudy,
  fillEmptySpecialistAnswers,
  inspectorAnswerFromContributions,
} from "../apply-inspector-answers-to-specialist";

function contrib(
  partyId: PartyQuestionContribution["partyId"],
  answer: PartyQuestionContribution["answer"],
): PartyQuestionContribution {
  return {
    partyId,
    partyName: "x",
    partyColor: "#000",
    assigneeName: "a",
    roleType: "primary",
    roleLabel: "أساسي",
    answer,
    taskId: "t1",
    taskKind: "field-inspection",
  };
}

describe("applyInspectorAnswersToSpecialist", () => {
  it("reads the inspector contribution", () => {
    expect(
      inspectorAnswerFromContributions([
        contrib("eng", "A"),
        contrib("insp", "B"),
      ]),
    ).toBe("B");
    expect(inspectorAnswerFromContributions([contrib("val", "A")])).toBeNull();
  });

  it("fills empty specialist answers from the inspector", () => {
    const { answers, changedKeys } = applyInspectorAnswersToSpecialist(
      { "deed:0": null, "deed:1": "A" },
      {
        "deed:0": [contrib("insp", "B")],
        "deed:1": [contrib("insp", "B")],
      },
    );
    expect(answers["deed:0"]).toBe("B");
    expect(answers["deed:1"]).toBe("A"); // specialist already chose — keep
    expect(changedKeys).toEqual(["deed:0"]);
  });

  it("follows inspector updates while still mirroring", () => {
    const { answers, changedKeys } = applyInspectorAnswersToSpecialist(
      { "deed:0": "A" },
      { "deed:0": [contrib("insp", "B")] },
      { "deed:0": "A" },
    );
    expect(answers["deed:0"]).toBe("B");
    expect(changedKeys).toEqual(["deed:0"]);
  });

  it("does not overwrite a specialist override", () => {
    const { answers, changedKeys } = applyInspectorAnswersToSpecialist(
      { "deed:0": "B" },
      { "deed:0": [contrib("insp", "A")] },
      { "deed:0": "A" },
    );
    expect(answers["deed:0"]).toBe("B");
    expect(changedKeys).toEqual([]);
  });
});

describe("deed questions the bourse already answered", () => {
  const bourse = (patch: Partial<Parameters<typeof bourseAnswersForStudy>[0] & object> = {}) => ({
    deedStatus: "فعال",
    ownershipType: "shared",
    restrictionsPresent: "yes",
    restrictionType: "mortgaged",
    ...patch,
  });

  it("reads deed status, ownership type and the «موقوف» restriction", () => {
    expect(bourseAnswersForStudy(bourse())).toEqual({ deed_0: "A", deed_9: "A", deed_6: "B" });
    expect(
      bourseAnswersForStudy(
        bourse({ deedStatus: "غير فعال", ownershipType: "absolute", restrictionType: "mortgaged,suspended" }),
      ),
    ).toEqual({ deed_0: "B", deed_9: "B", deed_6: "A" });
    expect(bourseAnswersForStudy(bourse({ deedStatus: "", ownershipType: "", restrictionsPresent: "" }))).toEqual({});
  });

  it("fills only empty cells", () => {
    const { answers, changedKeys } = fillEmptySpecialistAnswers(
      { deed_0: null, deed_9: "B" },
      { deed_0: "A", deed_9: "A" },
    );
    expect(answers).toEqual({ deed_0: "A", deed_9: "B" });
    expect(changedKeys).toEqual(["deed_0"]);
  });
});
