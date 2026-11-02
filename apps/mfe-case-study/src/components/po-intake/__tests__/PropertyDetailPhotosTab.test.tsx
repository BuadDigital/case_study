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

  it("puts a photo in the report section the specialist picks", () => {
    const onChangeMarks = vi.fn();
    const shown = [photo("front", "صور خارجية"), photo("inside", "صور داخلية · أخرى")];
    render(
      <PropertyDetailPhotosTab
        photos={shown}
        marks={EMPTY_PROPERTY_PHOTO_MARKS}
        onChangeMarks={onChangeMarks}
      />,
    );

    const add = screen.getByRole("button", { name: "إضافة إلى التقرير" });
    fireEvent.click(add);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitemradio", { name: /داخلية/ }).textContent).toContain("مقترح");
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: /أخرى/ }));

    const [sentPhotos, update] = onChangeMarks.mock.calls[0];
    expect(sentPhotos).toBe(shown);
    expect(update(EMPTY_PROPERTY_PHOTO_MARKS)).toMatchObject({
      report: ["inside"],
      reportSections: { inside: 3 },
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("prints the main photo by itself", () => {
    render(
      <PropertyDetailPhotosTab
        photos={[photo("front", "صور خارجية")]}
        marks={EMPTY_PROPERTY_PHOTO_MARKS}
        onChangeMarks={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "في التقرير تلقائياً" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("marks a photo as movables", () => {
    const onChangeMarks = vi.fn();
    render(
      <PropertyDetailPhotosTab
        photos={[photo("front", "صور خارجية")]}
        marks={EMPTY_PROPERTY_PHOTO_MARKS}
        onChangeMarks={onChangeMarks}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "منقولات" }));

    expect(onChangeMarks.mock.calls[0][1](EMPTY_PROPERTY_PHOTO_MARKS).movables).toEqual(["front"]);
  });

  it("counts the report's photos by section, the main photo and the meters with them", () => {
    render(
      <PropertyDetailPhotosTab
        photos={photos}
        marks={{ ...EMPTY_PROPERTY_PHOTO_MARKS, electricity: ["meter"], report: ["back", "gone"] }}
        reportLimit={24}
        onChangeMarks={vi.fn()}
      />,
    );

    expect(screen.getByText(/صور التقرير/).textContent).toBe(
      "صور التقرير 3 / 24 — خارجية 2 · داخلية 0 · أخرى 1",
    );
  });

  it("says the report picks by itself while nothing is picked", () => {
    render(
      <PropertyDetailPhotosTab
        photos={photos}
        marks={EMPTY_PROPERTY_PHOTO_MARKS}
        reportLimit={24}
        onChangeMarks={vi.fn()}
      />,
    );

    expect(screen.getByText(/صور التقرير/).textContent).toBe("صور التقرير: تلقائي (أول 24 صورة)");
  });

  it("offers no icons on a photo that is not the inspector's", () => {
    const deed = { ...photo("deed", "صورة الصك"), source: "البيانات الأولية", documentTypeKey: undefined };
    const { container } = render(
      <PropertyDetailPhotosTab photos={[deed]} marks={EMPTY_PROPERTY_PHOTO_MARKS} onChangeMarks={vi.fn()} />,
    );

    expect(within(container).queryByRole("button", { name: "عداد ماء" })).toBeNull();
  });
});

describe("the movables section", () => {
  it("holds the photos marked as movables and the inspector's movables photos", () => {
    const groups = buildDisplayGroups(
      [...photos, photo("sofa", "صورة توثيقية — منقولات")],
      { ...EMPTY_PROPERTY_PHOTO_MARKS, movables: ["back"] },
    );
    expect(titles(groups)).toContainEqual(["صور المنقولات", ["back", "sofa"]]);
  });
});
