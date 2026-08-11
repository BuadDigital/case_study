import type { PropertyDetailPartySubmission } from "./property-detail-party-submission-types";
import type { PropertyDetailPartySubmissionsMap } from "./property-detail-party-submissions";

/** Failure-like shape used for the property-detail «تعذرات» tab. */
export type PropertyDetailFailureSignal = {
  id: string;
  status: string;
  updatedAt?: string;
};

/** Fee-ledger row signal for the «المالية» tab. */
export type PropertyDetailFeeSignal = {
  workflowTaskId: string;
  billingStatus: string;
  updatedAtUtc?: string | null;
};

/** Timeline row signal for the «السجل» tab. */
export type PropertyDetailLogSignal = {
  id: string;
  at: string;
};

export type PropertyDetailTabActivity = Record<string, string | null>;

function packageNeedsAttention(
  sub: PropertyDetailPartySubmission | null | undefined,
): string | null {
  if (!sub?.hasData) return null;
  const status = (sub.packageStatus ?? "").trim().toLowerCase();
  const accepted =
    typeof sub.acceptedAtUtc === "string" && sub.acceptedAtUtc.trim().length > 0;
  // Party sent work / needs review or return-in-flight
  if (status === "submitted" && !accepted) {
    return `pkg:submitted:${sub.submittedAtUtc ?? ""}`;
  }
  if (status === "reopened") {
    return `pkg:reopened:${sub.submittedAtUtc ?? ""}`;
  }
  return null;
}

function joinTokens(...parts: Array<string | null | undefined>): string | null {
  const kept = parts.filter((p): p is string => Boolean(p && p.length > 0));
  if (kept.length === 0) return null;
  return kept.sort().join("|");
}

const FEE_ATTENTION = new Set([
  "at-finance",
  "deferred",
  "returned",
  "inquiry",
  "disputed",
  "sup-review",
  "office-review",
]);

/**
 * Builds a per-tab activity fingerprint. When the token changes (and is not yet
 * marked seen for that property), the tab shows the small red “new” dot.
 *
 * `null` = no attention-worthy activity → never show a red dot on that tab.
 */
export function buildPropertyDetailTabActivity(input: {
  parties?: PropertyDetailPartySubmissionsMap | null;
  failures?: PropertyDetailFailureSignal[];
  feeRows?: PropertyDetailFeeSignal[];
  logEvents?: PropertyDetailLogSignal[];
  keysStatus?: string | null;
  governmentReviewTaskStatus?: string | null;
  governmentReviewUpdatedAt?: string | null;
  hasLinkedPriors?: boolean;
  linkedUpdatedToken?: string | null;
  propertyUpdatedToken?: string | null;
}): PropertyDetailTabActivity {
  const survey = packageNeedsAttention(input.parties?.survey);
  const inspection = packageNeedsAttention(input.parties?.inspection);
  const appraisal = packageNeedsAttention(input.parties?.appraisal);
  const specialist = packageNeedsAttention(input.parties?.specialist);

  const notesParts: string[] = [];
  for (const role of ["survey", "inspection", "appraisal"] as const) {
    const sub = input.parties?.[role];
    if (!sub?.hasData) continue;
    if ((sub.remarks?.length ?? 0) === 0) continue;
    const st = (sub.packageStatus ?? "").toLowerCase();
    if (st === "submitted" || st === "reopened" || Boolean(sub.acceptedAtUtc)) {
      notesParts.push(
        `${role}:${sub.remarks!.length}:${sub.submittedAtUtc ?? ""}`,
      );
    }
  }
  const surveyNotes =
    notesParts.length > 0 ? `notes:${notesParts.sort().join(",")}` : null;

  const openFailures = (input.failures ?? []).filter((f) => {
    const s = f.status.trim().toLowerCase();
    return s !== "approved" && s !== "resolved" && s !== "rejected";
  });
  const failures =
    openFailures.length > 0
      ? `fail:${openFailures
          .map((f) => `${f.id}:${f.updatedAt ?? f.status}`)
          .sort()
          .join(",")}`
      : null;

  const feeHits = (input.feeRows ?? []).filter((r) =>
    FEE_ATTENTION.has((r.billingStatus ?? "").trim().toLowerCase()),
  );
  const finance =
    feeHits.length > 0
      ? `fee:${feeHits
          .map(
            (r) =>
              `${r.workflowTaskId}:${r.billingStatus}:${r.updatedAtUtc ?? ""}`,
          )
          .sort()
          .join(",")}`
      : null;

  const newestLog = (input.logEvents ?? [])
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const log = newestLog ? `log:${newestLog.id}:${newestLog.at}` : null;

  const keysRaw = (input.keysStatus ?? "").trim().toLowerCase();
  const keys =
    keysRaw &&
    keysRaw !== "available" &&
    keysRaw !== "متاح" &&
    keysRaw !== "none" &&
    keysRaw !== "—"
      ? `keys:${keysRaw}`
      : null;

  const govStatus = (input.governmentReviewTaskStatus ?? "")
    .trim()
    .toLowerCase();
  const government =
    govStatus === "open" ||
    govStatus === "in_progress" ||
    govStatus === "submitted" ||
    govStatus === "returned" ||
    govStatus === "blocked"
      ? `gov:${govStatus}:${input.governmentReviewUpdatedAt ?? ""}`
      : null;

  // documents / photos roll up party packages that carried uploads
  const documents = joinTokens(survey, inspection, appraisal);
  const photos = inspection; // photos arrive with inspection package

  // report / enfath: pending review material vs accepted stamps for upload prep
  const report = joinTokens(survey, inspection, appraisal, specialist);
  const enfathUpload = joinTokens(
    packageAcceptedStamp(input.parties?.survey),
    packageAcceptedStamp(input.parties?.inspection),
    packageAcceptedStamp(input.parties?.appraisal),
  );

  const linked =
    input.hasLinkedPriors && input.linkedUpdatedToken
      ? `linked:${input.linkedUpdatedToken}`
      : null;

  // basic: no reliable “party sent” signal — only explicit token from caller
  const basic = input.propertyUpdatedToken
    ? `basic:${input.propertyUpdatedToken}`
    : null;

  return {
    basic,
    documents,
    linked,
    survey,
    inspection,
    photos,
    government,
    keys,
    appraisal,
    failures,
    report,
    "enfath-upload": enfathUpload,
    finance,
    log,
    "survey-notes": surveyNotes,
  };
}

function packageAcceptedStamp(
  sub: PropertyDetailPartySubmission | null | undefined,
): string | null {
  if (!sub?.acceptedAtUtc?.trim()) return null;
  // Only when recently accepted (not when still pending submit)
  const st = (sub.packageStatus ?? "").toLowerCase();
  if (st === "submitted" || st === "reopened") {
    // accepted-only signal for enfaz prep — status may remain submitted after accept
  }
  return `accepted:${sub.roleKey}:${sub.acceptedAtUtc}`;
}
