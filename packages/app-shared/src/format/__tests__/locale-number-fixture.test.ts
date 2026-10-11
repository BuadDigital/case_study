import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLocaleNumber } from "../number";

/**
 * The same cases the backend's LocaleNumber.TryParse is tested against
 * (tests/fixtures/locale-number-cases.json) — an area typed on screen must
 * read the same number the server stores and prices on.
 */
type Case = { input: string; expected: number | null };
const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests/fixtures/locale-number-cases.json"), "utf8"),
) as { cases: Case[] };

describe("parseLocaleNumber — shared fixture with the backend", () => {
  it.each(fixture.cases)("reads %j", ({ input, expected }) => {
    const n = parseLocaleNumber(input);
    if (expected === null) expect(Number.isNaN(n)).toBe(true);
    else expect(n).toBe(expected);
  });
});
