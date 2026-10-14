import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tab, TabBar } from "../Tabs";

// jsdom has no layout: give each tab a box from its data attributes, and make the
// bar the tabs' offsetParent so the indicator can be placed.
const layout = (prop: "offsetLeft" | "offsetWidth" | "offsetTop" | "offsetHeight") =>
  function (this: HTMLElement) {
    const v = this.dataset[prop];
    return v ? Number(v) : 0;
  };

beforeEach(() => {
  for (const prop of ["offsetLeft", "offsetWidth", "offsetTop", "offsetHeight"] as const) {
    vi.spyOn(HTMLElement.prototype, prop, "get").mockImplementation(layout(prop));
  }
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.closest('[role="tablist"]');
  });
});
afterEach(() => vi.restoreAllMocks());

function Bar({ active, indicator }: { active: "a" | "b"; indicator?: boolean }) {
  return (
    <TabBar indicator={indicator}>
      <Tab active={active === "a"} data-offset-left="10" data-offset-width="60" data-offset-height="40">
        أ
      </Tab>
      <Tab active={active === "b"} data-offset-left="90" data-offset-width="80" data-offset-height="40">
        ب
      </Tab>
    </TabBar>
  );
}

const underline = () =>
  screen.getByRole("tablist").querySelector<HTMLElement>(":scope > span[aria-hidden]");

describe("TabBar indicator", () => {
  it("sits under the selected tab and follows the selection", () => {
    const { rerender } = render(<Bar active="a" />);
    expect(underline()?.style.width).toBe("60px");
    expect(underline()?.style.transform).toBe("translate(10px, 38px)");

    rerender(<Bar active="b" />);
    expect(underline()?.style.width).toBe("80px");
    expect(underline()?.style.transform).toBe("translate(90px, 38px)");
  });

  it("is left out for filled tab styles", () => {
    render(<Bar active="a" indicator={false} />);
    expect(underline()).toBeNull();
    // Without an indicator the selected tab keeps its own border.
    expect(screen.getByRole("tablist").dataset.indicator).toBeUndefined();
  });
});
