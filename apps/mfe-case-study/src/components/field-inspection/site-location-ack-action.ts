import type { ToastTone } from "@platform/ui-kit";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import {
  SITE_LOCATION_ACK_POPUP_BLOCKED_MESSAGE,
  SITE_LOCATION_ACK_REQUIRES_PIN_MESSAGE,
  buildSiteLocationAckLetter,
  canPrintSiteLocationAck,
} from "../../lib/app-data/site-location-ack-letter";
import { openSiteLocationAckLetter } from "../../lib/app-data/site-location-ack-letter-html";

type ShowToast = (message: string, tone?: ToastTone) => void;

/**
 * «إقرار صحة الموقع» click — requires تثبيت الموقع, then opens the branded letter.
 * Opens the tab synchronously so popup blockers do not kill the await for org settings.
 */
export function handleSiteLocationAckClick(input: {
  mapPinned: boolean;
  draft: InspectorWorkspaceDraft;
  property: PoPropertyIntake | null | undefined;
  showToast: ShowToast;
}): void {
  if (!canPrintSiteLocationAck(input.mapPinned)) {
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
