import {
  VALUER_ROSTER_MEMBERSHIP_OPTIONS,
  VALUER_SYS_ROLES,
  type BuildingInventoryLineDto,
  type ValuationComparableSelectionListDto,
  type ValuationCostApproachDto,
  type ValuationCostLineDto,
  type ValuationReconciliationDto,
} from "@platform/api-client";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import type { EvaluatorReportChoices } from "./evaluator-window-data";
import { formatAmountNumberDisplay } from "./arabic-amount-words";

export type SheetTableRow = {
  key: string;
  values: string[];
};

export type SheetAreaFacts = {
  ground: string;
  first: string;
  annex: string;
  basement: string;
  annexTotal: string;
  descriptions: SheetTableRow[];
};

const AMENITY_TO_SURROUNDING: Record<string, string> = {
  مساجد: "جامع",
  "مرفق أمني": "مرفق أمني",
  "مقر حكومي": "مقر حكومي",
  مستشفيات: "مرفق طبي",
  "أسواق تجارية": "سوق تجاري",
  حدائق: "حديقة",
  مدارس: "مرفق تعليمي",
  "طرق رئيسية": "طريق سريع",
};

export function dashSheet(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  return t || "—";
}

export function membershipCategoryLabel(key: string | null | undefined): string {
  const t = (key ?? "").trim();
  if (!t) return "";
  return VALUER_ROSTER_MEMBERSHIP_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

export function valuerRoleLabel(key: string | null | undefined): string {
  const t = (key ?? "").trim();
  if (!t) return "";
  return VALUER_SYS_ROLES.find((o) => o.value === t)?.label ?? t;
}

export function yesNoFromFlag(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  if (t === "نعم" || t === "لا") return t;
  return "";
}

export function countOrFlag(
  count: string | null | undefined,
  flag: string | null | undefined,
): string {
  const n = (count ?? "").trim();
  if (n) return n;
  return yesNoFromFlag(flag);
}

export function presentChip(
  selected: string[] | undefined,
  label: string,
): string {
  return (selected ?? []).includes(label) ? "متوفر" : "غير متوفر";
}

export function mapSurroundings(
  amenities: string[] | undefined,
): Record<string, string> {
  const set = new Set(amenities ?? []);
  const out: Record<string, string> = {};
  const used = new Set<string>();
  for (const [chip, label] of Object.entries(AMENITY_TO_SURROUNDING)) {
    out[label] = set.has(chip) ? "يوجد" : "لا يوجد";
    if (set.has(chip)) used.add(chip);
  }
  const other = (amenities ?? []).filter((a) => !used.has(a) && !AMENITY_TO_SURROUNDING[a]);
  out["أخرى"] = other.length ? other.join("، ") : "";
  return out;
}

export function joinObservations(inspector?: InspectorWorkspaceDraft | null): string {
  const rows = inspector?.observations ?? [];
  const bits = rows
    .map((o) => {
      const cat = (o.category ?? "").trim();
      const text = (o.text ?? "").trim();
      if (!cat && !text) return "";
      return cat && text ? `${cat}: ${text}` : cat || text;
    })
    .filter(Boolean);
  return bits.join("؛ ");
}

function lineKind(line: BuildingInventoryLineDto): string {
  return (line.structureKind ?? "").trim().toLowerCase();
}

function lineLabel(line: BuildingInventoryLineDto): string {
  return (line.label ?? "").trim();
}

function lineArea(line: BuildingInventoryLineDto): string {
  return (line.areaSqm ?? "").trim();
}

function looksLike(label: string, ...needles: string[]): boolean {
  return needles.some((n) => label.includes(n));
}

export function areasFromInventory(
  lines: BuildingInventoryLineDto[] | null | undefined,
  inspector?: InspectorWorkspaceDraft | null,
): SheetAreaFacts {
  const rows = [...(lines ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const pick = (
    kind: string,
    needles: string[],
    fallback: string,
  ): { area: string; desc: string; label: string } => {
    const match = rows.find((l) => {
      const k = lineKind(l);
      const lab = lineLabel(l);
      if (k === kind) return needles.length === 0 || looksLike(lab, ...needles);
      return looksLike(lab, ...needles);
    });
    if (match) {
      return {
        area: lineArea(match),
        desc: [lineLabel(match), (match.notes ?? "").trim()].filter(Boolean).join(" — "),
        label: lineLabel(match) || needles[0] || kind,
      };
    }
    return { area: fallback, desc: "", label: needles[0] || kind };
  };

  const ground = pick("floor", ["أرضي", "الأرضي"], "");
  const first = pick("floor", ["الأول", "اول"], "");
  const annex = pick("annex", ["ملحق"], inspector?.annexTotal ?? "");
  const basement = pick("basement", ["قبو"], inspector?.basementTotal ?? "");
  const annexSum = rows
    .filter((l) => lineKind(l) === "annex")
    .map((l) => Number.parseFloat((l.areaSqm ?? "").replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0)
    .reduce((a, b) => a + b, 0);
  const annexTotal =
    annexSum > 0
      ? String(annexSum)
      : (inspector?.annexTotal ?? "").trim();

  const descriptions: SheetTableRow[] = rows
    .filter((l) => lineKind(l) === "floor" || lineKind(l) === "annex" || lineKind(l) === "basement")
    .map((l) => ({
      key: lineLabel(l) || lineKind(l),
      values: [
        [lineLabel(l), (l.notes ?? "").trim()].filter(Boolean).join(" — ") || "—",
      ],
    }));

  if (!descriptions.length) {
    descriptions.push(
      { key: "الدور الأرضي", values: [ground.desc] },
      { key: "الدور الأول", values: [first.desc] },
      { key: "الملحق العلوي", values: [annex.desc] },
    );
  }

  return {
    ground: ground.area,
    first: first.area,
    annex: annex.area,
    basement: basement.area,
    annexTotal,
    descriptions,
  };
}

export function formatMoneyCell(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return formatAmountNumberDisplay(n);
}

function costLineByKey(
  lines: ValuationCostLineDto[] | undefined,
  keys: string[],
  labelNeedles: string[],
): ValuationCostLineDto | undefined {
  const list = (lines ?? []).filter((l) => l.isIncluded !== false);
  return (
    list.find((l) => keys.includes((l.itemKey ?? "").toLowerCase())) ??
    list.find((l) => labelNeedles.some((n) => (l.itemLabelAr || l.label || "").includes(n)))
  );
}

export function costRowCells(
  cost: ValuationCostApproachDto | null | undefined,
  keys: string[],
  needles: string[],
  inventoryArea: string,
): [string, string, string] {
  const line = costLineByKey(cost?.lines, keys, needles);
  if (!line) {
    return [inventoryArea, "", ""];
  }
  const qty = line.areaSqm ? String(line.areaSqm) : inventoryArea;
  const unit = line.unitCostSar ? formatMoneyCell(line.unitCostSar) : "";
  const total = line.lineTotal ? formatMoneyCell(line.lineTotal) : "";
  return [qty, unit, total];
}

export function adoptedComparables(
  market: ValuationComparableSelectionListDto | null | undefined,
) {
  return [...(market?.items ?? [])]
    .filter((i) => i.isAdopted)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 3);
}

export function esgCell(
  group: EvaluatorReportChoices["esgEnv"] | undefined,
): string {
  if (!group) return "";
  if (group.none) return "لا يوجد أثر جوهري";
  const bits = [...(group.selected ?? [])];
  const notes = (group.notes ?? "").trim();
  if (notes) bits.push(notes);
  return bits.join(" — ");
}

export function finishingLevelLabel(
  key: EvaluatorReportChoices["finishingLevel"] | undefined,
): string {
  switch (key) {
    case "luxury":
      return "تشطيب فاخر";
    case "medium":
      return "تشطيب متوسط";
    case "ordinary":
      return "تشطيب عادي";
    case "none":
      return "بدون تشطيب";
    default:
      return "";
  }
}

export function reconWeight(
  recon: ValuationReconciliationDto | null | undefined,
  kinds: string[],
): { weight: string; contrib: string } {
  const m = (recon?.methods ?? []).find((row) =>
    kinds.includes((row.approachKind ?? "").trim().toLowerCase()),
  );
  if (!m || m.isIncluded === false) return { weight: "غير مستخدم", contrib: "" };
  return {
    weight: `${m.weightPct}٪`,
    contrib: formatMoneyCell(m.contributionValue),
  };
}
