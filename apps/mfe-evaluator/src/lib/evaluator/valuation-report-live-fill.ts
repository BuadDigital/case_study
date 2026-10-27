// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • D13  §26 participants: the three names fixed in code are gone — the roster's active reviewers and
//         assistants, then the assigned appraiser (duplicates matched by samePerson).
//  • D17  applyIncomeSection puts the income section before the reconciliation.
//  • D9   appendScopeRows adds the §2 scope rows (retrospective rationale, building-only scope).
//  • D11  appendAgeNotes adds the age rationales / lease cap under the §23 ages row.
//  • §25  fillFinalValueTable replaces the old liquidation dash-out and fillValueAdditions.
// Round 2 (1b19bedc)
//  • A    §20 calls rebuildLandValueTable with fill.landValueRows.
// ──────────────────────────────────────────────────────────────────────────────────────────────

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
import { applyIncomeSection } from "./valuation-report-income";
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
  fillFinalValueTable,
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
  rebuildLandValueTable,
  rebuildIndirectCostSheet,
  rebuildReconSheet,
  rebuildComponentsSheet,
  scrubFrozenDates,
  syncNumberedRows,
} from "./valuation-report-live-fill-dom";
import {
  markReportMissingFields,
  type ReportMissingField,
} from "./valuation-report-missing-fields";

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
  if (role === "مراجع") return "مقيّم عقاري مراجع";
  if (role === "معد") return "مقيّم عقاري";
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

/** Roster roles that stand on every report (D13 — same rule as ValuationIssuanceGateInputRules). */
const STANDING_REPORT_ROLES = new Set(["reviewer", "assistant"]);

/** Same normalisation as the server's SamePerson: alef forms, tā marbūṭa, alef maqṣūra, spaces. */
function samePerson(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string | null | undefined) =>
    (s ?? "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
  const left = norm(a);
  const right = norm(b);
  return left.length > 0 && left === right;
}

function participantFromRoster(
  name: string,
  roster: OrganizationValuerRosterEntry[],
  fallbackRole: string,
  staffUserId?: string | null,
): ParticipantFill {
  const linkedId = (staffUserId ?? "").trim();
  const hit =
    (linkedId
      ? roster.find((v) => (v.staffUserId ?? "").trim() === linkedId)
      : undefined) ?? roster.find((v) => peopleNameMatch(v.nameAr, name));
  return fillFromRosterRow(hit, name, fallbackRole);
}

function fillFromRosterRow(
  hit: OrganizationValuerRosterEntry | undefined,
  name: string,
  fallbackRole: string,
): ParticipantFill {
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

/**
 * §26 «المشاركون في إعداد التقرير» — the people the issuance gate checks for this report
 * (D13): the roster's active reviewers and assistants, then the appraiser assigned to this
 * property (by staff account, else by name). The signing certified valuer prints in the
 * approval table below, not again here. No names are fixed in code.
 */
export function resolveReportParticipants(
  valuers: OrganizationValuerRosterEntry[] | null | undefined,
  assignedAppraiserName?: string | null,
  assignedAppraiserId?: string | null,
): ParticipantFill[] {
  const roster = (valuers ?? []).filter((v) => v.isActive !== false);
  const standing = roster
    .filter((v) => STANDING_REPORT_ROLES.has((v.role ?? "").trim().toLowerCase()))
    .map((v) => fillFromRosterRow(v, v.nameAr, "مراجع"));
  const assignee = (assignedAppraiserName ?? "").trim();
  const assigneeId = (assignedAppraiserId ?? "").trim();
  const usableName = Boolean(assignee && isUsableAssigneeDisplayName(assignee));
  if (!usableName && !assigneeId) return standing;
  const appraiser = participantFromRoster(
    usableName ? assignee : "",
    roster,
    "معد",
    assigneeId,
  );
  if (!appraiser.name) return standing;
  if (standing.some((p) => samePerson(p.name, appraiser.name))) return standing;
  return [...standing, appraiser];
}

function removeSections(dom: Document, ids: readonly string[]) {
  ids.forEach((id) => dom.querySelector(`[data-sec="${id}"]`)?.remove());
}

function removeLabeledPairs(
  dom: Document,
  labels: ReadonlySet<string>,
  scope: ParentNode = dom,
) {
  scope.querySelectorAll("td.k").forEach((labelCell) => {
    if (!labels.has(normLabel(labelCell.textContent ?? ""))) return;
    const row = labelCell.closest("tr");
    const valueCell = labelCell.nextElementSibling;
    labelCell.remove();
    if (
      valueCell &&
      (valueCell.classList.contains("v") ||
        valueCell.classList.contains("num"))
    ) {
      valueCell.remove();
    }
    if (row && row.children.length === 0) row.remove();
  });
}

/** Optional site fields — omit the label/value pair when intake left them blank. */
const HIDE_WHEN_EMPTY_LABELS = ["محضر التجزئة", "اسم المخطط"] as const;

function isBlankReportCell(value: string | undefined): boolean {
  const t = (value ?? "").trim();
  return !t || t === "—" || t === "-";
}

function removeEmptyOptionalPairs(dom: Document, fill: ValuationReportLiveFill) {
  const labels = new Set<string>();
  for (const label of HIDE_WHEN_EMPTY_LABELS) {
    if (isBlankReportCell(fill.cells[label])) labels.add(label);
  }
  if (!labels.size) return;
  removeLabeledPairs(dom, labels);
  // §07 — close the gaps the hidden pairs leave: the remaining pairs flow three per row.
  const site = dom.querySelector('[data-sec="7"] table');
  if (site) reflowPairTable(site, 3);
}

/**
 * A yes/no checklist table (ملحقات، المحيط): drops the «أخرى» pair when nothing was written,
 * closes the gap it leaves, and shows «يوجد» as ✓.
 */
function tidyPresenceTable(sec: Element, other: string, perRow: number) {
  const table = sec.querySelector("table");
  if (!table) return;
  if (isBlankReportCell(other)) {
    removeLabeledPairs(sec.ownerDocument, new Set(["أخرى"]), sec);
    reflowPairTable(table, perRow);
  }
  for (const label of [...table.querySelectorAll("td.k")]) {
    const value = label.nextElementSibling;
    if (!value || normLabel(value.textContent ?? "") !== "يوجد") continue;
    value.textContent = "✓";
    value.setAttribute("style", "text-align:center;font-weight:700;color:#2f7a4c");
  }
}

/**
 * Re-lays a label/value table so its pairs fill the rows in order, `perRow` per row; the last
 * value of a short final row stretches to the table edge instead of leaving empty cells.
 */
function reflowPairTable(table: Element, perRow: number) {
  const pairs: Array<[Element, Element]> = [];
  for (const label of [...table.querySelectorAll("td.k")]) {
    const value = label.nextElementSibling;
    if (value && !value.classList.contains("k")) pairs.push([label, value]);
  }
  if (pairs.length === 0) return;
  const doc = table.ownerDocument;
  const rows: Element[] = [];
  for (let i = 0; i < pairs.length; i += perRow) {
    const tr = doc.createElement("tr");
    const chunk = pairs.slice(i, i + perRow);
    chunk.forEach(([label, value], j) => {
      value.removeAttribute("colspan");
      if (j === chunk.length - 1 && chunk.length < perRow) {
        value.setAttribute("colspan", String((perRow - chunk.length) * 2 + 1));
      }
      tr.append(label, value);
    });
    rows.push(tr);
  }
  const body = table.querySelector("tbody") ?? table;
  body.replaceChildren(...rows);
}

function removeFacadeColumn(dom: Document) {
  const bounds = dom.querySelector('[data-sec="8"]');
  if (!bounds) return;
  for (const table of bounds.querySelectorAll("table")) {
    const header = [...table.querySelectorAll("tr")][0];
    const index = header
      ? [...header.children].findIndex((cell) =>
          normLabel(cell.textContent ?? "").includes("الواجهات"),
        )
      : -1;
    if (index < 0) continue;
    table.querySelectorAll("tr").forEach((row) => {
      row.children[index]?.remove();
    });
  }
}

function applyStructuralVisibility(dom: Document, fill: ValuationReportLiveFill) {
  // §09 «تفاصيل المساحات» is no longer printed; its areas and the built-up total moved
  // into §10 «مكونات العقار». Dropped here too so older stored templates follow suit.
  // §13 «وصف العيوب الإنشائية» is not printed either (dropped from older stored templates).
  removeSections(dom, ["9", "13"]);
  // Market off (e.g. contractor method only) ⇒ no property comparables, map or adjustments.
  if (!fill.marketApproachEnabled) {
    removeSections(dom, ["17", "18", "19"]);
  }
  if (!fill.costApproachEnabled) {
    removeSections(dom, ["20", "21", "22", "23"]);
  } else if (fill.costBuildingOnly) {
    removeSections(dom, ["20"]);
  }

  if (fill.isApartment) {
    // An apartment records no facades — nothing to print, nothing to mark missing.
    removeLabeledPairs(dom, FACADE_LABELS);
    removeFacadeColumn(dom);
  }

  if (!fill.isLand) return;
  // Building-only sections — vacant land has no on-site meters/utilities table either.
  // §10 «مكونات العقار» stays when the specialist listed components (a fence, a room…).
  removeSections(dom, fill.componentsListed ? ["11", "12", "13", "14"] : ["10", "11", "12", "13", "14"]);
  removeLabeledPairs(
    dom,
    new Set([
      "رخصة البناء",
      "رقم رخصة البناء",
      "تاريخ رخصة البناء",
      "رقم رخصة البناء وتاريخها",
      "عمر البناء",
      "عمر العقار",
      "حالة البناء",
      "حالة العقار",
      "حالة الإشغال",
      "العمر الفعلي",
      ...FACADE_LABELS,
    ]),
  );
  removeFacadeColumn(dom);
}

const FACADE_LABELS = new Set([
  "تشطيب الواجهات",
  "نوع الواجهة الشمالية",
  "نوع الواجهة الشرقية",
  "نوع الواجهة الجنوبية",
  "نوع الواجهة الغربية",
  "تشطيب الواجهة الشمالية",
  "تشطيب الواجهة الشرقية",
  "تشطيب الواجهة الجنوبية",
  "تشطيب الواجهة الغربية",
]);

/** §23 — age rationales / lease cap as full-width rows right after the ages row. */
function appendAgeNotes(sec: Element, notes: ValuationReportLiveFill["ageNotes"]) {
  sec.querySelectorAll("tr[data-age-note]").forEach((tr) => tr.remove());
  const ageRow = [...sec.querySelectorAll("tr")].find((tr) =>
    [...tr.querySelectorAll("td.k")].some((td) => normLabel(td.textContent ?? "") === "العمر الفعلي"),
  );
  if (!ageRow) return;
  let anchor: Element = ageRow;
  for (const note of notes) {
    const doc = sec.ownerDocument;
    const tr = doc.createElement("tr");
    tr.setAttribute("data-age-note", "");
    const k = doc.createElement("td");
    k.className = "k";
    k.textContent = note.label;
    const v = doc.createElement("td");
    v.className = "v";
    v.setAttribute("colspan", "3");
    v.textContent = note.value;
    tr.append(k, v);
    anchor.after(tr);
    anchor = tr;
  }
}

/** §2 — D9 retrospective rationale and the building-only scope, one full-width row each. */
function appendScopeRows(scope: Element, rows: ValuationReportLiveFill["scopeRows"]) {
  const table = scope.querySelector("table");
  if (!table) return;
  table.querySelectorAll("tr[data-scope-row]").forEach((tr) => tr.remove());
  const body = table.querySelector("tbody") ?? table;
  for (const row of rows) {
    const doc = scope.ownerDocument;
    const tr = doc.createElement("tr");
    tr.setAttribute("data-scope-row", "");
    const k = doc.createElement("td");
    k.className = "k";
    k.textContent = row.label;
    const v = doc.createElement("td");
    v.className = "v";
    v.setAttribute("colspan", "3");
    v.textContent = row.value;
    tr.append(k, v);
    body.appendChild(tr);
  }
}

export function applyValuationReportLiveFill(
  dom: Document,
  fill: ValuationReportLiveFill,
  extras?: {
    valuers?: OrganizationValuerRosterEntry[] | null;
    valuationBranch?: string;
    interactiveComparablesMap?: boolean;
    /** False skips the red missing-field marks (read-only embeds). Default true. */
    markMissingFields?: boolean;
  },
): ReportMissingField[] {
  applyStructuralVisibility(dom, fill);
  removeEmptyOptionalPairs(dom, fill);

  SAMPLE_SECS.forEach((id) => {
    const sec = dom.querySelector(`[data-sec="${id}"]`);
    if (sec) blankValueCells(sec);
  });

  const map = new Map(
    Object.entries(fill.cells).map(([k, v]) => [normLabel(k), v]),
  );
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
    appendScopeRows(scope, fill.scopeRows);
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


  const build = dom.querySelector('[data-sec="10"]');
  if (build) rebuildComponentsSheet(build, fill.buildDescRows);

  const defectsSec = dom.querySelector('[data-sec="13"]');
  if (defectsSec) {
    fillLoneValueSection(defectsSec, fill.cells["وصف العيوب الإنشائية"] || "—");
  }

  const surr = dom.querySelector('[data-sec="15"]');
  if (surr) fillKeyedInSection(surr, "أخرى", fill.surroundingsOther);

  const feat = dom.querySelector('[data-sec="11"]');
  if (feat) fillKeyedInSection(feat, "أخرى", fill.attachmentsOther);

  // §11 ملحقات / §15 المحيط: «أخرى» prints only when written; «يوجد» reads as a tick.
  if (feat) tidyPresenceTable(feat, fill.attachmentsOther, 4);
  if (surr) tidyPresenceTable(surr, fill.surroundingsOther, 4);

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
    rebuildLandValueTable(landAppendix, fill.landValueRows);
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
    // Land inside the cost approach gets the full comparison treatment: its own adjustments.
    const landAdj = landAppendix.querySelector("[data-land-adj]");
    if (landAdj) {
      fillAdjustmentSection(landAdj, {
        adjustmentRows: fill.landAdjustmentRows,
        adjustmentComparisonLabel: fill.landAdjustmentComparisonLabel,
        adjustmentNotes: fill.landAdjustmentNotes,
      });
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

  // D17 — the income approach section goes right before the reconciliation.
  applyIncomeSection(dom, fill);

  const reconSec = dom.querySelector('[data-sec="24"]');
  if (reconSec) rebuildReconSheet(reconSec, fill.reconRows);

  // One approach ⇒ no reconciliation between indicators: drop the weighting table, keep the
  // justification of the approach and method used («مبرر استخدام طرق التقييم»).
  if (reconSec && fill.approachCount < 2) {
    reconSec.querySelector("table.mx")?.remove();
    const heading = reconSec.querySelector("h2");
    const num = heading?.querySelector("span.n");
    if (heading) {
      heading.replaceChildren(...(num ? [num] : []), "مبرر استخدام أسلوب وطريقة التقييم");
    }
  }

  // «مباني فقط»: no land value in the cost result — drop the land row and say what the total is.
  const ageSec = dom.querySelector('[data-sec="23"]');
  if (ageSec) appendAgeNotes(ageSec, fill.ageNotes);
  if (ageSec && fill.costBuildingOnly) {
    for (const td of [...ageSec.querySelectorAll("td.k")]) {
      const label = normLabel(td.textContent ?? "");
      if (label === "قيمة الأرض") td.closest("tr")?.remove();
      else if (label === normLabel("ناتج أسلوب التكلفة (الأرض + المباني)")) {
        td.textContent = "ناتج أسلوب التكلفة (المباني)";
      }
    }
  }

  const finalSec = dom.querySelector('[data-sec="25"]');
  if (finalSec) {
    fillFinalValueTable(finalSec, fill);
    fillFinalBanner(finalSec, fill);
  }

  const people = dom.querySelector('[data-sec="26"]');
  if (people) {
    fillParticipants(
      people,
      resolveReportParticipants(
        extras?.valuers,
        fill.assignedAppraiserName,
        fill.assignedAppraiserId,
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
    // Always overwrite — an empty city/district must not leave the template's sample location.
    fillKeyedInSection(mapsSec, "الموقع", fill.locationLabel || "—");
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

  return extras?.markMissingFields === false ? [] : markReportMissingFields(dom, fill);
}
