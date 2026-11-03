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
    const marks = { ...EMPTY_PROPERTY_PHOTO_MARKS, movables: ["meter"] };
    render(<PropertyDetailPhotosTab photos={photos} marks={marks} />);

    expect(screen.getByText("منقولات")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "الصورة الرئيسية" })).toBeNull();
    expect(screen.queryByRole("button", { name: "إضافة إلى التقرير" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^إزالة الصورة/ })).toBeNull();
  });

  const board = (report: string[]) => ({
    ...EMPTY_PROPERTY_PHOTO_MARKS,
    main: report[0] ?? null,
    report,
    reportOrdered: true,
  });
  const three = [photo("front", "صور خارجية"), photo("inside", "صور داخلية"), photo("hall", "صور داخلية")];

  it("opens the report board empty, slot 1 for the main photo, above the inspector's photos", () => {
    render(
      <PropertyDetailPhotosTab photos={photos} marks={EMPTY_PROPERTY_PHOTO_MARKS} reportLimit={24} onChangeMarks={vi.fn()} />,
    );

    const reportBoard = screen.getByRole("region", { name: "صور التقرير — ترتيب الأخصائي" });
    expect(reportBoard.textContent).toContain("0 / 24");
    expect(within(reportBoard).getAllByRole("button", { name: /فارغة$/ })).toHaveLength(24);
    expect(within(reportBoard).getByRole("button", { name: "خانة 1 فارغة" }).textContent).toContain("الرئيسية");
  });

  it("offers no meter or main-photo icons any more", () => {
    render(<PropertyDetailPhotosTab photos={photos} marks={EMPTY_PROPERTY_PHOTO_MARKS} onChangeMarks={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "عداد كهرباء" })).toBeNull();
    expect(screen.queryByRole("button", { name: "عداد ماء" })).toBeNull();
    expect(screen.queryByRole("button", { name: "الصورة الرئيسية" })).toBeNull();
  });

  it("puts a chosen photo in the next free slot, the first one becoming the main photo", () => {
    const onChangeMarks = vi.fn();
    render(<PropertyDetailPhotosTab photos={three} marks={EMPTY_PROPERTY_PHOTO_MARKS} onChangeMarks={onChangeMarks} />);

    fireEvent.click(screen.getAllByRole("button", { name: "إضافة إلى التقرير" })[1]!);

    expect(onChangeMarks.mock.calls[0][1](EMPTY_PROPERTY_PHOTO_MARKS)).toMatchObject({
      report: ["inside"],
      main: "inside",
      reportOrdered: true,
    });
  });

  it("replaces the tapped slot's photo with the next photo chosen", () => {
    const onChangeMarks = vi.fn();
    render(<PropertyDetailPhotosTab photos={three} marks={board(["front", "inside"])} onChangeMarks={onChangeMarks} />);

    fireEvent.click(screen.getByRole("button", { name: "خانة 2: صور داخلية" }));
    fireEvent.click(screen.getByRole("button", { name: "إضافة إلى التقرير" }));

    expect(onChangeMarks.mock.calls[0][1](board(["front", "inside"])).report).toEqual(["front", "hall"]);
  });

  it("swaps two slots tapped one after the other, slot 1 staying the main photo", () => {
    const onChangeMarks = vi.fn();
    const marks = board(["front", "inside", "hall"]);
    render(<PropertyDetailPhotosTab photos={three} marks={marks} onChangeMarks={onChangeMarks} />);

    fireEvent.click(screen.getByRole("button", { name: "خانة 1: صور خارجية" }));
    fireEvent.click(screen.getByRole("button", { name: "خانة 3: صور داخلية" }));

    expect(onChangeMarks.mock.calls[0][1](marks)).toMatchObject({
      report: ["hall", "inside", "front"],
      main: "hall",
    });
  });

  it("takes a photo off its slot", () => {
    const onChangeMarks = vi.fn();
    render(<PropertyDetailPhotosTab photos={three} marks={board(["front", "inside"])} onChangeMarks={onChangeMarks} />);

    fireEvent.click(screen.getByRole("button", { name: "إزالة الصورة من الخانة 1" }));

    expect(onChangeMarks.mock.calls[0][1](board(["front", "inside"]))).toMatchObject({
      report: ["inside"],
      main: "inside",
    });
  });

  it("refuses a photo once the board is full", () => {
    const onChangeMarks = vi.fn();
    render(<PropertyDetailPhotosTab photos={three} marks={board(["front"])} reportLimit={1} onChangeMarks={onChangeMarks} />);

    fireEvent.click(screen.getAllByRole("button", { name: "إضافة إلى التقرير" })[0]!);

    expect(onChangeMarks).not.toHaveBeenCalled();
  });

  it("opens the movables board only once the inspector found movables", () => {
    const onChangeMarks = vi.fn();
    const { rerender } = render(
      <PropertyDetailPhotosTab photos={three} marks={EMPTY_PROPERTY_PHOTO_MARKS} onChangeMarks={onChangeMarks} />,
    );
    expect(screen.queryByRole("region", { name: "صور المنقولات — قسم في التقرير" })).toBeNull();

    rerender(
      <PropertyDetailPhotosTab photos={three} marks={EMPTY_PROPERTY_PHOTO_MARKS} movablesPresent onChangeMarks={onChangeMarks} />,
    );
    const movables = screen.getByRole("region", { name: "صور المنقولات — قسم في التقرير" });
    expect(movables.textContent).toContain("0 / 6");
    fireEvent.click(screen.getAllByRole("button", { name: "إضافة إلى صور المنقولات" })[2]!);

    expect(onChangeMarks.mock.calls[0][1](EMPTY_PROPERTY_PHOTO_MARKS).movables).toEqual(["hall"]);
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
