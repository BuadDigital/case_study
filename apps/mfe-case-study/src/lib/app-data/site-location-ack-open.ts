import type { ToastTone } from "@platform/ui-kit";
import type { PoPropertyIntake } from "./po-intake-data";
import type { InspectorWorkspaceDraft } from "./inspector-workspace-data";
import {
  SITE_LOCATION_ACK_POPUP_BLOCKED_MESSAGE,
  SITE_LOCATION_ACK_REQUIRES_PIN_MESSAGE,
  buildSiteLocationAckLetter,
  canPrintSiteLocationAck,
} from "./site-location-ack-letter";
import { openSiteLocationAckLetter } from "./site-location-ack-letter-html";
import {
  loadInspectorWorkspace,
  loadInspectorWorkspaceSnapshot,
} from "./inspector-workspace-reads";

type ShowToast = (message: string, tone?: ToastTone) => void;

/**
 * «إقرار صحة الموقع» click — requires تثبيت الموقع (or placed GPS on submitted
 * packages), then opens the branded letter.
 * Opens the tab synchronously so popup blockers do not kill the await for org settings.
 */
export function handleSiteLocationAckClick(input: {
  draft: InspectorWorkspaceDraft;
  property: PoPropertyIntake | null | undefined;
  showToast: ShowToast;
  /** @deprecated Prefer draft.mapPinned — kept for older call sites. */
  mapPinned?: boolean;
}): void {
  const mapPinned = input.mapPinned ?? Boolean(input.draft.mapPinned);
  if (
    !canPrintSiteLocationAck({
      mapPinned,
      mapLatitude: input.draft.mapLatitude,
      mapLongitude: input.draft.mapLongitude,
      status: input.draft.status,
    })
  ) {
    input.showToast(SITE_LOCATION_ACK_REQUIRES_PIN_MESSAGE, "info");
    return;
  }

  const target = window.open("about:blank", "_blank");
  const letter = buildSiteLocationAckLetter(input.draft, input.property);
  void openSiteLocationAckLetter(letter, { target }).then((opened) => {
    if (!opened) {
      input.showToast(SITE_LOCATION_ACK_POPUP_BLOCKED_MESSAGE, "error");
    }
  });
}

/** Queue ⋮ «خطاب صحة الموقع» — loads the inspection draft then opens the letter. */
export async function openSiteLocationAckForInspectionTask(input: {
  taskId: string;
  property: PoPropertyIntake | null | undefined;
  showToast: ShowToast;
}): Promise<void> {
  const draft =
    loadInspectorWorkspace(input.taskId) ??
    (await loadInspectorWorkspaceSnapshot(input.taskId));
  if (!draft) {
    input.showToast("تعذّر تحميل بيانات المعاينة", "error");
    return;
  }
  handleSiteLocationAckClick({
    draft,
    property: input.property,
    showToast: input.showToast,
  });
}
