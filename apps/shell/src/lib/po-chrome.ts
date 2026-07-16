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
  /** Property detail route — drives topbar actions and hides page title. */
  propertyDetail?: { poNumber: string; propertyId: string };
};

export type PoChromeOptions = {
  /** Deed number crumb label (e.g. `10`) for property detail. */
  deedLabel?: string;
};

function poTrailBase(poNumber: string): BreadcrumbSegment[] {
  return [
    { label: "دراسة الحالة" },
    { label: "أوامر العمل", href: poListPath() },
    { label: formatPoDisplay(poNumber), href: poPropertiesPath(poNumber) },
  ];
}

export function buildPoPropertyDetailSegments(
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

export function resolvePoChrome(
  pathname: string,
  options?: PoChromeOptions,
): PoChrome | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "po") return null;

  if (parts.length === 1) {
    return {
      segments: [
        { label: "دراسة الحالة" },
        { label: "أوامر العمل", current: true },
      ],
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
      segments: [
        { label: "دراسة الحالة" },
        { label: "أوامر العمل", current: true },
      ],
      title: "أوامر العمل",
    };
  }

  if (parts.length === 3) {
    return {
      segments: [
        ...poTrailBase(poNumber),
        { label: "العقارات", current: true },
      ],
      title: "",
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
    const deed = options?.deedLabel?.trim();
    return {
      segments: buildPoPropertyDetailSegments(poNumber, deed),
      title: "",
      propertyDetail: { poNumber, propertyId },
    };
  }

  return {
    segments: [
      { label: "دراسة الحالة" },
      { label: "أوامر العمل", current: true },
    ],
    title: "أوامر العمل",
  };
}
