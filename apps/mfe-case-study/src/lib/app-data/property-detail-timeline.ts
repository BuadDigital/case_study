import { formatInstantInRiyadh } from "./active-transactions-situation";

import {
  normalizePropertyTimelineTone,
  type PropertyTimelineEventDto,
  type PropertyTimelineTone,
  type TransactionTimelineEventDto,
} from "@platform/api-client";

export type { PropertyTimelineTone };

export type PropertyTimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  tone: PropertyTimelineTone;
  /** On a transaction timeline: the deed the event belongs to. */
  propertyId?: string;
  /** On a transaction timeline: the deed's label (deed / registry number). */
  deedLabel?: string;
};

/**
 * A transaction timeline (linked properties, 2026-10-19): the deeds' events merged by the server,
 * each tagged with its deed.
 *
 * How it works: drops the events without a time (as `mapPropertyTimelineDtos` does), then maps each
 * remaining event together with its own DTO, adding its `propertyId` and `deedLabel` (blank → undefined).
 *
 * Edge cases and how they were fixed: the tags used to be paired with the mapped list by index after
 * `mapPropertyTimelineDtos` had dropped the events without a time, so one such event shifted every
 * later event onto the wrong deed (found 2026-10-26 while documenting). Each event now carries the
 * tags of the DTO it was built from.
 */
export function mapTransactionTimelineDtos(
  events: TransactionTimelineEventDto[],
): PropertyTimelineEvent[] {
  return events
    .filter((e) => e.at)
    .map((e) => ({
      ...mapPropertyTimelineDtos([e])[0]!,
      propertyId: e.propertyId?.trim() || undefined,
      deedLabel: e.deedLabel?.trim() || undefined,
    }));
}

/**
 * Maps the server's timeline milestones to the rows the timeline card draws.
 *
 * How it works: drops events with no time, trims `detail` (empty becomes `undefined`), and normalises `tone`
 * to one of the known tones. The order is the server's (oldest first, one row per business step).
 *
 * Edge cases and how they were fixed: this file used to rebuild a second, different timeline on the client
 * when the server sent nothing, and then reversed the list (newest first), so the two screens disagreed. Both
 * are gone: nothing is merged, re-ordered or invented here, and an empty list shows the empty state.
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

/**
 * Formats a milestone's instant for display (Riyadh time).
 * Edge case: the server sends «استلام أمر العمل من إنفاذ» as a date at midnight UTC when the order has no received
 * time, and `formatInstantInRiyadh` shows such a value as a date only, instead of a made-up «03:00».
 */
export function formatTimelineDate(iso: string): string {
  return formatInstantInRiyadh(iso);
}
