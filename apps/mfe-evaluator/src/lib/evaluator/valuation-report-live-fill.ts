/**
 * Applies the valuation report template to the DOM — pure model is built in
 * valuation-report-fill-model.ts; this file only writes values into the template.
 * Public surface unchanged: all fill-model exports are re-exported from here.
 */
export * from "./valuation-report-fill-model";
// Lightweight independent user-format module — the report tab imports it without pulling this file.
export {
  clientNameFromRecord,
  formatValuationReportUsers,
  reportUserNamesFromRecord,
} from "./valuation-report-users";

import type { OrganizationValuerRosterEntry } from "@platform/api-client";
import { isUsableAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import type { EvaluatorReportWorker } from "./evaluator-window-data";
import {
  SAMPLE_SECS,
  normLabel,
  slashDateFromIso,
  type ValuationReportLiveFill,
} from "./valuation-report-fill-model";
import {
  membershipCategoryLabel,
  valuerRoleLabel,
} from "./valuation-report-sheet-facts";
import {
  blankValueCells,
  fillAdjustmentSection,
  fillApprovalTable,
  fillAttachmentAndGlossarySections,
  fillBoundaries,
  fillBulletListSection,
  fillFinalBanner,
  fillFinishingLevelSection,
  fillImageSlot,
  fillKeyedInSection,
  fillKeyedRows,
  fillLocationMapsSlots,
  fillLoneValueSection,
  fillMethodRow,
  fillParagraphSection,
  fillParticipants,
  rebuildDirectCostSheet,
  rebuildIndirectCostSheet,
  rebuildReconSheet,
  rebuildTwoColSheet,
  scrubFrozenDates,
  syncNumberedRows,
} from "./valuation-report-live-fill-dom";

function peopleNameMatch(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/\s+/g, " ").trim();
  const left = n(a);
  const right = n(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function workerJobTitle(
  role: string,
  rosterRole: string | undefined,
): string {
  if (rosterRole) {
    const fromRoster = valuerRoleLabel(rosterRole);
    if (fromRoster) return fromRoster;
  }
  if (role === "مراجع") return "مقيم عقاري مراجع";
  if (role === "معد") return "مقيم عقاري";
  return "";
}

type ParticipantFill = {
  name: string;
  title: string;
  category: string;
  membership: string;
  membershipExpires: string;
  signatureUrl: string;
};

/** §26 — three fixed participants from the roster + fourth from work-order dispatch (assigned appraiser). */
export const FIXED_REPORT_PARTICIPANT_NAMES = [
  "سليمان عبد الله الصالحي",
  "سالم الغريب",
  "أيمن أحمد مجرشي",
] as const;

function participantFromRoster(
  name: string,
  roster: OrganizationValuerRosterEntry[],
  fallbackRole: string,
): ParticipantFill {
  const hit = roster.find((v) => peopleNameMatch(v.nameAr, name));
  return {
    name: (hit?.nameAr || name).trim(),
    title: hit
      ? valuerRoleLabel(hit.role)
      : workerJobTitle(fallbackRole, undefined),
    category: membershipCategoryLabel(hit?.membershipCategory),
    membership: (hit?.membershipNumber ?? "").trim(),
    membershipExpires: slashDateFromIso(hit?.membershipExpiresAt),
    signatureUrl: (hit?.signatureUrl ?? "").trim(),
  };
}

/** §26 — three fixed + fourth column from valuation assignment in work-order dispatch. */
export function resolveReportParticipants(
  _workers: EvaluatorReportWorker[] | undefined,
  valuers: OrganizationValuerRosterEntry[] | null | undefined,
  assignedAppraiserName?: string | null,
): ParticipantFill[] {
  const roster = (valuers ?? []).filter((v) => v.isActive !== false);
  const fixed = FIXED_REPORT_PARTICIPANT_NAMES.map((name) =>
    participantFromRoster(name, roster, "مراجع"),
  );
  const assignee = (assignedAppraiserName ?? "").trim();
  if (!assignee || !isUsableAssigneeDisplayName(assignee)) return [...fixed];
  if (fixed.some((p) => peopleNameMatch(p.name, assignee))) return [...fixed];
  return [...fixed, participantFromRoster(assignee, roster, "معد")];
}

export function applyValuationReportLiveFill(
  dom: Document,
  fill: ValuationReportLiveFill,
  extras?: {
    valuers?: OrganizationValuerRosterEntry[] | null;
    valuationBranch?: string;
    interactiveComparablesMap?: boolean;
  },
): void {
  SAMPLE_SECS.forEach((id) => {
    const sec = dom.querySelector(`[data-sec="${id}"]`);
    if (sec) blankValueCells(sec);
  });

  const map = new Map(
    Object.entries(fill.cells).map(([k, v]) => [normLabel(k), v]),
  );
  if (fill.isLand) {
    const ageLabels = new Set(["عمر البناء", "عمر العقار", "العمر الفعلي"]);
    dom.querySelectorAll("td.k").forEach((labelCell) => {
      if (!ageLabels.has(normLabel(labelCell.textContent ?? ""))) return;
      const row = labelCell.closest("tr");
      const next = labelCell.nextElementSibling;
      if (
        next &&
        (next.classList.contains("v") || next.classList.contains("num")) &&
        row
      ) {
        labelCell.remove();
        next.remove();
        if (![...row.querySelectorAll("td")].length) row.remove();
      }
    });
  }
  dom.querySelectorAll("td.k").forEach((labelCell) => {
    const label = normLabel(labelCell.textContent ?? "");
    if (!map.has(label)) return;
    const value = map.get(label)!;
    const next = labelCell.nextElementSibling;
    if (
      next &&
      (next.classList.contains("v") || next.classList.contains("num"))
    ) {
      next.textContent = value;
    }
  });

  const scope = dom.querySelector('[data-sec="2"]');
  if (scope) {
    const p = scope.querySelector("p");
    if (p && fill.scopeBasis && fill.scopeBasis !== "—") {
      p.textContent = `يعتمد أساس التقييم على تحديد ${fill.scopeBasis} لموضوع التقييم في حالته الراهنة.`;
    } else if (p && !fill.isLiquidation) {
      p.textContent = "";
    }
    const items = scope.querySelectorAll("li");
    if (items[0]) {
      items[0].textContent =
        fill.basisDefinition ||
        (!fill.isLiquidation ? "" : items[0].textContent);
    }
    if (items[1]) {
      items[1].textContent =
        `أُعد هذا التقرير لاستخدام العميل (${fill.scopeClient && fill.scopeClient !== "—" ? fill.scopeClient : "—"}) فقط، ولا يجوز استخدامه من قبل مستخدم آخر إلا بإذن خطي موقع ومختوم بختم الشركة.`;
    }
  }

  const asset = dom.querySelector('[data-sec="6"]');
  if (asset && fill.propertyDescription) {
    const desc = [...asset.querySelectorAll("td.k")].find(
      (td) => normLabel(td.textContent ?? "") === "وصف العقار",
    )?.nextElementSibling;
    if (desc) desc.textContent = fill.propertyDescription;
  }

  const bounds = dom.querySelector('[data-sec="8"]');
  if (bounds) fillBoundaries(bounds, fill.boundaries);

  const areas = dom.querySelector('[data-sec="9"]');
  if (areas) rebuildTwoColSheet(areas, fill.areaRows, "num");

  const build = dom.querySelector('[data-sec="10"]');
  if (build) rebuildTwoColSheet(build, fill.buildDescRows, "v");

  const defectsSec = dom.querySelector('[data-sec="13"]');
  if (defectsSec) {
    fillLoneValueSection(defectsSec, fill.cells["وصف العيوب الإنشائية"] || "—");
  }

  const surr = dom.querySelector('[data-sec="15"]');
  if (surr) fillKeyedInSection(surr, "أخرى", fill.surroundingsOther);

  const feat = dom.querySelector('[data-sec="11"]');
  if (feat) fillKeyedInSection(feat, "أخرى", "—");

  const services = dom.querySelector('[data-sec="14"]');
  if (services) fillKeyedRows(services, fill.serviceRows);

  const methods = dom.querySelector('[data-sec="16"]');
  if (methods) fillMethodRow(methods, fill.methodRow);

  const comps = dom.querySelector('[data-sec="17"]');
  if (comps) {
    if (fill.comparableRows.length > 0) {
      syncNumberedRows(comps, fill.comparableRows.length);
    }
    fillKeyedRows(comps, fill.comparableRows);
  }

  const landAppendix = dom.querySelector('[data-sec="20"]');
  if (landAppendix) {
    fillKeyedInSection(
      landAppendix,
      "إشارة الملحق",
      fill.landAppendixNote || "—",
    );
    const landTable = landAppendix.querySelector("[data-land-comps]");
    if (landTable && fill.landComparableRows.length > 0) {
      syncNumberedRows(landTable as HTMLElement, fill.landComparableRows.length);
      fillKeyedRows(landTable as HTMLElement, fill.landComparableRows);
    }
  }

  const adj = dom.querySelector('[data-sec="19"]');
  if (adj) fillAdjustmentSection(adj, fill);

  const costSec = dom.querySelector('[data-sec="21"]');
  if (costSec) rebuildDirectCostSheet(costSec, fill.costRows);

  const indirectSec = dom.querySelector('[data-sec="22"]');
  if (indirectSec) {
    rebuildIndirectCostSheet(
      indirectSec,
      fill.indirectRows,
      fill.indirectTotalLabel,
    );
  }

  const reconSec = dom.querySelector('[data-sec="24"]');
  if (reconSec) rebuildReconSheet(reconSec, fill.reconRows);

  const finalSec = dom.querySelector('[data-sec="25"]');
  if (finalSec) {
    const liqShown = (fill.cells["نسبة خصم التصفية المنظمة"] ?? "—") !== "—";
    if (!liqShown) {
      const disc = [...finalSec.querySelectorAll("td.k")].find((td) =>
        normLabel(td.textContent ?? "").includes("خصم التصفية"),
      );
      const discVal = disc?.nextElementSibling;
      if (discVal) discVal.textContent = "—";
      const reason = [...finalSec.querySelectorAll("td.k")].find((td) =>
        normLabel(td.textContent ?? "").includes("مبرر معامل"),
      )?.nextElementSibling;
      if (reason) reason.textContent = "—";
    }
    fillFinalBanner(finalSec, fill);
  }

  const people = dom.querySelector('[data-sec="26"]');
  if (people) {
    fillParticipants(
      people,
      resolveReportParticipants(
        fill.reportWorkers,
        extras?.valuers,
        fill.assignedAppraiserName,
      ),
      extras?.valuationBranch || fill.cells["فرع التقييم"] || "",
    );
    fillApprovalTable(people, fill);
  }

  // §3/§4/§5/§31/§32 — org settings text replaces sample text; empty keeps the template.
  fillBulletListSection(
    dom.querySelector('[data-sec="3"]'),
    fill.keyInputsBullets.length ? fill.keyInputsBullets : null,
  );
  fillParagraphSection(dom.querySelector('[data-sec="4"]'), fill.standardsParagraphs);
  fillParagraphSection(
    dom.querySelector('[data-sec="5"]'),
    fill.independenceParagraphs,
  );
  const termsSec = dom.querySelector('[data-sec="31"]');
  if (fill.termsBullets.length) fillBulletListSection(termsSec, fill.termsBullets);
  else scrubFrozenDates(termsSec, fill.reportDateSlash);
  const restrictionsSec = dom.querySelector('[data-sec="32"]');
  if (fill.restrictionsBullets.length) {
    fillBulletListSection(restrictionsSec, fill.restrictionsBullets);
  } else {
    scrubFrozenDates(restrictionsSec, fill.reportDateSlash);
  }

  // §33 — real location and satellite/close-up maps (interactive Google on screen).
  const mapsSec = dom.querySelector('[data-sec="33"]');
  if (mapsSec) {
    if (fill.locationLabel) {
      fillKeyedInSection(mapsSec, "الموقع", fill.locationLabel);
    }
    const coords = fill.cells["إحداثيات الموقع"];
    if (coords) {
      fillKeyedInSection(mapsSec, "إحداثيات الموقع", coords);
    }
  }
  fillLocationMapsSlots(dom, fill, extras?.interactiveComparablesMap === true);

  fillAttachmentAndGlossarySections(dom, fill, {
    interactiveComparablesMap: extras?.interactiveComparablesMap,
  });
  fillFinishingLevelSection(dom.querySelector('[data-sec="12"]'), fill);
}
