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

describe("age hint (2026-11-10 — no invented 10 / 40 years)", () => {
  it("asks for both ages while either is empty", () => {
    const { unmount } = render(
      <CostAgeCard fields={{ ...EMPTY_COST_FIELDS, actualAge: "12" }} setField={() => {}} derived={derived} />,
    );
    expect(screen.getByTestId("cost-ages-missing-hint").textContent).toBe(
      "أدخل العمر الفعلي والعمر الاقتصادي لحساب الإهلاك",
    );
    unmount();
    render(
      <CostAgeCard
        fields={{ ...EMPTY_COST_FIELDS, actualAge: "12", economicAge: "40" }}
        setField={() => {}}
        derived={derived}
      />,
    );
    expect(screen.queryByTestId("cost-ages-missing-hint")).toBeNull();
  });
});
