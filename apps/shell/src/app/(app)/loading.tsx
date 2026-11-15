import { PanelSkeleton } from "@platform/ui-kit";

/**
 * The route's wait. Same frame as the pages' own PanelSkeleton (no extra classes), so when the page
 * takes over with its own card it stays in place instead of jumping (2026-11-15).
 */
export default function AppLoading() {
  return <PanelSkeleton />;
}
