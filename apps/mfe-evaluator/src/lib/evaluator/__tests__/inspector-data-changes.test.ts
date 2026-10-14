import { describe, expect, it } from "vitest";
import type { PartyTaskSubmissionDto } from "@platform/api-client";
import {
  ASSET_TYPE_CHANGED_MESSAGE,
  assetTypeChangedNeedsReview,
  describeInspectorDataSync,
  inspectorAgeNeedsApply,
  inspectorChangedBannerState,
  inspectorChangedMessage,
  inspectorDataChangedLabels,
  inspectorDataGroupLabel,
  isInspectorDataFinal,
  mergeInspectorDataMeta,
} from "../inspector-data-changes";
import { dtoToSubmission, submissionPayload } from "../evaluator-submission-model";

describe("group labels", () => {
  it("maps every server group key to its Arabic label", () => {
    expect(inspectorDataGroupLabel("assetType")).toBe("نوع الأصل");
    expect(inspectorDataGroupLabel("components")).toBe("المكونات");
    expect(inspectorDataGroupLabel("area")).toBe("المساحات");
    expect(inspectorDataGroupLabel("age")).toBe("العمر");
    expect(inspectorDataGroupLabel("boundaries")).toBe("الحدود");
    expect(inspectorDataGroupLabel("location")).toBe("الموقع");
    expect(inspectorDataGroupLabel("photos")).toBe("الصور");
    expect(inspectorDataGroupLabel("narrative")).toBe("الوصف والملاحظات");
    expect(inspectorDataGroupLabel("services")).toBe("الخدمات");
  });

  it("keeps an unknown key as sent, drops blanks and duplicates", () => {
    expect(inspectorDataChangedLabels(["area", "area", " ", "future"])).toEqual([
      "المساحات",
      "future",
    ]);
    expect(inspectorDataChangedLabels(undefined)).toEqual([]);
  });
});

describe("inspectorChangedBannerState", () => {
  it("first open (no baseline yet) sets the baseline silently — never a banner", () => {
    expect(
      inspectorChangedBannerState({ fingerprint: "f1", seen: undefined, changedGroups: ["area"] }),
    ).toEqual({ kind: "baseline", fingerprint: "f1" });
    expect(
      inspectorChangedBannerState({ fingerprint: "f1", seen: "  ", changedGroups: [] }).kind,
    ).toBe("baseline");
  });

  it("shows the changed groups once a baseline exists", () => {
    const state = inspectorChangedBannerState({
      fingerprint: "f2",
      seen: "f1",
      changedGroups: ["components", "age"],
    });
    expect(state).toMatchObject({
      kind: "changed",
      fingerprint: "f2",
      groups: ["components", "age"],
      labels: ["المكونات", "العمر"],
    });
    expect(inspectorChangedMessage(["المكونات", "العمر"])).toBe(
      "تغيّرت بيانات المعاين منذ اطلاعك: المكونات، العمر",
    );
  });

  it("shows nothing without changes, without a fingerprint, or once the draft is locked", () => {
    expect(
      inspectorChangedBannerState({ fingerprint: "f1", seen: "f1", changedGroups: [] }).kind,
    ).toBe("none");
    expect(inspectorChangedBannerState({ fingerprint: "f1", seen: "f1" }).kind).toBe("none");
    expect(inspectorChangedBannerState({ seen: "f1", changedGroups: ["area"] }).kind).toBe("none");
    expect(
      inspectorChangedBannerState({
        fingerprint: "f2",
        seen: "f1",
        changedGroups: ["area"],
        locked: true,
      }).kind,
    ).toBe("none");
  });
});

describe("acknowledging (mergeInspectorDataMeta)", () => {
  const draft = {
    inspectorDataSeen: "f1",
    inspectorDataFingerprint: "f2",
    inspectorDataChangedGroups: ["area"],
    evaluatorPrice: "5",
  };

  it("a saved baseline equal to the fingerprint clears the groups and keeps the rest of the draft", () => {
    const next = mergeInspectorDataMeta(draft, { inspectorDataSeen: "f2" });
    expect(next).toMatchObject({
      inspectorDataSeen: "f2",
      inspectorDataFingerprint: "f2",
      inspectorDataChangedGroups: [],
      evaluatorPrice: "5",
    });
    expect(
      inspectorChangedBannerState({
        fingerprint: next.inspectorDataFingerprint,
        seen: next.inspectorDataSeen,
        changedGroups: next.inspectorDataChangedGroups,
      }).kind,
    ).toBe("none");
  });

  it("a plain fresh read never acknowledges: the baseline stays, the groups follow the server", () => {
    const next = mergeInspectorDataMeta(draft, {
      inspectorDataFingerprint: "f3",
      inspectorDataChangedGroups: ["area", "photos"],
    });
    expect(next.inspectorDataSeen).toBe("f1");
    expect(next.inspectorDataChangedGroups).toEqual(["area", "photos"]);
  });
});

describe("evaluator submission model carries the inspector-data fields", () => {
  const dto = (
    extra: Partial<PartyTaskSubmissionDto> = {},
    payload: Record<string, unknown> = {},
  ) =>
    ({
      id: "s1",
      taskId: "t1",
      kind: "property-appraisal",
      status: "draft",
      payload,
      updatedAtUtc: "2026-10-01T00:00:00Z",
      ...extra,
    }) as PartyTaskSubmissionDto;

  it("reads the server fields from the DTO and the baseline from the payload", () => {
    const sub = dtoToSubmission(
      dto(
        { inspectorDataFingerprint: "f2", inspectorDataChangedGroups: ["age"] },
        { inspectorDataSeen: "f1" },
      ),
    );
    expect(sub).toMatchObject({
      inspectorDataSeen: "f1",
      inspectorDataFingerprint: "f2",
      inspectorDataChangedGroups: ["age"],
    });
  });

  it("saves the baseline in the payload but never the server-computed fields", () => {
    const sub = dtoToSubmission(
      dto(
        { inspectorDataFingerprint: "f2", inspectorDataChangedGroups: ["age"] },
        { inspectorDataSeen: "f1" },
      ),
    )!;
    const payload = submissionPayload(sub);
    expect(payload.inspectorDataSeen).toBe("f1");
    expect("inspectorDataFingerprint" in payload).toBe(false);
    expect("inspectorDataChangedGroups" in payload).toBe(false);
  });
});

describe("age notice and approach settings", () => {
  it("offers the inspector's age only when the age group changed and the values differ", () => {
    expect(
      inspectorAgeNeedsApply({ changedGroups: ["age"], inspectorAgeYears: "12", enteredAgeYears: "10" }),
    ).toBe(true);
    expect(
      inspectorAgeNeedsApply({ changedGroups: ["age"], inspectorAgeYears: "12", enteredAgeYears: "" }),
    ).toBe(true);
    expect(
      inspectorAgeNeedsApply({ changedGroups: ["age"], inspectorAgeYears: "12", enteredAgeYears: "12.0" }),
    ).toBe(false);
    expect(
      inspectorAgeNeedsApply({ changedGroups: ["area"], inspectorAgeYears: "12", enteredAgeYears: "10" }),
    ).toBe(false);
    expect(
      inspectorAgeNeedsApply({ changedGroups: ["age"], inspectorAgeYears: "", enteredAgeYears: "10" }),
    ).toBe(false);
  });

  it("reminds about the asset type only once the approach settings were saved", () => {
    expect(ASSET_TYPE_CHANGED_MESSAGE).toBe("نوع الأصل تغيّر — راجع نطاق وأساليب التقييم");
    expect(assetTypeChangedNeedsReview({ changedGroups: ["assetType"], settingsSaved: true })).toBe(true);
    expect(assetTypeChangedNeedsReview({ changedGroups: ["assetType"], settingsSaved: false })).toBe(false);
    expect(assetTypeChangedNeedsReview({ changedGroups: ["age"], settingsSaved: true })).toBe(false);
    expect(assetTypeChangedNeedsReview({ changedGroups: undefined, settingsSaved: true })).toBe(false);
  });
});

describe("which inspector data is on screen", () => {
  it("labels a not-yet-submitted package as a draft and shows the last sync", () => {
    const info = describeInspectorDataSync({
      status: "draft",
      acceptedAtUtc: null,
      updatedAtUtc: "2026-10-01T09:30:00Z",
    });
    expect(info.draftLabel).toBe("بيانات المعاين (مسودة)");
    expect(info.syncedLabel).toMatch(/^آخر مزامنة للمعاين: /);
  });

  it("no draft label once submitted or accepted", () => {
    expect(
      describeInspectorDataSync({ status: "submitted", updatedAtUtc: "2026-10-01T09:30:00Z" }).draftLabel,
    ).toBeNull();
    expect(
      describeInspectorDataSync({
        status: "draft",
        acceptedAtUtc: "2026-10-02T00:00:00Z",
        updatedAtUtc: "2026-10-01T09:30:00Z",
      }).draftLabel,
    ).toBeNull();
    expect(isInspectorDataFinal({ status: "reopened" })).toBe(false);
  });

  it("returns nothing for a missing workspace and no sync line for a missing timestamp", () => {
    expect(describeInspectorDataSync(null)).toEqual({ draftLabel: null, syncedLabel: null });
    expect(describeInspectorDataSync({ status: "draft", updatedAtUtc: "" }).syncedLabel).toBeNull();
  });
});
