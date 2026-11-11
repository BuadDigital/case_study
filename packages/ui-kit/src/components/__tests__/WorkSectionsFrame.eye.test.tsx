import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WorkSectionsLayout,
  sectionDomId,
  useWorkSections,
  type FrameSectionGroup,
} from "../WorkSectionsFrame";

// The rail's eye (Omar 2026-11-11): hides and shows the sections of the other sub-roles.

const SECTIONS = [
  { id: "intake", title: "البيانات الأولية", step: 0, group: "co" },
  { id: "study", title: "تقرير دراسة الحالة", step: 4, group: "st" },
  { id: "upload", title: "الرفع على إنفاذ", step: 6, group: "rv" },
] as const;
type Id = (typeof SECTIONS)[number]["id"];

function Page({ mineGroups }: { mineGroups?: readonly FrameSectionGroup[] }) {
  const state = useWorkSections<Id>({ sections: SECTIONS, step: 4, ready: true, mineGroups });
  return (
    <>
      <button type="button" onClick={() => state.openSection("study", true)}>
        عرض الدراسة
      </button>
      <WorkSectionsLayout
        sections={SECTIONS}
        step={4}
        state={state}
        railLabel="أقسام المعاملة"
        body={(id) => <p>محتوى {id}</p>}
      />
    </>
  );
}

const eye = () => screen.queryByTestId("rail-hide-others");
const card = (id: Id) => document.getElementById(sectionDomId(id)) as HTMLElement;
const shownCards = () => SECTIONS.map((s) => s.id).filter((id) => !card(id).hidden);
/** Presses a card's header: a folded card opens. */
const unfold = (id: Id) => fireEvent.click(card(id).querySelector("button")!);
/** Whether a card is unfolded — its header says so. */
const expanded = (id: Id) => card(id).querySelector("button")?.getAttribute("aria-expanded") === "true";
/** The rail's rows as «number title» — the tool buttons above the list are not rows. */
const railRows = () =>
  within(screen.getByRole("list"))
    .getAllByRole("button")
    .map((row) => row.textContent?.replace(/مكتمل|الإجراء الحالي|لم يبدأ/, "").trim());

beforeEach(() => {
  // jsdom has no layout, hence no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe("the page at entry", () => {
  it("opens with every section folded, whatever the step (Omar 2026-11-11)", () => {
    render(<Page mineGroups={["st"]} />);
    expect(SECTIONS.map((s) => expanded(s.id))).toEqual([false, false, false]);
    // Folded and not loaded: a body mounts the first time its section opens.
    expect(screen.queryByText("محتوى study")).toBeNull();
    unfold("study");
    expect(expanded("study")).toBe(true);
    expect(screen.getByText("محتوى study")).toBeTruthy();
  });

  it("keeps the section its link names folded, and picks it on the rail", () => {
    window.location.hash = "#work-upload";
    render(<Page mineGroups={["st"]} />);
    expect(SECTIONS.map((s) => expanded(s.id))).toEqual([false, false, false]);
    const picked = within(screen.getByRole("list"))
      .getAllByRole("button")
      .filter((row) => row.getAttribute("aria-current") === "location");
    expect(picked.map((row) => row.textContent)).toEqual([expect.stringContaining("الرفع على إنفاذ")]);
    window.location.hash = "";
  });
});

describe("the rail's eye", () => {
  it("shows every section at first, with the eye not pressed", () => {
    render(<Page mineGroups={["co"]} />);
    expect(shownCards()).toEqual(["intake", "study", "upload"]);
    expect(eye()?.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByTestId("rail-hidden-count")).toBeNull();
  });

  it("hides the other sub-roles' sections from the rail and the page, and shows them again", () => {
    render(<Page mineGroups={["st"]} />);
    fireEvent.click(eye()!);
    expect(shownCards()).toEqual(["study"]);
    // The section that stays keeps its number.
    expect(railRows()).toEqual(["2تقرير دراسة الحالة"]);
    expect(eye()?.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("rail-hidden-count").textContent).toContain("2");

    fireEvent.click(eye()!);
    expect(shownCards()).toEqual(["intake", "study", "upload"]);
    expect(railRows()).toHaveLength(3);
  });

  it("folds the cards left on show when it hides the others (Omar 2026-11-11)", () => {
    render(<Page mineGroups={["st"]} />);
    unfold("study");
    expect(expanded("study")).toBe(true);
    fireEvent.click(eye()!);
    expect(expanded("study")).toBe(false);
    // Folded, not unmounted: what was typed in it is still there.
    expect(screen.getByText("محتوى study")).toBeTruthy();

    // Showing every section again opens nothing by itself.
    fireEvent.click(eye()!);
    expect(expanded("study")).toBe(false);
  });

  it("leaves a hidden card as it was, for when it shows again", () => {
    render(<Page mineGroups={["co"]} />);
    unfold("study");
    fireEvent.click(eye()!);
    fireEvent.click(eye()!);
    expect(expanded("study")).toBe(true);
  });

  it("keeps a hidden section's body mounted, so a half-filled form survives", () => {
    render(<Page mineGroups={["co"]} />);
    // The study was opened; hiding it must not unmount it.
    unfold("study");
    expect(screen.getByText("محتوى study")).toBeTruthy();
    fireEvent.click(eye()!);
    expect(card("study").hidden).toBe(true);
    expect(screen.getByText("محتوى study")).toBeTruthy();
  });

  it("shows every section again when a hidden one is asked for", () => {
    render(<Page mineGroups={["co"]} />);
    fireEvent.click(eye()!);
    expect(shownCards()).toEqual(["intake"]);
    fireEvent.click(screen.getByRole("button", { name: "عرض الدراسة" }));
    expect(shownCards()).toEqual(["intake", "study", "upload"]);
    expect(eye()?.getAttribute("aria-pressed")).toBe("false");
  });

  it("stays pressed when the viewer's own section is asked for", () => {
    render(<Page mineGroups={["st"]} />);
    fireEvent.click(eye()!);
    fireEvent.click(screen.getByRole("button", { name: "عرض الدراسة" }));
    expect(shownCards()).toEqual(["study"]);
  });

  it("expands only the sections on show", () => {
    render(<Page mineGroups={["co"]} />);
    fireEvent.click(eye()!);
    fireEvent.click(screen.getByRole("button", { name: "توسيع جميع الأقسام" }));
    expect(screen.getByText("محتوى intake")).toBeTruthy();
    // The upload section was never opened — it is not loaded while hidden.
    expect(screen.queryByText("محتوى upload")).toBeNull();
  });

  it("has no eye where it would hide nothing — every sub-role held, or none", () => {
    const all = render(<Page mineGroups={["co", "st", "rv"]} />);
    expect(eye()).toBeNull();
    all.unmount();
    render(<Page />);
    expect(eye()).toBeNull();
  });
});
