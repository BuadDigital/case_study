import type {
  OrganizationSettingsDto,
  OrganizationValuationReportSettings,
} from "@platform/api-client";
import type { ReportTabSection } from "./valuation-report-tab-sections";

function lines(text: string | undefined): string[] {
  return (text ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pairsFromLines(text: string | undefined): { term: string; text: string }[] {
  return lines(text).map((line) => {
    const colon = line.indexOf(": ");
    if (colon < 0) return { term: line, text: "" };
    return {
      term: line.slice(0, colon).trim(),
      text: line.slice(colon + 2).trim(),
    };
  });
}

function overlayFinishingPairs(
  section: ReportTabSection,
  vr: OrganizationValuationReportSettings,
): ReportTabSection["pairs"] {
  const luxury = vr.finishingLuxury.trim();
  const medium = vr.finishingMedium.trim();
  const ordinary = vr.finishingOrdinary.trim();
  return (section.pairs ?? []).map((pair) => {
    if (pair.term === "تشطيب فاخر" && luxury) return { ...pair, text: luxury };
    if (pair.term === "تشطيب متوسط" && medium) return { ...pair, text: medium };
    if (pair.term === "تشطيب عادي" && ordinary) return { ...pair, text: ordinary };
    return pair;
  });
}

function overlaySection(
  section: ReportTabSection,
  vr: OrganizationValuationReportSettings,
): ReportTabSection {
  switch (section.n) {
    case "03": {
      const bullets = lines(vr.keyInputsText);
      return bullets.length ? { ...section, bullets } : section;
    }
    case "04": {
      const paragraphs = lines(vr.professionalStandards);
      return paragraphs.length ? { ...section, paragraphs } : section;
    }
    case "05": {
      const paragraphs = lines(vr.independence);
      return paragraphs.length ? { ...section, paragraphs } : section;
    }
    case "12":
      return { ...section, pairs: overlayFinishingPairs(section, vr) };
    case "28": {
      const bullets = lines(vr.researchScopeText);
      return bullets.length ? { ...section, bullets } : section;
    }
    case "29": {
      const bullets = vr.specialAssumptionLibrary
        .map((item) => item.trim())
        .filter(Boolean);
      return bullets.length ? { ...section, bullets } : section;
    }
    case "31": {
      const bullets = lines(vr.terms);
      return bullets.length ? { ...section, bullets } : section;
    }
    case "32": {
      const bullets = lines(vr.restrictions);
      return bullets.length ? { ...section, bullets } : section;
    }
    case "37": {
      const pairs = pairsFromLines(vr.ivsStandards);
      return pairs.length ? { ...section, pairs } : section;
    }
    case "38": {
      const pairs = pairsFromLines(vr.glossary);
      return pairs.length ? { ...section, pairs } : section;
    }
    default:
      return section;
  }
}

/** Replace frozen copy on the appraiser sheet with org settings (fallback = template). */
export function applyOrgSettingsToReportSections(
  sections: readonly ReportTabSection[],
  org: OrganizationSettingsDto | null,
): ReportTabSection[] {
  const vr = org?.valuationReport;
  if (!vr) return [...sections];
  return sections.map((section) => overlaySection(section, vr));
}
