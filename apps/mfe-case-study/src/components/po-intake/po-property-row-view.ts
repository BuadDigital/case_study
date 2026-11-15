import { PropertyListRowStatuses } from "@platform/api-client";
import type { PropertyWorkflowStage } from "@platform/app-shared/app-data/constants";
import { poPropertyPath } from "@platform/app-shared/domain/po-routes";
import {
  formatPropertyLocation,
  formatPropertyTypeLine,
  hasBourseDetailFields,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { propertyWorkflowStatusStyle } from "./PoPropertiesHtmlPrimitives";

/** The deed's number, else its real-estate registry number. */
export function deedLabel(property: PoPropertyIntake): string {
  return property.deedNumber.trim() || property.realEstateRegNumber.trim() || "—";
}

/**
 * One deed's row of a deed list (a work order's deeds, the deeds of a request number): its
 * location, type, link, label, workflow badge and deed status.
 *
 * How it works: a deed whose bourse inquiry is not done reads «بانتظار البورصة», or «بانتظار
 * البيانات الأولية» while it has no number yet; a removed deed reads as removed; else the badge is
 * the server's row status.
 * Edge cases: the type stays «—» until the bourse records one.
 */
export function poPropertyRowView(
  prop: PoPropertyIntake,
  poNumber: string,
  serverStatus: PropertyWorkflowStage | undefined,
) {
  const boursePending = !prop.bourseDataCompleted && !prop.isRemoved;
  // A slot the specialist opened but has not saved yet (the property exists on the server from the first second).
  const intakePending =
    boursePending && !prop.deedNumber.trim() && !prop.realEstateRegNumber.trim();
  const locRaw = formatPropertyLocation(prop);
  const location = locRaw === "بانتظار البورصة" ? "بانتظار البورصة" : locRaw || "—";
  const typeLine = formatPropertyTypeLine(prop);
  const typeDisplay = boursePending && !hasBourseDetailFields(prop) ? "—" : typeLine || "—";
  const workflowStyle = prop.isRemoved
    ? propertyWorkflowStatusStyle("removed")
    : intakePending
      ? { label: "بانتظار البيانات الأولية", base: "#7a7a7a", fg: "#5f5f5f" }
      : boursePending
        ? { label: "بانتظار البورصة", base: "#a67c1a", fg: "#8a6a18" }
        : propertyWorkflowStatusStyle(serverStatus ?? PropertyListRowStatuses.New);

  return {
    boursePending,
    location,
    typeDisplay,
    detailHref: poPropertyPath(poNumber, prop.id),
    label: deedLabel(prop),
    workflowStyle,
    deedSt: prop.deedStatus.trim(),
  };
}
