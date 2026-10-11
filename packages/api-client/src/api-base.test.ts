import { describe, expect, it } from "vitest";
import { authHeaders } from "./api-base";

const JSON_TYPE = "application/json";

describe("authHeaders", () => {
  it("defaults to Content-Type + Authorization (most modules)", () => {
    expect(authHeaders("tok")).toStrictEqual({
      "Content-Type": JSON_TYPE,
      Authorization: "Bearer tok",
    });
  });

  it("adds Accept when asked (valuation / comparables modules)", () => {
    expect(authHeaders("tok", { accept: true })).toStrictEqual({
      Accept: JSON_TYPE,
      "Content-Type": JSON_TYPE,
      Authorization: "Bearer tok",
    });
  });

  it("sends only Authorization with json: false (reporting, field workspaces)", () => {
    expect(authHeaders("tok", { json: false })).toStrictEqual({
      Authorization: "Bearer tok",
    });
  });

  it("sends Accept without Content-Type for regions reads", () => {
    expect(authHeaders("tok", { accept: true, json: false })).toStrictEqual({
      Accept: JSON_TYPE,
      Authorization: "Bearer tok",
    });
  });

  it("adds the idempotency key when given, skips it when empty or missing", () => {
    expect(authHeaders("tok", { idempotencyKey: "idem-1" })).toStrictEqual({
      "Content-Type": JSON_TYPE,
      Authorization: "Bearer tok",
      "Idempotency-Key": "idem-1",
    });
    expect(authHeaders("tok", { idempotencyKey: "" })).toStrictEqual({
      "Content-Type": JSON_TYPE,
      Authorization: "Bearer tok",
    });
    expect(authHeaders("tok", { idempotencyKey: undefined })).toStrictEqual({
      "Content-Type": JSON_TYPE,
      Authorization: "Bearer tok",
    });
  });

  it("omits Authorization only for a missing token (push without a session)", () => {
    expect(authHeaders(undefined)).toStrictEqual({ "Content-Type": JSON_TYPE });
    expect(authHeaders(null)).toStrictEqual({ "Content-Type": JSON_TYPE });
    // An empty string still sends the header, exactly like the old builders did.
    expect(authHeaders("")).toStrictEqual({
      "Content-Type": JSON_TYPE,
      Authorization: "Bearer ",
    });
  });
});
