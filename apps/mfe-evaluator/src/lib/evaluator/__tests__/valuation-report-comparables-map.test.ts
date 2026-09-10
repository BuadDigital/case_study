import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildComparablesGoogleStaticMapUrl,
  buildComparablesMapSvgDataUrl,
  collectComparablesMapPins,
  materializeComparablesMapImage,
  materializePrintMapSlots,
  printMapsNotice,
  PRINT_MAP_SIZES,
  resolveComparablesMapImage,
} from "../valuation-report-comparables-map";
import {
  applyValuationReportLiveFill,
  buildValuationReportLiveFill,
} from "../valuation-report-live-fill";
import { createEvaluatorDraft } from "../evaluator-window-data";

describe("comparables map", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("collects subject and adopted comparable pins", () => {
    const pins = collectComparablesMapPins({
      subjectLat: "21.8",
      subjectLng: "39.1",
      comps: [
        { latitude: 21.81, longitude: 39.11, label: "1" },
        { latitude: 0, longitude: 0, label: "skip" },
      ],
    });
    expect(pins).toHaveLength(2);
    expect(pins[0]?.kind).toBe("subject");
    expect(pins[1]?.label).toBe("1");
  });

  it("builds an svg data url when pins exist", () => {
    const url = buildComparablesMapSvgDataUrl([
      { lat: 21.8, lng: 39.1, label: "العقار", kind: "subject" },
      { lat: 21.81, lng: 39.12, label: "1", kind: "comp" },
    ]);
    expect(url).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(url!.slice(url!.indexOf(",") + 1))).toContain(
      "العقار محل التقييم",
    );
  });

  it("prefers Google Static Maps when an API key is set", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-maps-key");
    const pins = [
      { lat: 21.8, lng: 39.1, label: "العقار", kind: "subject" as const },
      { lat: 21.81, lng: 39.12, label: "1", kind: "comp" as const },
    ];
    const resolved = resolveComparablesMapImage(pins);
    expect(resolved?.contentType).toBe("image/png");
    expect(resolved?.url).toContain("maps.googleapis.com/maps/api/staticmap");
    expect(resolved?.url).toContain("maptype=hybrid");
    expect(
      buildComparablesGoogleStaticMapUrl(pins, "test-maps-key"),
    ).toContain("key=test-maps-key");
  });

  it("adds center/zoom and a slot-matched size for fixed §33 views", () => {
    const pins = [
      { lat: 21.8, lng: 39.1, label: "العقار", kind: "subject" as const },
    ];
    const url = buildComparablesGoogleStaticMapUrl(
      pins,
      "test-maps-key",
      PRINT_MAP_SIZES.closeup,
      "satellite",
      { zoom: 18 },
    );
    expect(url).toContain("center=21.8%2C39.1");
    expect(url).toContain("zoom=18");
    expect(url).toContain("size=640x285");
    expect(url).toContain("scale=2");
    expect(url).toContain("maptype=satellite");
    // §18 lets Static Maps fit all markers — no center/zoom.
    const fit = buildComparablesGoogleStaticMapUrl(pins, "test-maps-key");
    expect(fit).not.toContain("zoom=");
    expect(fit).not.toContain("center=");
  });

  it("embeds Static Maps as a data URL when the fetch succeeds", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-maps-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
      ),
    );
    const pins = [
      { lat: 21.8, lng: 39.1, label: "العقار", kind: "subject" as const },
    ];
    const img = await materializeComparablesMapImage(pins);
    expect(img?.source).toBe("google-static");
    expect(img?.contentType).toBe("image/png");
    expect(img?.url.startsWith("data:image/png;base64,")).toBe(true);
    expect(img?.url).toContain("iVBORw0KGgo");
  });

  it("falls back to SVG with Google's reason when the key is not authorized", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-maps-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            "The Google Maps Platform server rejected your request. This API key is not authorized to use this service or API.",
            { status: 403 },
          ),
      ),
    );
    const pins = [
      { lat: 21.8, lng: 39.1, label: "العقار", kind: "subject" as const },
    ];
    const img = await materializeComparablesMapImage(pins);
    expect(img?.source).toBe("svg");
    expect(img?.contentType).toBe("image/svg+xml");
    expect(img?.url).toMatch(/^data:image\/svg\+xml/);
    expect(img?.denialReason).toContain("HTTP 403");
    expect(img?.denialReason).toContain("not authorized");
  });

  it("keeps the direct URL when fetch is blocked but <img> can load it", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-maps-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const pins = [
      { lat: 21.8, lng: 39.1, label: "العقار", kind: "subject" as const },
    ];
    const direct = await materializeComparablesMapImage(pins, {
      probeImage: async () => true,
    });
    expect(direct?.source).toBe("google-static-url");
    expect(direct?.url).toContain("/maps/api/staticmap");

    const dead = await materializeComparablesMapImage(pins, {
      probeImage: async () => false,
    });
    expect(dead?.source).toBe("svg");
    expect(dead?.denialReason).toContain("unreachable");
  });

  it("uses the schematic SVG without any API key", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const img = await materializeComparablesMapImage([
      { lat: 21.8, lng: 39.1, label: "العقار", kind: "subject" as const },
    ]);
    expect(img?.source).toBe("svg");
    expect(img?.denialReason).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("print map slots (§18 + §33)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const pins = [
    { lat: 21.8, lng: 39.1, label: "العقار", kind: "subject" as const },
    { lat: 21.81, lng: 39.12, label: "1", kind: "comp" as const },
    { lat: 21.79, lng: 39.08, label: "2", kind: "comp" as const },
  ];
  const uploaded = {
    attachmentId: "site-1",
    url: "data:image/png;base64,xx",
    contentType: "image/png",
    fileName: "site.png",
    labelAr: "خريطة الموقع",
    isImage: true,
  };
  const okPng = () =>
    new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { "content-type": "image/png" },
    });

  it("fills §18 and both §33 slots from Google Static Maps when the key is authorized", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-maps-key");
    const fetchMock = vi.fn(async (_url: string) => okPng());
    vi.stubGlobal("fetch", fetchMock);

    const r = await materializePrintMapSlots({
      pins,
      comparableMapSlot: null,
      satelliteMapSlot: null,
      closeupMapSlot: null,
    });
    expect(r.comparableMapSlot?.attachmentId).toBe("generated-comps-map");
    expect(r.comparableMapSlot?.url.startsWith("data:image/png;base64,")).toBe(true);
    expect(r.satelliteMapSlot?.attachmentId).toBe("generated-satellite-map");
    expect(r.satelliteMapSlot?.labelAr).toBe("خريطة الأقمار الصناعية");
    expect(r.closeupMapSlot?.attachmentId).toBe("generated-closeup-map");
    expect(r.closeupMapSlot?.labelAr).toBe("صورة مقربة للموقع");
    expect(r.diagnostics).toEqual({
      googleAvailable: true,
      attempted: true,
      wanted: true,
      denialReason: null,
      failureKind: null,
      directUrl: false,
      compsSchematic: false,
      satelliteMissing: false,
      closeupMissing: false,
    });

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(3);
    // §18: all three markers, auto-fit, comps slot size.
    const comps = urls.find((u) => !u.includes("zoom="))!;
    expect(comps).toContain("size=640x190");
    expect((comps.match(/markers=/g) ?? []).length).toBe(3);
    // §33: subject only, mirrored views of the on-screen maps.
    const sat = urls.find((u) => u.includes("zoom=15"))!;
    expect(sat).toContain("maptype=hybrid");
    expect(sat).toContain("center=21.8%2C39.1");
    expect((sat.match(/markers=/g) ?? []).length).toBe(1);
    const close = urls.find((u) => u.includes("zoom=18"))!;
    expect(close).toContain("maptype=satellite");
    expect(close).toContain("size=640x285");
    expect(printMapsNotice(r.diagnostics)).toBeNull();
  });

  it("keeps an uploaded site map, prints the SVG in §18 and leaves §33 blank on denial", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-maps-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("This API key is not authorized to use this service or API.", {
            status: 403,
          }),
      ),
    );

    const withUpload = await materializePrintMapSlots({
      pins,
      comparableMapSlot: uploaded,
      satelliteMapSlot: uploaded,
      closeupMapSlot: null,
    });
    expect(withUpload.comparableMapSlot).toBe(uploaded);
    expect(withUpload.satelliteMapSlot).toBe(uploaded);
    expect(withUpload.closeupMapSlot).toBeNull();
    expect(withUpload.diagnostics.googleAvailable).toBe(false);
    expect(withUpload.diagnostics.denialReason).toContain("HTTP 403");

    const generated = await materializePrintMapSlots({
      pins,
      comparableMapSlot: null,
      satelliteMapSlot: null,
      closeupMapSlot: null,
    });
    expect(generated.comparableMapSlot?.attachmentId).toBe("generated-comps-map");
    expect(generated.comparableMapSlot?.contentType).toBe("image/svg+xml");
    expect(generated.satelliteMapSlot).toBeNull();
    expect(generated.closeupMapSlot).toBeNull();
    expect(generated.diagnostics.failureKind).toBe("denied");
    expect(generated.diagnostics.compsSchematic).toBe(true);
    expect(generated.diagnostics.satelliteMissing).toBe(true);
    expect(generated.diagnostics.closeupMissing).toBe(true);
    const notice = printMapsNotice(generated.diagnostics);
    expect(notice).toContain("Maps Static API");
    expect(notice).toContain("Google Cloud Console");
    expect(notice).toContain("APIs & Services → Library → Maps Static API → Enable");
    expect(notice).toContain("تُطبع خريطة تخطيطية بديلة في البند 18 ويبقى البند 33 فارغًا");

    // With the upload in place the consequence sentence only names what is really missing.
    const uploadNotice = printMapsNotice(withUpload.diagnostics);
    expect(uploadNotice).toContain("Maps Static API");
    expect(uploadNotice).not.toContain("البند 18");
    expect(uploadNotice).toContain("تبقى الصورة المقربة في البند 33 فارغة");
  });

  it("explains a network failure without blaming the API key", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-maps-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const r = await materializePrintMapSlots({
      pins,
      comparableMapSlot: null,
      satelliteMapSlot: null,
      closeupMapSlot: null,
      probeImage: async () => false,
    });
    expect(r.diagnostics.failureKind).toBe("network");
    expect(r.diagnostics.googleAvailable).toBe(false);
    const notice = printMapsNotice(r.diagnostics)!;
    expect(notice).toContain("تعذّر الوصول");
    expect(notice).toContain("maps.googleapis.com");
    expect(notice).not.toContain("Google Cloud Console");
    expect(notice).toContain("البند 18");
  });

  it("records direct-URL slots when fetch is blocked but <img> loads", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-maps-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const r = await materializePrintMapSlots({
      pins,
      comparableMapSlot: null,
      satelliteMapSlot: null,
      closeupMapSlot: null,
      probeImage: async () => true,
    });
    expect(r.diagnostics.googleAvailable).toBe(true);
    expect(r.diagnostics.directUrl).toBe(true);
    expect(r.comparableMapSlot?.url).toContain("/maps/api/staticmap");
    expect(printMapsNotice(r.diagnostics)).toBeNull();
  });

  it("replaces stale generated slots but never an uploaded one", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-maps-key");
    vi.stubGlobal("fetch", vi.fn(async () => okPng()));
    const stale = {
      ...uploaded,
      attachmentId: "generated-comps-map",
      url: "data:image/svg+xml;charset=utf-8,old",
      contentType: "image/svg+xml",
    };
    const r = await materializePrintMapSlots({
      pins,
      comparableMapSlot: stale,
      satelliteMapSlot: null,
      closeupMapSlot: { ...stale, attachmentId: "generated-closeup-map" },
    });
    expect(r.comparableMapSlot?.contentType).toBe("image/png");
    expect(r.closeupMapSlot?.contentType).toBe("image/png");
  });

  it("does nothing without pins and reports a missing key", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await materializePrintMapSlots({
      pins: [],
      comparableMapSlot: null,
      satelliteMapSlot: null,
      closeupMapSlot: null,
    });
    expect(r.comparableMapSlot).toBeNull();
    expect(r.satelliteMapSlot).toBeNull();
    expect(r.closeupMapSlot).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    // No coordinates → nothing to explain, even without a key.
    expect(r.diagnostics.wanted).toBe(false);
    expect(printMapsNotice(r.diagnostics)).toBeNull();

    const withPins = await materializePrintMapSlots({
      pins,
      comparableMapSlot: null,
      satelliteMapSlot: null,
      closeupMapSlot: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(withPins.comparableMapSlot?.contentType).toBe("image/svg+xml");
    expect(withPins.satelliteMapSlot).toBeNull();
    expect(printMapsNotice(withPins.diagnostics)).toContain("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  });

  it("never falls back to the §18 comps map inside §33", () => {
    const fill = buildValuationReportLiveFill({
      draft: createEvaluatorDraft({
        taskId: "t1",
        propertyId: "p1",
        poNumber: "PO-1",
      }),
      inspector: { mapLatitude: "21.8", mapLongitude: "39.1" } as never,
    });
    expect(fill.comparableMapSlot).not.toBeNull();
    expect(fill.satelliteMapSlot).toBeNull();
    expect(fill.closeupMapSlot).toBeNull();

    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="18"><div id="map-comparables" style="width:100%;height:200px"></div></section>
        <section data-sec="33">
          <div id="map-satellite" style="width:100%;height:300px"></div>
          <div id="map-closeup" style="width:100%;height:300px"></div>
        </section>
      </body></html>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);

    expect(dom.querySelector('[data-sec="18"] img')).not.toBeNull();
    expect(dom.querySelector('[data-sec="33"] img')).toBeNull();
    const placeholders = [...dom.querySelectorAll('[data-sec="33"] .image-ph')].map(
      (el) => el.textContent?.trim(),
    );
    expect(placeholders).toEqual([
      "خريطة الأقمار الصناعية — تُرفق صورة الموقع",
      "صورة مقربة للموقع — تُرفق صورة",
    ]);
  });

  it("print fill puts the satellite slot in §33 upper and the close-up in §33 lower", () => {
    const fill = buildValuationReportLiveFill({
      draft: createEvaluatorDraft({
        taskId: "t1",
        propertyId: "p1",
        poNumber: "PO-1",
      }),
      inspector: { mapLatitude: "21.8", mapLongitude: "39.1" } as never,
    });
    expect(fill.satelliteMapSlot).toBeNull();
    expect(fill.closeupMapSlot).toBeNull();

    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="33">
          <div id="map-satellite" style="width:100%;height:300px"></div>
          <div id="map-closeup" style="width:100%;height:300px"></div>
        </section>
      </body></html>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, {
      ...fill,
      satelliteMapSlot: {
        ...uploaded,
        attachmentId: "generated-satellite-map",
        url: "data:image/png;base64,sat",
      },
      closeupMapSlot: {
        ...uploaded,
        attachmentId: "generated-closeup-map",
        url: "data:image/png;base64,close",
        labelAr: "صورة مقربة للموقع",
      },
    });
    expect(
      dom.querySelector('[data-slot-id="map-satellite"] img')?.getAttribute("src"),
    ).toBe("data:image/png;base64,sat");
    expect(
      dom.querySelector('[data-slot-id="map-closeup"] img')?.getAttribute("src"),
    ).toBe("data:image/png;base64,close");
    expect(
      dom.querySelector('[data-slot-id="map-closeup"] figcaption')?.textContent,
    ).toBe("صورة مقربة للموقع");
  });
});

describe("search notes and comparable map live fill", () => {
  const draft = () =>
    createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });

  it("fills §18 map and §28 notes + research bullets", () => {
    const d = draft();
    d.searchScopeNotes = "اعتمدنا على مكاتب الحي فقط";
    const fill = buildValuationReportLiveFill({
      draft: d,
      inspector: {
        mapLatitude: "21.800029",
        mapLongitude: "39.093016",
      } as never,
      market: {
        items: [
          {
            isAdopted: true,
            sortOrder: 1,
            comparable: {
              comparablePropertyType: "فيلا",
              latitude: 21.81,
              longitude: 39.1,
              areaSqm: 400,
              transactionDate: "2026-01-01",
              price: 1_000_000,
              pricePerSqm: 2500,
            },
          },
        ],
      } as never,
      researchScopeText: "مصدر أ\nمصدر ب",
    });

    expect(["image/svg+xml", "image/png"]).toContain(
      fill.comparableMapSlot?.contentType,
    );
    expect(fill.searchScopeNotes).toBe("اعتمدنا على مكاتب الحي فقط");
    expect(fill.researchScopeBullets).toEqual(["مصدر أ", "مصدر ب"]);

    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="18">
          <div id="map-comparables" class="image-ph">ph</div>
        </section>
        <section data-sec="28">
          <ul><li>قديم</li></ul>
        </section>
      </body></html>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);

    expect(dom.querySelector("#map-comparables")).toBeNull();
    const imgSrc = dom.querySelector('[data-sec="18"] img')?.getAttribute("src") ?? "";
    expect(
      imgSrc.startsWith("data:image/svg+xml") ||
        imgSrc.includes("maps.googleapis.com/maps/api/staticmap"),
    ).toBe(true);
    const lis = [...dom.querySelectorAll('[data-sec="28"] li')].map(
      (li) => li.textContent,
    );
    expect(lis).toEqual(["مصدر أ", "مصدر ب"]);
    expect(
      dom.querySelector(".search-scope-notes td.v")?.textContent,
    ).toBe("اعتمدنا على مكاتب الحي فقط");
  });

  it("prefers uploaded site map over generated svg", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      inspector: {
        mapLatitude: "21.8",
        mapLongitude: "39.1",
      } as never,
      siteMapSlot: {
        attachmentId: "site-1",
        url: "data:image/png;base64,xx",
        contentType: "image/png",
        fileName: "hybrid.png",
        labelAr: "خريطة الموقع",
        isImage: true,
      },
    });
    expect(fill.comparableMapSlot?.attachmentId).toBe("site-1");
    expect(fill.comparableMapSlot?.contentType).toBe("image/png");
  });

  it("highlights the selected finishing level column in §12", () => {
    const d = draft();
    d.reportChoices = {
      ...d.reportChoices!,
      finishingLevel: "medium",
    };
    const fill = buildValuationReportLiveFill({
      draft: d,
      finishingMediumText:
        "تشطيبات خارجية: نص متوسط\nتشطيبات داخلية: داخلي متوسط",
    });
    expect(fill.finishingLevel).toBe("medium");

    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="12">
          <table class="mx">
            <tr><th>تشطيب فاخر</th><th>تشطيب متوسط</th><th>تشطيب عادي</th></tr>
            <tr><td class="v">فاخر</td><td class="v">متوسط</td><td class="v">عادي</td></tr>
            <tr><th colspan="3">بدون تشطيب</th></tr>
          </table>
        </section>
      </body></html>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);

    const headers = [
      ...dom.querySelectorAll("[data-sec=\"12\"] tr:first-child th"),
    ];
    expect((headers[0] as HTMLElement)?.style.display).toBe("none");
    expect((headers[2] as HTMLElement)?.style.display).toBe("none");
    expect((headers[1] as HTMLElement)?.style.display).not.toBe("none");
    expect(headers[1]?.textContent).not.toContain("✓");
    const midCell = dom.querySelectorAll(
      "[data-sec=\"12\"] tr:nth-child(2) td",
    )[1];
    expect((midCell as HTMLElement)?.style.display).not.toBe("none");
    expect(midCell?.innerHTML).toContain("تشطيبات خارجية");
  });

  it("shows only بدون تشطيب when finishingLevel is none", () => {
    const d = draft();
    d.reportChoices = { ...d.reportChoices!, finishingLevel: "none" };
    const fill = buildValuationReportLiveFill({ draft: d });
    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="12">
          <table>
            <tr><th>تشطيب فاخر</th><th>تشطيب متوسط</th><th>تشطيب عادي</th></tr>
            <tr><td>a</td><td>b</td><td>c</td></tr>
            <tr><th colspan="3">بدون تشطيب</th></tr>
          </table>
        </section>
      </body></html>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    const none = [...dom.querySelectorAll("[data-sec=\"12\"] th")].find((th) =>
      (th.textContent ?? "").includes("بدون"),
    );
    expect(none?.textContent).not.toContain("✓");
    const headerRow = dom.querySelector("[data-sec=\"12\"] tr:first-child");
    expect((headerRow as HTMLElement)?.style.display).toBe("none");
  });
});
