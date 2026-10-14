import { describe, expect, it } from "vitest";
import {
  formatGregorianAsHijri,
  formatHijriDate,
  gregorianToHijri,
  hijriMonthNameAr,
  hijriToGregorian,
  hijriToGregorianIso,
  isValidGregorianDate,
  isValidHijriDate,
} from "../hijri";

/** Umm al-Qura reference days, including month and year boundaries. */
const PAIRS: [string, [number, number, number]][] = [
  ["2024-03-10", [1445, 8, 29]], // last day of a 29-day Sha'ban
  ["2024-03-11", [1445, 9, 1]], // 1 Ramadan
  ["2024-04-09", [1445, 9, 30]], // last day of a 30-day Ramadan
  ["2024-04-10", [1445, 10, 1]], // 1 Shawwal
  ["2024-07-06", [1445, 12, 30]], // last day of the year
  ["2024-07-07", [1446, 1, 1]], // 1 Muharram — year boundary
  ["2025-03-01", [1446, 9, 1]],
  ["2026-09-27", [1448, 4, 16]],
  ["2020-02-29", [1441, 7, 5]], // Gregorian leap day
  ["1900-01-01", [1317, 8, 29]],
  ["2077-01-01", [1500, 2, 6]],
];

describe("gregorianToHijri", () => {
  it.each(PAIRS)("%s → %j", (iso, [year, month, day]) => {
    expect(gregorianToHijri(iso)).toEqual({ year, month, day });
    const [y, m, d] = iso.split("-").map(Number);
    expect(gregorianToHijri({ year: y!, month: m!, day: d! })).toEqual({ year, month, day });
  });

  it.each([
    [new Date(2024, 2, 11, 0, 0, 0, 0), "local midnight"],
    [new Date(2024, 2, 11, 0, 0, 0, 1), "just after midnight"],
    [new Date(2024, 2, 11, 12, 0, 0, 0), "noon"],
    [new Date(2024, 2, 11, 23, 59, 59, 999), "just before the next midnight"],
  ])("a Date counts by its local day (%s)", (date) => {
    expect(gregorianToHijri(date)).toEqual({ year: 1445, month: 9, day: 1 });
  });

  it("reads only the day part of an ISO timestamp", () => {
    expect(gregorianToHijri("2024-03-11T23:30:00Z")).toEqual({ year: 1445, month: 9, day: 1 });
    expect(gregorianToHijri("2024-03-11T00:00:00")).toEqual({ year: 1445, month: 9, day: 1 });
  });

  it.each(["", "not a date", "2020-02-30", "2021-02-29", "2024-13-01", "2024-00-10", "11/03/2024"])(
    "rejects %j",
    (input) => {
      expect(gregorianToHijri(input)).toBeNull();
    },
  );

  it("rejects an invalid Date", () => {
    expect(gregorianToHijri(new Date(Number.NaN))).toBeNull();
  });
});

describe("hijriToGregorian", () => {
  it.each(PAIRS.filter(([, [y]]) => y >= 1300))("%s ← %j", (iso, [year, month, day]) => {
    expect(hijriToGregorianIso(year, month, day)).toBe(iso);
    const [y, m, d] = iso.split("-").map(Number);
    expect(hijriToGregorian(year, month, day)).toEqual({ year: y, month: m, day: d });
  });

  it("round-trips every day across a year boundary", () => {
    const cursor = new Date(2024, 5, 1, 12);
    for (let i = 0; i < 90; i += 1) {
      const h = gregorianToHijri(cursor)!;
      const back = hijriToGregorian(h.year, h.month, h.day)!;
      expect([back.year, back.month, back.day]).toEqual([
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        cursor.getDate(),
      ]);
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  it.each([
    [1445, 8, 30, "Sha'ban 1445 has 29 days"],
    [1445, 9, 31, "no month has 31 days"],
    [1445, 13, 1, "month 13"],
    [1445, 0, 1, "month 0"],
    [1445, 1, 0, "day 0"],
    [1299, 1, 1, "before the accepted range"],
    [1601, 1, 1, "after the accepted range"],
    [1445.5, 1, 1, "fractional year"],
  ])("rejects %i/%i/%i (%s)", (year, month, day) => {
    expect(hijriToGregorian(year, month, day)).toBeNull();
    expect(isValidHijriDate(year, month, day)).toBe(false);
  });

  it("accepts the 30th of a 30-day month", () => {
    expect(isValidHijriDate(1445, 9, 30)).toBe(true);
  });
});

describe("isValidGregorianDate", () => {
  it.each([
    [2020, 2, 29, true],
    [2020, 2, 30, false],
    [2021, 2, 29, false],
    [2024, 4, 31, false],
    [2024, 12, 31, true],
    [2024, 13, 1, false],
    [2024, 1, 0, false],
  ])("%i-%i-%i → %s", (y, m, d, ok) => {
    expect(isValidGregorianDate(y, m, d)).toBe(ok);
  });
});

describe("formatHijriDate", () => {
  const day = { year: 1448, month: 4, day: 16 };
  const early = { year: 1448, month: 1, day: 5 };

  it.each([
    [day, {}, "16/04/1448 هـ"],
    [early, {}, "05/01/1448 هـ"],
    [early, { digits: "arabic", order: "ymd", pad: false } as const, "١٤٤٨/١/٥ هـ"],
    [day, { digits: "arabic", order: "ymd", pad: false } as const, "١٤٤٨/٤/١٦ هـ"],
    [early, { order: "ymd" } as const, "1448/01/05 هـ"],
    [early, { pad: false, suffix: false }, "5/1/1448"],
    [day, { digits: "arabic" } as const, "١٦/٠٤/١٤٤٨ هـ"],
  ])("%j %j → %s", (parts, options, expected) => {
    expect(formatHijriDate(parts, options)).toBe(expected);
  });

  it("formatGregorianAsHijri converts then formats, with a fallback", () => {
    expect(
      formatGregorianAsHijri(new Date(2026, 8, 27, 0, 0), {
        digits: "arabic",
        order: "ymd",
        pad: false,
      }),
    ).toBe("١٤٤٨/٤/١٦ هـ");
    expect(formatGregorianAsHijri("2026-09-27")).toBe("16/04/1448 هـ");
    expect(formatGregorianAsHijri(new Date(Number.NaN))).toBe("—");
    expect(formatGregorianAsHijri("bad", {}, "")).toBe("");
  });
});

describe("hijriMonthNameAr", () => {
  it("names the month in Arabic", () => {
    expect(hijriMonthNameAr(1445, 9)).toBe("رمضان");
    expect(hijriMonthNameAr(1445, 13)).toBeNull();
  });
});
