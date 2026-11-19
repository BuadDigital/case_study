import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroIconButton } from "../HeroIconButton";

const PATH = "M0 0h24v24H0z";

// Omar 2026-11-18: the icon opens the newest version; shaded until approved; version above 1 in the corner.
describe("HeroIconButton — report versions", () => {
  it("is disabled with nothing to open, clickable but shaded as a draft, and plain once approved", () => {
    const { rerender } = render(
      <HeroIconButton iconPath={PATH} label="تقرير" state="none" compact={false} onClick={() => {}} testId="b" />,
    );
    expect((screen.getByTestId("b") as HTMLButtonElement).disabled).toBe(true);

    rerender(<HeroIconButton iconPath={PATH} label="تقرير" state="draft" compact={false} onClick={() => {}} testId="b" />);
    const draft = screen.getByTestId("b") as HTMLButtonElement;
    expect(draft.disabled).toBe(false);
    expect(draft.className).toContain("border-dashed");

    rerender(<HeroIconButton iconPath={PATH} label="تقرير" state="approved" compact={false} onClick={() => {}} testId="b" />);
    expect(screen.getByTestId("b").className).not.toContain("border-dashed");
  });

  it("shows the version only above 1", () => {
    const { rerender } = render(
      <HeroIconButton iconPath={PATH} label="تقرير" state="approved" badge={1} compact={false} onClick={() => {}} testId="b" />,
    );
    expect(screen.getByTestId("b").textContent).toBe("");

    rerender(
      <HeroIconButton iconPath={PATH} label="تقرير" state="approved" badge={2} compact={false} onClick={() => {}} testId="b" />,
    );
    expect(screen.getByTestId("b").textContent).toBe("2");
    expect(screen.getByTestId("b").getAttribute("aria-label")).toBe("تقرير — النسخة 2");
  });

  it("keeps the deed button's ready flag", () => {
    render(<HeroIconButton iconPath={PATH} label="الصك" ready compact onClick={() => {}} testId="deed" />);
    expect((screen.getByTestId("deed") as HTMLButtonElement).disabled).toBe(false);
  });
});
