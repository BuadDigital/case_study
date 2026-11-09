import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileStack } from "../FileStack";

const rows = (names: string[]) => names.map((n) => <p key={n}>row:{n}</p>);

describe("FileStack", () => {
  it("shows a single file as it is, with no stack", () => {
    render(<FileStack names={["a.pdf"]}>{rows(["a.pdf"])}</FileStack>);
    expect(screen.getByText("row:a.pdf")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("folds two files or more into a closed stack naming the newest, and opens and closes it", () => {
    const names = ["a.pdf", "b.pdf", "c.pdf"];
    render(<FileStack names={names}>{rows(names)}</FileStack>);
    const toggle = screen.getByRole("button");
    expect(toggle.textContent).toContain("3 ملفات");
    expect(toggle.textContent).toContain("آخرها: c.pdf");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("row:a.pdf")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("row:a.pdf")).toBeTruthy();
    expect(screen.getByText("row:c.pdf")).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByText("row:a.pdf")).toBeNull();
  });
});
