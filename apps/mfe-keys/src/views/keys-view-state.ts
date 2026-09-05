/**
 * Pure decisions behind `KeysView` — the list href, role gates, KPI counts,
 * the search/status/custody filter, and the mobile card projection. No
 * React, no I/O.
 */
import type { RoleId } from "@platform/types";
import type { ActiveQueueMobileCardItem } from "@platform/app-shared/components/ActiveQueueMobileCards";
import {
  envelopeDisplayRef,
  isEnvelopeOutOfCustody,
  type KeyEnvelopeRow,
} from "../lib/keys-envelope-types";

export type StatusFilter =
  | "all"
  | "reviewer"
  | "assessor"
  | "external"
  | "returned";
export type ListTab = "envelopes" | "fees";

export function keysListHref(opts?: {
  tab?: "fees";
  envelope?: string;
  register?: boolean;
  request?: string;
}): string {
  const params = new URLSearchParams();
  if (opts?.tab === "fees") params.set("tab", "fees");
  if (opts?.envelope) params.set("envelope", opts.envelope);
  if (opts?.register) params.set("register", "1");
  if (opts?.request) params.set("request", opts.request);
  const qs = params.toString();
  return qs ? `/keys?${qs}` : "/keys";
}

export function listTabFromParam(tab: string | null): ListTab {
  return tab === "fees" ? "fees" : "envelopes";
}

export type KeysViewPermissions = {
  viewOnly: boolean;
  canEditEnvelope: boolean;
  canRegisterEnvelope: boolean;
  canCollectFee: boolean;
};

/** The general manager only looks; registering is a reviewer/supervisor act; collection belongs to finance. */
export function keysViewPermissions({
  role,
  superAdmin,
  hasCapability,
}: {
  role: RoleId;
  superAdmin: boolean;
  hasCapability: (capability: string) => boolean;
}): KeysViewPermissions {
  const viewOnly = !superAdmin && role === "general-manager";
  const canEditEnvelope =
    !viewOnly &&
    (superAdmin ||
      role === "government-reviewer" ||
      role === "section-supervisor" ||
      role === "field-inspector" ||
      role === "real-estate-appraiser");
  const canRegisterEnvelope =
    !viewOnly &&
    (superAdmin ||
      role === "government-reviewer" ||
      role === "section-supervisor");
  // Confirming collection belongs to finance, matching the manage-financial gate on
  // POST /api/key-envelopes/{id}/fee-collected.
  const canCollectFee = !viewOnly && hasCapability("manage-financial");
  return { viewOnly, canEditEnvelope, canRegisterEnvelope, canCollectFee };
}

export type KeysKpis = {
  total: number;
  delivered: number;
  inCustody: number;
  active: number;
  pendingMatch: number;
  readyToDeliver: number;
};

/** KPI metrics — labels from `renderKeys`; live API approximates order-state with custody + assignments. */
export function computeKeysKpis(envelopes: KeyEnvelopeRow[]): KeysKpis {
  const total = envelopes.length;
  let delivered = 0;
  let pendingMatch = 0;
  let readyToDeliver = 0;
  for (const e of envelopes) {
    if (isEnvelopeOutOfCustody(e.status)) delivered += 1;
    let pendingInEnvelope = 0;
    for (const a of e.assignments) {
      if (a.status === "pending") pendingInEnvelope += 1;
    }
    pendingMatch += pendingInEnvelope;
    if (
      e.status !== "returned" &&
      e.assignments.length > 0 &&
      pendingInEnvelope === 0
    ) {
      readyToDeliver += 1;
    }
  }
  const inCustody = total - delivered;
  const active = inCustody;
  return { total, delivered, inCustody, active, pendingMatch, readyToDeliver };
}

/** Reference, request, court, circuit and every deed — what the search box matches. */
export function envelopeSearchText(env: KeyEnvelopeRow): string {
  const deeds = env.assignments.map((a) => a.deedNumber).join(" ");
  const ref = envelopeDisplayRef(env.id, env.createdAtUtc, env.referenceNumber);
  return `${ref} ${env.requestNumber} ${env.court} ${env.circuit} ${deeds}`;
}

/** A status filter shows exactly that custody; «all» hides out-of-custody rows unless the eye is open. */
export function filterKeyEnvelopes(
  envelopes: KeyEnvelopeRow[],
  {
    query,
    statusFilter,
    showOut,
  }: { query: string; statusFilter: StatusFilter; showOut: boolean },
): KeyEnvelopeRow[] {
  const q = query.trim().toLowerCase();
  return envelopes.filter((e) => {
    if (statusFilter !== "all") {
      if (e.status !== statusFilter) return false;
    } else if (!showOut && isEnvelopeOutOfCustody(e.status)) {
      return false;
    }
    if (!q) return true;
    return envelopeSearchText(e).toLowerCase().includes(q);
  });
}

export function envelopeCardTone(
  env: KeyEnvelopeRow,
): ActiveQueueMobileCardItem["tone"] {
  if (isEnvelopeOutOfCustody(env.status)) return "done";
  if (env.countMismatch) return "returned";
  return env.receiveScenario ? "pending" : "new";
}

/** Court · request (or circuit) · keys and deeds — inspector wording on mobile. */
export function envelopeCardMeta(
  env: KeyEnvelopeRow,
): NonNullable<ActiveQueueMobileCardItem["meta"]> {
  return [
    {
      text: env.court?.trim() || "بدون محكمة",
      kind: "place" as const,
    },
    {
      text: env.requestNumber?.trim()
        ? `طلب ${env.requestNumber.trim()}`
        : env.circuit?.trim() || "—",
      kind: "po" as const,
    },
    {
      text: `${env.keysCountActual} مفاتيح · ${env.assignments.length} صك`,
      kind: "type" as const,
    },
  ];
}
