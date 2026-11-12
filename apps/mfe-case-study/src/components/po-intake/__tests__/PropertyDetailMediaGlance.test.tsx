import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../PropertyLocationMapGlance", () => ({ PropertyLocationMapGlance: () => null }));
vi.mock("../PropertyDetailPhotosTab", () => ({ PropertyDetailPhotosTab: () => null }));
vi.mock("../../field-inspection/useInspectorPhotoDataUrl", () => ({
  useInspectorPhotoDataUrl: () => null,
}));

import { PropertyDetailMediaGlance } from "../PropertyDetailMediaGlance";

// Omar 2026-11-12: the system composes no description («أرض أرض، مساحة الأرض 123 م²، بحي …») — the
// strip shows the inspector's own text or nothing.
describe("PropertyDetailMediaGlance — «وصف العقار»", () => {
  it("shows no description box while there is no description and no fact", () => {
    render(<PropertyDetailMediaGlance />);
    expect(screen.queryByText("وصف العقار")).toBeNull();
    expect(screen.queryByText(/يُحدَّث/)).toBeNull();
  });

  it("shows the description it is handed, as written", () => {
    render(<PropertyDetailMediaGlance inspectorDescription="  أرض فضاء مسوّرة على شارعين  " />);
    expect(screen.getByText("وصف العقار")).toBeTruthy();
    expect(screen.getByText("أرض فضاء مسوّرة على شارعين")).toBeTruthy();
  });

  it("keeps the work order's facts when there is no description, without the «وصف العقار» line", () => {
    render(<PropertyDetailMediaGlance valueBasisLabel="القيمة السوقية" showCoordinates={false} />);
    expect(screen.queryByText("وصف العقار")).toBeNull();
    expect(screen.getByText("أساس القيمة المستخدم")).toBeTruthy();
    expect(screen.getByText("القيمة السوقية")).toBeTruthy();
  });
});
