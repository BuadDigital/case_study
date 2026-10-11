import { describe, expect, it } from "vitest";
import { toLatinDigits } from "../../lib/arabic-digits";
import { parseLocaleNumber } from "../number";

describe("toLatinDigits", () => {
  it("maps Eastern Arabic and Persian digits", () => {
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("passes everything else through", () => {
    expect(toLatinDigits("م² 12a")).toBe("م² 12a");
  });
});

describe("parseLocaleNumber", () => {
  it.each<[string | number | null | undefined, number]>([
    // plain
    ["0", 0],
    ["1250", 1250],
    ["12.5", 12.5],
    [".5", 0.5],
    ["5.", 5],
    ["-3.25", -3.25],
    ["  42  ", 42],
    [42, 42],
    // thousands commas
    ["1,250", 1250],
    ["12,345,678", 12345678],
    ["-1,250", -1250],
    ["1,250.75", 1250.75],
    ["12,345,678.9", 12345678.9],
    // decimal comma
    ["12,5", 12.5],
    ["1,25", 1.25],
    ["0,5", 0.5],
    [",5", 0.5],
    ["1,2500", 1.25],
    ["-12,5", -12.5],
    // Arabic / Persian digits and separators
    ["١٢٥٠", 1250],
    ["۱۲۵۰", 1250],
    ["١٢٫٥", 12.5],
    ["١٬٢٥٠", 1250],
    ["١٬٢٥٠٫٥", 1250.5],
    ["١,٢٥٠", 1250],
    // units and spaces
    ["1,250 م²", 1250],
    ["1250م2", 1250],
    ["300 m²", 300],
    ["300m2", 300],
    ["15%", 15],
    ["15 %", 15],
    ["1,500,000 ر.س", 1500000],
    ["2500 ريال", 2500],
    ["1 250", 1250],
    ["1 250", 1250],
  ])("%j → %d", (raw, expected) => {
    expect(parseLocaleNumber(raw)).toBe(expected);
  });

  it.each<string | number | null | undefined>([
    "",
    "   ",
    null,
    undefined,
    "abc",
    "12abc",
    "1,2,3",
    "12,34,567",
    "1,,250",
    "-",
    ".",
    "1.2.3",
    "1-2",
    "م²",
    Number.NaN,
  ])("%j → NaN", (raw) => {
    expect(parseLocaleNumber(raw)).toBeNaN();
  });
});
