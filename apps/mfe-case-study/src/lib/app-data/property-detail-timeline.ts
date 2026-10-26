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
 * How it works: maps the events with `mapPropertyTimelineDtos` (same order, oldest first), then
 * adds each event's `propertyId` and `deedLabel` from the DTO at the same index (blank → undefined).
 *
 * Edge cases: the tags are paired by index, which holds only while every event has a time —
 * `mapPropertyTimelineDtos` drops events without `at`.
 */
export function mapTransactionTimelineDtos(
  events: TransactionTimelineEventDto[],
): PropertyTimelineEvent[] {
  return mapPropertyTimelineDtos(events).map((e, i) => ({
    ...e,
    propertyId: events[i]?.propertyId?.trim() || undefined,
    deedLabel: events[i]?.deedLabel?.trim() || undefined,
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
