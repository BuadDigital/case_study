import {
  decodePoParam,
  formatPoDisplay,
  PO_PROPERTY_SEGMENT,
  poListPath,
  poPropertiesPath,
} from "@case-study/mfe";
import type { BreadcrumbSegment } from "./breadcrumb";

export type PoChrome = {
  segments: BreadcrumbSegment[];
  title: string;
  /** When set, top bar renders `title` + isolated LTR PO number (RTL-safe). */
  titlePo?: string;
  /** Property detail route — used by chrome consumers for detail-specific UI. */
  propertyDetail?: { poNumber: string; propertyId: string };
};

/** Nested PO trail after list (edit / workspace) — leaf-only style: no dashboard parents. */
function poTrailBase(poNumber: string): BreadcrumbSegment[] {
  return [
    { label: "أوامر العمل", href: poListPath() },
    { label: formatPoDisplay(poNumber), href: poPropertiesPath(poNumber) },
  ];
}

/** Property detail: list → properties → current. */
export function buildPoPropertyDetailSegments(
  poNumber: string,
): BreadcrumbSegment[] {
  return [
    { label: "أوامر العمل", href: poListPath() },
    {
      label: `عقارات ${formatPoDisplay(poNumber)}`,
      href: poPropertiesPath(poNumber),
    },
    { label: "العقار", current: true },
  ];
}

/** Workspace chrome (معاينة / دراسة / مساحي) — trail ends with deed when known. */
export function buildPoPropertyWorkspaceSegments(
  poNumber: string,
  deedLabel?: string,
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [...poTrailBase(poNumber)];
  const deed = deedLabel?.trim();
  if (deed) {
    const ltr = !/[\u0600-\u06FF]/.test(deed);
    segments.push({ label: deed, current: true, ltr });
  }
  return segments;
}

export function resolvePoChrome(pathname: string): PoChrome | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "po") return null;

  // List: leaf only
  if (parts.length === 1) {
    return {
      segments: [{ label: "أوامر العمل", current: true }],
      title: "أوامر العمل (PO)",
    };
  }

  const poNumber = decodePoParam(parts[1]);

  if (parts[2] === "edit") {
    return {
      segments: [
        ...poTrailBase(poNumber),
        { label: "تعديل", current: true },
      ],
      title: "تعديل أمر العمل —",
      titlePo: poNumber,
    };
  }

  if (parts[2] !== PO_PROPERTY_SEGMENT) {
    return {
      segments: [{ label: "أوامر العمل", current: true }],
      title: "أوامر العمل (PO)",
    };
  }

  // Properties list for one PO
  if (parts.length === 3) {
    return {
      segments: [
        { label: "أوامر العمل", href: poListPath() },
        { label: "عقارات", current: true },
      ],
      title: `عقارات ${formatPoDisplay(poNumber)}`,
    };
  }

  const propertyId = decodePoParam(parts[3]);

  if (parts[4] === "edit") {
    return {
      segments: [
        ...poTrailBase(poNumber),
        { label: "تعديل عقار", current: true },
      ],
      title: "تعديل العقار",
    };
  }

  if (parts[4] === "failure") {
    return {
      segments: [
        ...poTrailBase(poNumber),
        { label: "تعذر", current: true },
      ],
      title: "تسجيل تعذر",
    };
  }

  if (parts.length === 4) {
    return {
      segments: buildPoPropertyDetailSegments(poNumber),
      title: "تفاصيل العقار",
      propertyDetail: { poNumber, propertyId },
    };
  }

  return {
    segments: [{ label: "أوامر العمل", current: true }],
    title: "أوامر العمل (PO)",
  };
}
