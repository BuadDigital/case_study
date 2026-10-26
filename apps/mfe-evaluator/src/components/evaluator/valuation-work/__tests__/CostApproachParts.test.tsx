import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CostAgeCard, CostIndirectCard } from "../CostApproachParts";
import { EMPTY_COST_FIELDS, costApproachDerived } from "../lib/cost-approach-state";

const derived = costApproachDerived(EMPTY_COST_FIELDS, 0, null, true);

describe("cost rationale boxes (round 2 — 20px/55px wide at 1440px)", () => {
  it("each age / obsolescence rationale takes a full line on a desktop", () => {
    render(<CostAgeCard fields={EMPTY_COST_FIELDS} setField={() => {}} derived={derived} />);
    const box = screen.getByRole("textbox", { name: "مبرر التقادم الوظيفي (٪)" });
    expect(box.className).toContain("lg:basis-full");
    expect(box.parentElement?.className).toContain("flex-wrap");
  });

  it("each indirect-cost rationale takes a full line on a desktop", () => {
    render(
      <CostIndirectCard
        fields={EMPTY_COST_FIELDS}
        setField={() => {}}
        setIndirect={() => {}}
        directTotal={0}
        derived={derived}
      />,
    );
    const boxes = screen.getAllByPlaceholderText("مبرر النسبة…");
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(box.className).toContain("lg:basis-full");
  });
});
