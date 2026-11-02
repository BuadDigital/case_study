import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorCoordsInput } from "../InspectorCoordsInput";

function setup(value = "") {
  const onCoords = vi.fn();
  const onOutsideChange = vi.fn();
  render(<InspectorCoordsInput value={value} onCoords={onCoords} onOutsideChange={onOutsideChange} />);
  const box = screen.getByLabelText("الإحداثيات") as HTMLInputElement;
  fireEvent.focus(box);
  return { box, onCoords, onOutsideChange };
}

describe("the typed coordinates box", () => {
  it("saves a complete pair inside the Kingdom", () => {
    const { box, onCoords } = setup();
    fireEvent.change(box, { target: { value: "21.5233, 39.1877" } });
    expect(onCoords).toHaveBeenCalledWith("21.5233", "39.1877");
  });

  it("takes Arabic digits and the Arabic comma", () => {
    const { box, onCoords } = setup();
    fireEvent.change(box, { target: { value: "٢١٫٥٢٣٣، ٣٩٫١٨٧٧" } });
    expect(onCoords).toHaveBeenCalledWith("21.5233", "39.1877");
  });

  it("keeps a half-typed pair in the box without saving it", () => {
    const { box, onCoords } = setup("21.5, 39.1");
    fireEvent.change(box, { target: { value: "21.52" } });
    expect(onCoords).not.toHaveBeenCalled();
    expect(box.value).toBe("21.52");
  });

  it("refuses a pair outside the Kingdom and says so", () => {
    const { box, onCoords, onOutsideChange } = setup();
    fireEvent.change(box, { target: { value: "39.1877, 21.5233" } });
    expect(onCoords).not.toHaveBeenCalled();
    expect(onOutsideChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("alert").textContent).toContain("خارج المملكة");
  });
});
