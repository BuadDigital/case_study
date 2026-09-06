import { describe, expect, it } from "vitest";
import type { WorkOrderPropertyDto } from "@platform/api-client";
import { dtoToProperty, normalizeProperty } from "../po-intake-model";
import { emptyProperty } from "../po-intake-data";

/**
 * `normalizeProperty` spreads `PROPERTY_DEFAULTS` before the incoming object, so any
 * key present with an `undefined` value overwrites the default instead of falling back
 * to it. Every scalar in `dtoToProperty` therefore needs its own `?? ""`; `deedNumber`
 * was the one field missing it (docs/architecture/solid-scorecard.md, third-pass
 * follow-up). These tests pin the fallback so a malformed payload cannot reintroduce
 * `undefined` into a field the whole intake screen treats as a string.
 */
describe("dtoToProperty deed-number fallback", () => {
  function dtoWithoutDeedNumber(): WorkOrderPropertyDto {
    // A malformed payload: the server contract marks deedNumber required, but the
    // wire is not type-checked, so the mapper has to survive it missing.
    return {
      id: "prop-1",
      identifierType: "deed",
    } as unknown as WorkOrderPropertyDto;
  }

  it("maps a missing deedNumber to the empty-string default", () => {
    const property = dtoToProperty(dtoWithoutDeedNumber());

    expect(property.deedNumber).toBe("");
    expect(property.deedNumber).toBe(emptyProperty().deedNumber);
  });

  it("keeps deedNumber a string so string operations stay safe", () => {
    const property = dtoToProperty(dtoWithoutDeedNumber());

    expect(typeof property.deedNumber).toBe("string");
    expect(() => property.deedNumber.trim()).not.toThrow();
  });

  it("still carries a real deed number through untouched", () => {
    const property = dtoToProperty({
      ...dtoWithoutDeedNumber(),
      deedNumber: "310108041234",
    });

    expect(property.deedNumber).toBe("310108041234");
  });

  it("does not let an explicit undefined beat the default in normalizeProperty", () => {
    const property = normalizeProperty({
      ...emptyProperty(),
      deedNumber: undefined as unknown as string,
    });

    // Documents the spread order that made the missing `?? ""` a real bug:
    // defaults first, incoming object second.
    expect(property.deedNumber).toBeUndefined();
  });
});
