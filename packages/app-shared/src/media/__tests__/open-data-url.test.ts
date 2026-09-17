import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dataUrlToBlobUrl, openDataUrlInNewTab } from "../open-data-url";

describe("dataUrlToBlobUrl", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => "blob:mock-url");
    vi.stubGlobal("URL", { ...URL, createObjectURL });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("decodes a base64 data URL into a blob URL, preserving the mime type", () => {
    const dataUrl = `data:image/png;base64,${btoa("hello")}`;
    const result = dataUrlToBlobUrl(dataUrl);
    expect(result).toBe("blob:mock-url");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe("hello".length);
  });

  it("returns null for a string that isn't a data URL", () => {
    expect(dataUrlToBlobUrl("https://example.com/photo.jpg")).toBeNull();
    expect(dataUrlToBlobUrl("")).toBeNull();
  });
});

describe("openDataUrlInNewTab", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens a data: URL as a blob: URL instead — browsers block direct data: navigation", () => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:mock-url" });
    const open = vi.spyOn(window, "open").mockReturnValue({} as Window);

    const opened = openDataUrlInNewTab(`data:image/jpeg;base64,${btoa("x")}`);

    expect(opened).toBe(true);
    expect(open).toHaveBeenCalledWith("blob:mock-url", "_blank", "noopener,noreferrer");
  });

  it("opens a non-data: URL unchanged", () => {
    const open = vi.spyOn(window, "open").mockReturnValue({} as Window);

    openDataUrlInNewTab("https://example.com/photo.jpg");

    expect(open).toHaveBeenCalledWith(
      "https://example.com/photo.jpg",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("reports failure when the popup is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(openDataUrlInNewTab("https://example.com/photo.jpg")).toBe(false);
  });
});
