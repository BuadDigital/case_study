import { describe, expect, it, vi } from "vitest";
import { confirmIgnoringDoubleClick } from "../confirm-ignoring-double-click";

describe("confirmIgnoringDoubleClick", () => {
  it("opens the confirm once for a double-click and swallows its second click", async () => {
    let answer: (ok: boolean) => void = () => undefined;
    const confirm = vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve)));
    const backdrop = vi.fn();
    document.body.addEventListener("click", backdrop);

    const first = confirmIgnoringDoubleClick({ title: "اعتماد", message: "؟" }, confirm);
    // The second click of the double-click: on the button (a second call) and on the backdrop.
    expect(await confirmIgnoringDoubleClick({ title: "اعتماد", message: "؟" }, confirm)).toBeNull();
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(backdrop).not.toHaveBeenCalled();
    answer(true);
    expect(await first).toBe(true);

    // Once answered, clicks reach the page again and a new confirm can open.
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(backdrop).toHaveBeenCalledTimes(1);
    document.body.removeEventListener("click", backdrop);
    const again = confirmIgnoringDoubleClick({ title: "اعتماد", message: "؟" }, confirm);
    answer(false);
    expect(await again).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
