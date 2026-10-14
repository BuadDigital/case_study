import { formatInstantInRiyadh } from "./active-transactions-situation";

import {
  normalizePropertyTimelineTone,
  type PropertyTimelineEventDto,
  type PropertyTimelineTone,
} from "@platform/api-client";

export type { PropertyTimelineTone };

export type PropertyTimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  tone: PropertyTimelineTone;
};

/**
 * The server's milestones, in the order it sends them (oldest first) — one row per business step.
 * Nothing is merged or re-ordered here: what the rail shows is what the server recorded.
 */
export function mapPropertyTimelineDtos(
  events: PropertyTimelineEventDto[],
): PropertyTimelineEvent[] {
  return events
    .filter((e) => e.at)
    .map((e) => ({
      id: e.id,
      at: e.at,
      title: e.title,
      detail: e.detail?.trim() || undefined,
      tone: normalizePropertyTimelineTone(e.tone),
    }));
}

/** A date recorded without a time («2026-09-20») shows as a date only. */
export function formatTimelineDate(iso: string): string {
  return formatInstantInRiyadh(iso);
}
