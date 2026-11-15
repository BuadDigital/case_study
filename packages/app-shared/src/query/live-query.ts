/**
 * The safety refresh of the live queues (task list, operations tasks, work orders) while their page
 * is open and visible. Changes arrive first through the notification stream, which refreshes every
 * queue at once (ServerNotificationBridge.refreshTransactions), and a page refreshes when its tab
 * comes back into view. 2026-11-15: this was 30s — the whole task list (3.4 MB) every 30s per open
 * queue page; now 5 minutes.
 */
export const LIVE_QUEUE_POLL_INTERVAL_MS = 300_000;
