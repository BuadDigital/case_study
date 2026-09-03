import { describe, expect, it } from "vitest";
import {
  applyValuationReportLiveFill,
  buildValuationReportLiveFill,
  filterSpecialAssumptionBullets,
  resolveSpecialAssumptionBullets,
} from "../valuation-report-live-fill";
import { createEvaluatorDraft } from "../evaluator-window-data";

describe("filterSpecialAssumptionBullets", () => {
  it("returns null when library is empty (keep template)", () => {
    expect(filterSpecialAssumptionBullets([], [])).toBeNull();
    expect(filterSpecialAssumptionBullets(null, [true])).toBeNull();
  });

  it("defaults missing toggles to on and drops unchecked", () => {
    expect(
      filterSpecialAssumptionBullets(["أ", "ب", "ج"], [true, false]),
    ).toEqual(["أ", "ج"]);
    expect(filterSpecialAssumptionBullets(["أ", "ب"], [])).toEqual(["أ", "ب"]);
  });

  it("returns empty array when all unchecked", () => {
    expect(
      filterSpecialAssumptionBullets(["أ", "ب"], [false, false]),
    ).toEqual([]);
  });

  it("drops the no-specialist library clause when an external specialist is used", () => {
    const library = [
      "افتراض ESG",
      "لم يستعن المقيّم بأي أخصائي أو مؤسسة خدمات أثناء تنفيذ مهمة التقييم، وجميع الإجراءات والتحليلات اللازمة نُفّذت بواسطة فريق العمل بإدارة التقييم.",
      "ليست زائدة تنظيمية",
    ];
    expect(
      filterSpecialAssumptionBullets(library, [true, true, true], {
        dropNoSpecialistClause: true,
      }),
    ).toEqual(["افتراض ESG", "ليست زائدة تنظيمية"]);
  });
});

describe("resolveSpecialAssumptionBullets", () => {
  it("prefers selected assumptions from approach settings", () => {
    expect(
      resolveSpecialAssumptionBullets({
        selected: ["محفوظ 1", "محفوظ 2"],
        library: ["قديم 1", "قديم 2", "قديم 3"],
        toggles: [true, false, true],
      }),
    ).toEqual(["محفوظ 1", "محفوظ 2"]);
  });

  it("returns empty array when none selected", () => {
    expect(resolveSpecialAssumptionBullets({ selected: [] })).toEqual([]);
  });

  it("falls back to library toggles when selected is omitted", () => {
    expect(
      resolveSpecialAssumptionBullets({
        library: ["أ", "ب"],
        toggles: [true, false],
      }),
    ).toEqual(["أ"]);
  });
});

describe("§29 special assumption live fill", () => {
  it("prints selected assumptions from approach settings", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      selectedSpecialAssumptions: ["افتراض 1", "افتراض 3"],
    });
    expect(fill.specialAssumptionBullets).toEqual(["افتراض 1", "افتراض 3"]);

    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="29">
          <ul><li>قديم أ</li><li>قديم ب</li><li>قديم ج</li><li>قديم د</li></ul>
        </section>
      </body></html>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    expect(
      [...dom.querySelectorAll('[data-sec="29"] li')].map((li) => li.textContent),
    ).toEqual(["افتراض 1", "افتراض 3"]);
  });

  it("clears the list when selection is empty", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      selectedSpecialAssumptions: [],
    });
    expect(fill.specialAssumptionBullets).toEqual([]);

    const dom = new DOMParser().parseFromString(
      `<section data-sec="29"><ul><li>قديم</li></ul></section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    expect(dom.querySelectorAll('[data-sec="29"] li')).toHaveLength(0);
  });

  it("omits the no-specialist clause when a specialist is used", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    const fill = buildValuationReportLiveFill({
      draft,
      selectedSpecialAssumptions: [
        "افتراض ESG",
        "لم يستعن المقيّم بأي أخصائي أو مؤسسة خدمات أثناء تنفيذ مهمة التقييم، وجميع الإجراءات والتحليلات اللازمة نُفّذت بواسطة فريق العمل بإدارة التقييم.",
        "ليست زائدة تنظيمية",
      ],
      externalSpecialistUsed: true,
    });
    expect(fill.specialAssumptionBullets).toEqual([
      "افتراض ESG",
      "ليست زائدة تنظيمية",
    ]);
  });
});
