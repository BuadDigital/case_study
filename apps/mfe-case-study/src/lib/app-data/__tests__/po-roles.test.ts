import { describe, expect, it } from "vitest";
import {
  canDeletePo,
  canEditPoHeader,
  canEditProperty,
  canRaisePropertyFailure,
  canReceivePo,
} from "../po-roles";

describe("po-roles", () => {
  it("specialist can receive and edit property, not delete/header", () => {
    expect(canReceivePo("case-specialist")).toBe(true);
    expect(canEditProperty("case-specialist")).toBe(true);
    expect(canRaisePropertyFailure("case-specialist")).toBe(true);
    expect(canEditPoHeader("case-specialist")).toBe(false);
    expect(canDeletePo("case-specialist")).toBe(false);
  });

  it("supervisor can receive, edit header, delete; not property edit alone", () => {
    expect(canReceivePo("section-supervisor")).toBe(true);
    expect(canEditPoHeader("section-supervisor")).toBe(true);
    expect(canDeletePo("section-supervisor")).toBe(true);
    expect(canRaisePropertyFailure("section-supervisor")).toBe(true);
    expect(canEditProperty("section-supervisor")).toBe(false);
  });

  it("CDO receives full PO powers via super-admin", () => {
    expect(canReceivePo("cdo")).toBe(true);
    expect(canEditPoHeader("cdo")).toBe(true);
    expect(canEditProperty("cdo")).toBe(true);
    expect(canDeletePo("cdo")).toBe(true);
  });

  it("party roles cannot receive PO", () => {
    expect(canReceivePo("field-inspector")).toBe(false);
    expect(canReceivePo("engineering-office")).toBe(false);
    expect(canReceivePo("government-reviewer")).toBe(false);
    expect(canReceivePo("general-manager")).toBe(false);
  });
});
