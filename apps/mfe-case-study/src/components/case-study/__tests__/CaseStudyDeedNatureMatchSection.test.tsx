import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { CaseStudyDeedNatureMatchSection } from "../CaseStudyDeedNatureMatchSection";

const { Matched, Differences } = DeedNatureMatchOutcomes;

function show(
  outcome: string,
  notes = "",
  over: Partial<Parameters<typeof CaseStudyDeedNatureMatchSection>[0]> = {},
) {
  const onPatch = vi.fn();
  render(
    <CaseStudyDeedNatureMatchSection
      draft={{ deedNatureMatchOutcome: outcome, deedNatureMatchNotes: notes }}
      onPatch={onPatch}
      {...over}
    />,
  );
  return onPatch;
}

const radio = (name: string) => screen.getByRole<HTMLInputElement>("radio", { name });
const notesBox = () => screen.queryByRole<HTMLTextAreaElement>("textbox");

describe("CaseStudyDeedNatureMatchSection", () => {
  it("closes the notes when the specialist goes back to the saved outcome (Omar 2026-11-19)", () => {
    const onPatch = show(Matched);
    fireEvent.click(radio("غير مطابق"));
    expect(radio("غير مطابق").checked).toBe(true);
    expect(notesBox()).not.toBeNull();

    fireEvent.click(radio("مطابق"));
    expect(radio("مطابق").checked).toBe(true);
    expect(notesBox()).toBeNull();
    expect(onPatch).not.toHaveBeenCalled();
  });

  it("saves «غير مطابق» once, with its notes", () => {
    const onPatch = show(Matched);
    fireEvent.click(radio("غير مطابق"));
    const save = screen.getByRole("button", { name: "حفظ «غير مطابق»" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(notesBox()!, { target: { value: "  الحد الشرقي 28 م  " } });
    fireEvent.click(save);
    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalledWith({ deedNatureMatchOutcome: Differences, deedNatureMatchNotes: "الحد الشرقي 28 م" });
  });

  it("saves «مطابق» on the click when nobody said «غير مطابق»", () => {
    const onPatch = show(Differences, "فرق");
    fireEvent.click(radio("مطابق"));
    expect(onPatch).toHaveBeenCalledWith({ deedNatureMatchOutcome: Matched, deedNatureMatchNotes: "" });
  });

  it("shows saved notes to read, and saves a change once — not on every keystroke", () => {
    const onPatch = show(Differences, "الحد الشرقي 28 م");
    expect(notesBox()).toBeNull();
    expect(screen.getByText("الحد الشرقي 28 م")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "تعديل" }));
    fireEvent.change(notesBox()!, { target: { value: "الحد الشرقي 30 م" } });
    expect(onPatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "حفظ «غير مطابق»" }));
    expect(onPatch).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalledWith({ deedNatureMatchOutcome: Differences, deedNatureMatchNotes: "الحد الشرقي 30 م" });
  });

  it("opens the notes at once for an outcome saved without them, with nothing to cancel back to", () => {
    show(Differences, "");
    expect(notesBox()).not.toBeNull();
    expect(screen.queryByRole("button", { name: "إلغاء" })).toBeNull();
  });

  it("asks for a reason before «مطابق» against the inspector, and lets it be changed later", () => {
    const onPatch = show(Differences, "فرق", { dissent: "inspector" });
    fireEvent.click(radio("مطابق"));
    const save = screen.getByRole("button", { name: "حفظ «مطابق»" });
    fireEvent.change(notesBox()!, { target: { value: "قصير" } });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(notesBox()!, { target: { value: "الرفع المساحي يؤكد الأطوال" } });
    fireEvent.click(save);
    expect(onPatch).toHaveBeenCalledWith({ deedNatureMatchOutcome: Matched, deedNatureMatchNotes: "الرفع المساحي يؤكد الأطوال" });
  });

  it("starts a new outcome's notes empty — one outcome's reason never becomes another's", () => {
    show(Differences, "فرق في الحد الشرقي");
    fireEvent.click(radio("تعذّر محتمل"));
    expect(notesBox()?.value).toBe("");
  });
});
