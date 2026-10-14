import { describe, expect, it } from "vitest";
import {
  enfazInvoiceStatusLabel,
  enfazInvoiceStatusTone,
} from "../enfaz-invoice-status";

describe("enfazInvoiceStatusLabel", () => {
  it.each([
    ["issued", "صادرة"],
    ["partially_collected", "تحصيل جزئي"],
    ["collected", "محصّلة"],
    [null, "مُفوتَرة"],
    [undefined, "مُفوتَرة"],
    ["something-else", "مُفوتَرة"],
  ])("%s → %s", (status, label) => {
    expect(enfazInvoiceStatusLabel(status)).toBe(label);
  });
});

describe("enfazInvoiceStatusTone", () => {
  it.each([
    ["issued", false, "info"],
    ["partially_collected", false, "warning"],
    ["collected", false, "success"],
    [null, false, "default"],
    ["something-else", false, "default"],
    ["issued", true, "danger"],
    ["collected", true, "danger"],
  ] as const)("%s (overdue %s) → %s", (status, overdue, tone) => {
    expect(enfazInvoiceStatusTone(status, overdue)).toBe(tone);
  });
});
