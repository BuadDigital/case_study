import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_PROPERTY_PHOTO_MARKS,
  type PropertyDetailDocumentEntry,
} from "@platform/app-shared/app-data/property-detail-document-types";
import { buildDisplayGroups, PropertyDetailPhotosTab } from "../PropertyDetailPhotosTab";

vi.mock("@platform/ui-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/ui-kit")>()),
  useToast: () => ({ showToast: vi.fn() }),
}));

const photo = (id: string, name: string): PropertyDetailDocumentEntry => ({
  id,
  name,
  fileName: `${id}.jpg`,
  source: "المعاين الميداني",
  kind: "image",
  attachmentId: id,
  documentTypeKey: "inspection-photo",
  dataUrl: "data:image/png;base64,AA==",
});

const photos = [
  photo("meter", "خدمة: كهرباء"),
  photo("water", "خدمة: ماء"),
  photo("front", "صور خارجية"),
  photo("back", "صور خارجية"),
];

const titles = (groups: ReturnType<typeof buildDisplayGroups>) =>
  groups.map((group) => [group.title, group.items.map((item) => item.id)]);

describe("the photos tab's sections", () => {
  it("shows the picked main photo first and gives water its own section", () => {
    expect(titles(buildDisplayGroups(photos))).toEqual([
      ["صورة العقار الرئيسية", ["front"]],
      ["صور العقار الخارجية", ["back"]],
      ["صور عدادات الكهرباء", ["meter"]],
      ["صور عدادات الماء", ["water"]],
    ]);
  });

  it("moves a marked photo to its mark's section", () => {
    const groups = buildDisplayGroups(photos, {
      ...EMPTY_PROPERTY_PHOTO_MARKS,
      main: "back",
      water: ["front"],
    });
    expect(titles(groups)).toEqual([
      ["صورة العقار الرئيسية", ["back"]],
      ["صور عدادات الكهرباء", ["meter"]],
      ["صور عدادات الماء", ["water", "front"]],
    ]);
  });
});

describe("marking a photo", () => {
  it("offers the icons only to the specialist, and shows the badge to everyone", () => {
    const marks = { ...EMPTY_PROPERTY_PHOTO_MARKS, electricity: ["meter"] };
    render(<PropertyDetailPhotosTab photos={photos} marks={marks} />);

    expect(screen.getByText("عداد كهرباء")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "الصورة الرئيسية" })).toBeNull();
    expect(screen.queryByText(/صور التقرير/)).toBeNull();
  });

  it("hands the pressed mark up without opening the preview", () => {
    const onToggleMark = vi.fn();
    render(
      <PropertyDetailPhotosTab
        photos={[photo("front", "صور خارجية")]}
        marks={EMPTY_PROPERTY_PHOTO_MARKS}
        onToggleMark={onToggleMark}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "في التقرير" }));

    expect(onToggleMark).toHaveBeenCalledWith("front", "report", ["front"]);
  });

  it("counts the report's photos", () => {
    render(
      <PropertyDetailPhotosTab
        photos={photos}
        marks={{ ...EMPTY_PROPERTY_PHOTO_MARKS, report: ["front", "gone"] }}
        onToggleMark={vi.fn()}
      />,
    );

    expect(screen.getByText(/صور التقرير/).textContent).toContain("1 / 12");
  });

  it("offers no icons on a photo that is not the inspector's", () => {
    const deed = { ...photo("deed", "صورة الصك"), source: "البيانات الأولية", documentTypeKey: undefined };
    const { container } = render(
      <PropertyDetailPhotosTab photos={[deed]} marks={EMPTY_PROPERTY_PHOTO_MARKS} onToggleMark={vi.fn()} />,
    );

    expect(within(container).queryByRole("button", { name: "عداد ماء" })).toBeNull();
  });
});
