/**
 * DOM helpers for filling the valuation report template — imported only by applyValuationReportLiveFill.
 */
import { escHtml } from "./html-escape";
import type { ValuationReportSlotAttachment } from "./valuation-report-print-attachments";
import {
  dash,
  normLabel,
  type ValuationReportLiveFill,
} from "./valuation-report-fill-model";
import { finishingLevelLabel } from "./valuation-report-sheet-facts";
import {
  CLOSEUP_MAP_HOST_ID,
  COMPARABLES_MAP_HOST_ID,
  SATELLITE_MAP_HOST_ID,
  subjectOnlyMapPins,
  type ComparablesMapPin,
} from "./valuation-report-comparables-map";

export function blankValueCells(root: ParentNode) {
  root.querySelectorAll("tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("td.v, td.num")];
    const skipFirstLabel =
      tr.querySelectorAll("td").length > 1 &&
      cells[0] === tr.querySelector("td");
    cells.forEach((td, i) => {
      if (td.classList.contains("k")) return;
      if (skipFirstLabel && i === 0) return;
      td.textContent = "—";
    });
  });
}

export function fillBoundaries(
  sec: Element,
  rows: ValuationReportLiveFill["boundaries"],
) {
  sec.querySelectorAll("tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("td")];
    if (cells.length < 2) return;
    const name = normLabel(cells[0]?.textContent ?? "");
    const row = rows.find((r) => r.name === name);
    if (!row) return;
    if (cells[1]) cells[1].textContent = dash(row.bound);
    if (cells[2]) cells[2].textContent = dash(row.len);
    if (cells[3]) cells[3].textContent = dash(row.face);
  });
}

export function fillMethodRow(sec: Element, methods: [string, string, string]) {
  const dataRow = [...sec.querySelectorAll("tr")].find((tr) =>
    [...tr.querySelectorAll("td")].length >= 3 &&
    !tr.querySelector("th"),
  );
  if (!dataRow) return;
  const cells = [...dataRow.querySelectorAll("td")];
  cells.forEach((cell, i) => {
    if (methods[i] != null) cell.textContent = methods[i]!;
  });
}

export function fillFinalBanner(sec: Element, fill: ValuationReportLiveFill) {
  const banner = [...sec.querySelectorAll("div")].find((d) =>
    (d.getAttribute("style") ?? "").includes("#102b4e"),
  );
  if (!banner) return;
  const kids = [...banner.children];
  const row = kids[0];
  if (row) {
    const parts = [...row.children];
    if (parts[1]) parts[1].textContent = fill.finalDisplay;
  }
  if (kids[1]) kids[1].textContent = fill.finalWords;
}

function rowValueCells(row: Element): Element[] {
  return [...row.children].filter(
    (el): el is HTMLTableCellElement =>
      el instanceof HTMLTableCellElement &&
      (el.classList.contains("v") || el.classList.contains("num")),
  );
}

function fillRowValues(row: Element | undefined, values: string[]) {
  if (!row) return;
  rowValueCells(row).forEach((cell, i) => {
    cell.textContent = values[i] ?? "—";
  });
}

/** Expand/shrink participant-table columns to match the real count from the system. */
function syncParticipantColumns(table: Element, count: number) {
  const cols = Math.max(count, 1);
  const doc = table.ownerDocument;
  if (!doc) return;
  for (const row of table.querySelectorAll("tr")) {
    const labelCell = [...row.children].find(
      (el) => el instanceof HTMLTableCellElement && el.classList.contains("k"),
    );
    if (!labelCell) continue;
    const label = normLabel(labelCell.textContent ?? "");
    const isNum = label.includes("رقم") || label.includes("تاريخ");
    const isSig = label === "التوقيع";
    const valueCells = rowValueCells(row);
    while (valueCells.length > cols) {
      valueCells.pop()?.remove();
    }
    while (valueCells.length < cols) {
      const td = doc.createElement("td");
      td.className = isNum ? "v num" : "v";
      if (isSig) td.setAttribute("style", "height:52px");
      row.appendChild(td);
      valueCells.push(td);
    }
  }
}

/** Equalize participant column widths (excluding the label column). */
function equalizeParticipantColumns(table: Element, count: number) {
  const cols = Math.max(count, 1);
  if (table instanceof HTMLElement) {
    table.style.tableLayout = "fixed";
    table.style.width = "100%";
    table.classList.add("ctr");
  }
  const labelPct = 18;
  const valuePct = (100 - labelPct) / cols;
  for (const row of table.querySelectorAll("tr")) {
    const labelCell = [...row.children].find(
      (el) => el instanceof HTMLTableCellElement && el.classList.contains("k"),
    );
    if (labelCell instanceof HTMLElement) {
      labelCell.style.width = `${labelPct}%`;
    }
    for (const cell of rowValueCells(row)) {
      if (cell instanceof HTMLElement) {
        cell.style.width = `${valuePct}%`;
      }
    }
  }
}

/** Insert the label row if missing from the template (under membership number). */
function ensureParticipantLabeledRow(
  table: Element,
  label: string,
  afterLabel: string,
  cellClass: string,
): Element | undefined {
  const rows = [...table.querySelectorAll("tr")];
  const existing = rows.find(
    (r) => normLabel(r.querySelector("td.k")?.textContent ?? "") === label,
  );
  if (existing) return existing;
  const after = rows.find(
    (r) =>
      normLabel(r.querySelector("td.k")?.textContent ?? "") === afterLabel,
  );
  const doc = table.ownerDocument;
  if (!doc || !after) return undefined;
  const tr = doc.createElement("tr");
  const k = doc.createElement("td");
  k.className = "k";
  k.textContent = label;
  const v = doc.createElement("td");
  v.className = cellClass;
  tr.append(k, v);
  after.after(tr);
  return tr;
}

export type LiveFillParticipant = {
  name: string;
  title: string;
  category: string;
  membership: string;
  membershipExpires: string;
  signatureUrl: string;
};

export function fillParticipants(
  sec: Element,
  people: LiveFillParticipant[],
  branch: string,
) {
  const tables = [...sec.querySelectorAll("table")];
  const table = tables[0];
  if (!table) return;
  ensureParticipantLabeledRow(
    table,
    "تاريخ انتهاء العضوية",
    "رقم العضوية",
    "v num",
  );
  syncParticipantColumns(table, people.length);
  equalizeParticipantColumns(table, people.length);
  const byLabel = (label: string) =>
    [...table.querySelectorAll("tr")].find(
      (r) => normLabel(r.querySelector("td.k")?.textContent ?? "") === label,
    );
  const cols = Math.max(people.length, 1);
  const pad = (pick: (p: LiveFillParticipant) => string) =>
    Array.from({ length: cols }, (_, i) =>
      dash(people[i] ? pick(people[i]!) : ""),
    );
  fillRowValues(byLabel("الاسم"), pad((p) => p.name));
  fillRowValues(byLabel("المسمى الوظيفي"), pad((p) => p.title));
  fillRowValues(byLabel("فئة العضوية"), pad((p) => p.category));
  fillRowValues(byLabel("رقم العضوية"), pad((p) => p.membership));
  fillRowValues(
    byLabel("تاريخ انتهاء العضوية"),
    pad((p) => p.membershipExpires),
  );
  fillRowValues(byLabel("فرع التقييم"), pad(() => branch));
  // Signature from the same participant row (by index) — fixed 1.5cm height, proportional width.
  const sigRow = byLabel("التوقيع");
  if (sigRow) {
    const cells = rowValueCells(sigRow);
    cells.forEach((cell, i) => {
      const url = (people[i]?.signatureUrl ?? "").trim();
      if (!url || url.endsWith("ejadah-signature.png")) {
        cell.replaceChildren();
        return;
      }
      const doc = cell.ownerDocument;
      if (!doc) return;
      const img = doc.createElement("img");
      img.src = url;
      img.alt = "التوقيع";
      img.classList.add("org-signature-roster");
      img.style.objectFit = "contain";
      img.style.maxWidth = "100%";
      img.style.height = "1.5cm";
      img.style.width = "auto";
      img.style.display = "block";
      img.style.marginInline = "auto";
      if (cell instanceof HTMLElement) {
        cell.style.textAlign = "center";
        cell.style.verticalAlign = "middle";
      }
      cell.replaceChildren(img);
    });
  }
}

export function fillApprovalTable(sec: Element, fill: ValuationReportLiveFill) {
  const heading = [...sec.querySelectorAll("h2")].find((h) =>
    (h.textContent ?? "").includes("إعتماد"),
  );
  const table = heading?.nextElementSibling;
  if (!table || table.tagName !== "TABLE") return;
  const put = (label: string, value: string) => {
    table.querySelectorAll("td.k").forEach((labelCell) => {
      if (normLabel(labelCell.textContent ?? "") !== normLabel(label)) return;
      const next = labelCell.nextElementSibling;
      if (
        next &&
        (next.classList.contains("v") || next.classList.contains("num"))
      ) {
        next.textContent = value;
      }
    });
  };
  put("الاسم", fill.cells["اسم المقيم المعتمد"] || "—");
  put("رقم العضوية", fill.cells["رقم العضوية"] || "—");
  put("فرع التقييم", fill.cells["فرع التقييم"] || "—");
  put("فئة العضوية", fill.cells["فئة العضوية"] || "—");
  put("صفته", fill.cells["صفته"] || "—");
  put("تاريخ انتهاء العضوية", fill.cells["تاريخ انتهاء العضوية"] || "—");
}

export function fillKeyedRows(
  sec: Element,
  rows: Array<{ key: string; values: string[] }>,
  match: "exact" | "adjustment" = "exact",
) {
  sec.querySelectorAll("tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("td")];
    if (cells.length < 2) return;
    const name = normLabel(cells[0]?.textContent ?? "");
    const row = rows.find((r) => {
      const key = normLabel(r.key);
      if (key === name) return true;
      if (match === "adjustment" && key === "القيمة بطريقة المقارنة") {
        return name.includes("القيمة بطريقة المقارنة");
      }
      return false;
    });
    if (!row) return;
    row.values.forEach((value, i) => {
      const cell = cells[i + 1];
      if (cell) cell.textContent = value;
    });
  });
}

/**
 * Interactive form spec: one column per approved comparable (up to 5) — expand/shrink
 * adjustment-table columns in the template (header "Comparable (n)", value cells, and total-row colspans).
 */
function syncAdjustmentColumns(sec: Element, count: number) {
  const table = sec.querySelector("table.mx") ?? sec.querySelector("table");
  if (!table) return;
  const headerRow = table.querySelector("tr");
  const headerCells = headerRow ? [...headerRow.querySelectorAll("th")] : [];
  if (headerCells.length < 2) return;
  const currentCols = headerCells.length - 1;
  if (count < 1) return;

  // Table header.
  for (let i = currentCols; i < count; i++) {
    const clone = headerCells[headerCells.length - 1]!.cloneNode(true) as Element;
    headerRow!.appendChild(clone);
  }
  while (headerRow!.querySelectorAll("th").length - 1 > count) {
    headerRow!.querySelectorAll("th")[headerRow!.querySelectorAll("th").length - 1]!.remove();
  }
  [...headerRow!.querySelectorAll("th")].slice(1).forEach((th, i) => {
    th.textContent = `العقار المقارن (${i + 1})`;
  });

  // Value rows: a single spanning cell stays spanning across the new column count;
  // otherwise clone/trim cells to the comparable count.
  [...table.querySelectorAll("tr")].slice(1).forEach((tr) => {
    const cells = [...tr.querySelectorAll("td")];
    if (cells.length < 2) return;
    const valueCells = cells.slice(1);
    if (valueCells.length === 1 && valueCells[0]!.hasAttribute("colspan")) {
      valueCells[0]!.setAttribute("colspan", String(count));
      return;
    }
    for (let i = valueCells.length; i < count; i++) {
      tr.appendChild(valueCells[valueCells.length - 1]!.cloneNode(true));
    }
    while (tr.querySelectorAll("td").length - 1 > count) {
      const all = tr.querySelectorAll("td");
      all[all.length - 1]!.remove();
    }
  });
}

/** Set numbered rows (1..n) in comparable tables to match the approved count. */
export function syncNumberedRows(scope: Element, count: number) {
  const table = scope.matches("table")
    ? scope
    : [...scope.querySelectorAll("table")].find((t) =>
        [...t.querySelectorAll("tr")].some((tr) =>
          /^\d+$/.test((tr.querySelector("td")?.textContent ?? "").trim()),
        ),
      );
  if (!table) return;
  const numbered = () =>
    [...table.querySelectorAll("tr")].filter((tr) =>
      /^\d+$/.test((tr.querySelector("td")?.textContent ?? "").trim()),
    );
  let rows = numbered();
  if (!rows.length) return;
  const target = Math.max(count, 1);
  while (rows.length < target) {
    const clone = rows[rows.length - 1]!.cloneNode(true) as Element;
    rows[rows.length - 1]!.after(clone);
    rows = numbered();
  }
  while (rows.length > target) {
    rows[rows.length - 1]!.remove();
    rows = numbered();
  }
  rows.forEach((tr, i) => {
    const first = tr.querySelector("td");
    if (first) first.textContent = String(i + 1);
    // Clear sample data in cloned/non-matching rows — filled later.
    [...tr.querySelectorAll("td")].slice(1).forEach((td) => {
      td.textContent = "—";
    });
  });
}

export function fillAdjustmentSection(sec: Element, fill: ValuationReportLiveFill) {
  const colCount = fill.adjustmentRows.reduce(
    (m, r) => Math.max(m, r.values.length > 1 ? r.values.length : 0),
    0,
  );
  if (colCount > 0) syncAdjustmentColumns(sec, colCount);
  fillKeyedRows(sec, fill.adjustmentRows, "adjustment");
  sec.querySelectorAll("tr").forEach((tr) => {
    const first = tr.querySelector("td");
    if (!first) return;
    if (!normLabel(first.textContent ?? "").includes("القيمة بطريقة المقارنة")) {
      return;
    }
    first.textContent = fill.adjustmentComparisonLabel;
  });
  const notesCell = [...sec.querySelectorAll("td.k")].find(
    (td) => normLabel(td.textContent ?? "") === "مبررات التسويات",
  )?.nextElementSibling;
  if (notesCell) {
    const text = fill.adjustmentNotes.trim();
    notesCell.replaceChildren();
    if (!text) {
      notesCell.textContent = "—";
      return;
    }
    const ul = sec.ownerDocument.createElement("ul");
    ul.setAttribute("style", "margin:0;padding-inline-start:14px");
    for (const line of text.split("\n")) {
      const li = sec.ownerDocument.createElement("li");
      li.textContent = line;
      ul.appendChild(li);
    }
    notesCell.appendChild(ul);
  }
}

export function fillLoneValueSection(sec: Element, text: string) {
  const cell = sec.querySelector("td.v, td.num");
  if (cell) cell.textContent = text;
}

export function fillKeyedInSection(
  sec: Element,
  label: string,
  value: string,
) {
  sec.querySelectorAll("td.k").forEach((labelCell) => {
    if (normLabel(labelCell.textContent ?? "") !== normLabel(label)) return;
    const next = labelCell.nextElementSibling;
    if (
      next &&
      (next.classList.contains("v") || next.classList.contains("num"))
    ) {
      next.textContent = value;
    }
  });
}

export function rebuildTwoColSheet(
  sec: Element,
  rows: Array<{ key: string; values: string[] }>,
  secondClass: "num" | "v",
) {
  const table = [...sec.querySelectorAll("table")].find((t) =>
    t.querySelector("th"),
  );
  if (!table) {
    fillKeyedRows(sec, rows);
    return;
  }
  const doc = table.ownerDocument;
  const header = table.querySelector("tr");
  if (!header) {
    fillKeyedRows(sec, rows);
    return;
  }
  const seen = new Set<string>();
  const ordered: Array<{ key: string; values: string[] }> = [];
  for (const row of rows) {
    const k = normLabel(row.key);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    ordered.push(row);
  }
  while (table.rows.length > 1) table.deleteRow(-1);
  for (const row of ordered) {
    const tr = doc.createElement("tr");
    if (normLabel(row.key) === "مجموع مسطحات البناء") tr.className = "total";
    const a = doc.createElement("td");
    a.className = "v";
    a.textContent = row.key;
    const b = doc.createElement("td");
    b.className = secondClass;
    b.textContent = row.values[0] ?? "—";
    tr.append(a, b);
    table.appendChild(tr);
  }
}

export function rebuildDirectCostSheet(
  sec: Element,
  rows: Array<{ key: string; values: string[] }>,
) {
  const table = [...sec.querySelectorAll("table")].find((t) =>
    t.querySelector("th"),
  );
  if (!table) {
    fillKeyedRows(sec, rows);
    return;
  }
  const doc = table.ownerDocument;
  const header = table.querySelector("tr");
  if (!header) {
    fillKeyedRows(sec, rows);
    return;
  }
  while (table.rows.length > 1) table.deleteRow(-1);
  for (const row of rows) {
    const tr = doc.createElement("tr");
    const isTotal = normLabel(row.key) === "مجموع التكلفة المباشرة";
    if (isTotal) tr.className = "total";
    const name = doc.createElement("td");
    name.className = "v";
    name.textContent = row.key;
    tr.appendChild(name);
    if (isTotal || row.values.length === 1) {
      const total = doc.createElement("td");
      total.className = "num";
      total.colSpan = 3;
      total.textContent = row.values[0] ?? "—";
      tr.appendChild(total);
    } else if (row.values.length === 2) {
      const lump = doc.createElement("td");
      lump.className = "num";
      lump.colSpan = 2;
      lump.textContent = row.values[0] ?? "—";
      const total = doc.createElement("td");
      total.className = "num";
      total.textContent = row.values[1] ?? "—";
      tr.append(lump, total);
    } else {
      for (const value of row.values.slice(0, 3)) {
        const cell = doc.createElement("td");
        cell.className = "num";
        cell.textContent = value;
        tr.appendChild(cell);
      }
    }
    table.appendChild(tr);
  }
}

export function rebuildIndirectCostSheet(
  sec: Element,
  rows: Array<{ key: string; values: string[] }>,
  totalLabel: string,
) {
  const table = [...sec.querySelectorAll("table")].find((t) =>
    t.querySelector("th"),
  );
  if (!table) {
    fillKeyedRows(sec, rows);
    return;
  }
  const doc = table.ownerDocument;
  if (!table.querySelector("tr")) {
    fillKeyedRows(sec, rows);
    return;
  }
  while (table.rows.length > 1) table.deleteRow(-1);
  for (const row of rows) {
    const tr = doc.createElement("tr");
    const key = normLabel(row.key);
    if (key === "مجموع النسب غير المباشرة") tr.className = "sub";
    if (key === "التكلفة الإجمالية") tr.className = "total";
    const a = doc.createElement("td");
    a.className = "v";
    a.textContent = key === "التكلفة الإجمالية" ? totalLabel : row.key;
    const b = doc.createElement("td");
    b.className = "num";
    b.textContent = row.values[0] ?? "—";
    tr.append(a, b);
    table.appendChild(tr);
  }
}

export function rebuildReconSheet(
  sec: Element,
  rows: Array<{ key: string; values: string[] }>,
) {
  const table = [...sec.querySelectorAll("table")].find((t) =>
    t.querySelector("th"),
  );
  if (!table) {
    fillKeyedRows(sec, rows);
    return;
  }
  const doc = table.ownerDocument;
  if (!table.querySelector("tr")) {
    fillKeyedRows(sec, rows);
    return;
  }
  while (table.rows.length > 1) table.deleteRow(-1);
  for (const row of rows) {
    const tr = doc.createElement("tr");
    const key = normLabel(row.key);
    if (key === "مجموع نسب المشاركة") tr.className = "sub";
    if (key === "القيمة المرجّحة") tr.className = "total";
    const name = doc.createElement("td");
    name.className = "v";
    name.textContent = row.key;
    tr.appendChild(name);
    if (row.values.length === 1) {
      const total = doc.createElement("td");
      total.className = "num";
      total.colSpan = 3;
      total.textContent = row.values[0] ?? "—";
      tr.appendChild(total);
    } else {
      for (const value of row.values.slice(0, 3)) {
        const cell = doc.createElement("td");
        cell.className = "num";
        cell.textContent = value || "—";
        tr.appendChild(cell);
      }
    }
    table.appendChild(tr);
  }
}

/** Slot styles often fix height for the image box — keep that on media, not the figure+caption. */
function splitSlotBoxStyle(style: string): {
  wrapStyle: string;
  mediaHeight: string | null;
} {
  const heightMatch = style.match(/(?:^|;)\s*height\s*:\s*([^;]+)/i);
  const mediaHeight = heightMatch?.[1]?.trim() || null;
  const wrapStyle = style
    .replace(/(?:^|;)\s*height\s*:\s*[^;]+/gi, "")
    .replace(/^;+|;+$/g, "")
    .trim();
  return { wrapStyle, mediaHeight };
}

export function fillImageSlot(
  dom: Document,
  slotId: string,
  item: ValuationReportSlotAttachment | null | undefined,
  emptyLabel: string,
) {
  const el =
    dom.getElementById(slotId) ||
    dom.querySelector(`[data-slot-id="${slotId}"]`);
  if (!el) return;
  const style = el.getAttribute("style") ?? "";
  if (!item?.url) {
    el.className = "image-ph";
    el.replaceChildren();
    el.textContent = emptyLabel;
    if (style) el.setAttribute("style", style);
    return;
  }
  if (item.isImage) {
    const { wrapStyle, mediaHeight } = splitSlotBoxStyle(style);
    const wrap = dom.createElement("figure");
    wrap.className = "attach-fig";
    wrap.style.cssText = [
      wrapStyle || "width:100%",
      "margin:0",
      "overflow:visible",
      "display:flex",
      "flex-direction:column",
    ]
      .filter(Boolean)
      .join(";");
    const img = dom.createElement("img");
    img.src = item.url;
    img.alt = item.labelAr || item.fileName || emptyLabel;
    const fit = item.contentType.includes("svg") ? "contain" : "cover";
    img.style.cssText = [
      "width:100%",
      mediaHeight ? `height:${mediaHeight}` : "height:auto",
      `object-fit:${fit}`,
      "display:block",
      "background:#faf8f3",
      "border-radius:2px",
    ].join(";");
    const cap = dom.createElement("figcaption");
    cap.style.cssText =
      "font-size:9px;margin-top:4px;color:#3a3f4d;line-height:1.35;flex:0 0 auto";
    cap.textContent = item.labelAr || item.fileName || emptyLabel;
    wrap.append(img, cap);
    el.replaceWith(wrap);
    return;
  }
  // Never iframe PDFs into the report HTML — Chrome print preview hangs on
  // "Loading preview…" when laying out data:/blob: PDF frames (often deed/survey).
  const isPdf = item.contentType.toLowerCase().includes("pdf");
  if (isPdf) {
    const note = dom.createElement("div");
    note.className = "attach-pdf-note image-ph";
    if (style) note.setAttribute("style", style);
    else note.style.cssText =
      "display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;min-height:120px;padding:16px;border:1px dashed #c4c0b6;background:#faf8f3;text-align:center";
    const title = dom.createElement("strong");
    title.textContent = item.labelAr || emptyLabel;
    const file = dom.createElement("span");
    file.style.cssText = "font-size:11px;color:#3a3f4d";
    file.textContent = item.fileName || "مرفق PDF";
    const hint = dom.createElement("span");
    hint.style.cssText = "font-size:10px;color:#6b6b66";
    hint.textContent =
      "ملف PDF لا يُضمَّن داخل الطباعة — اطبعه من مرفقات العقار عند الحاجة.";
    note.append(title, file, hint);
    el.replaceWith(note);
    return;
  }
  const link = dom.createElement("p");
  link.className = "attach-link";
  if (style) link.setAttribute("style", style);
  const a = dom.createElement("a");
  a.href = item.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = item.labelAr || item.fileName || emptyLabel;
  link.appendChild(a);
  el.replaceWith(link);
}

function rebuildDefinitionTable(
  sec: Element | null,
  pairs: Array<{ term: string; text: string }>,
  keyWidth = "22%",
) {
  if (!sec || !pairs.length) return;
  const table = sec.querySelector("table");
  if (!table) return;
  const doc = table.ownerDocument;
  table.replaceChildren();
  for (const pair of pairs) {
    const tr = doc.createElement("tr");
    const k = doc.createElement("td");
    k.className = "k";
    k.style.width = keyWidth;
    k.textContent = pair.term;
    const v = doc.createElement("td");
    v.textContent = pair.text;
    tr.append(k, v);
    table.appendChild(tr);
  }
}

/** Replace section paragraphs with org settings text — empty keeps the template text. */
export function fillParagraphSection(sec: Element | null, paragraphs: string[]) {
  if (!sec || !paragraphs.length) return;
  const doc = sec.ownerDocument;
  sec.querySelectorAll("p").forEach((p) => p.remove());
  for (const text of paragraphs) {
    const p = doc.createElement("p");
    p.textContent = text;
    sec.appendChild(p);
  }
}

/** Clear frozen sample dates (2026/06/03) when template text is left unchanged. */
export function scrubFrozenDates(sec: Element | null, reportDateSlash: string) {
  if (!sec || !reportDateSlash) return;
  sec.querySelectorAll("li").forEach((li) => {
    const text = li.textContent ?? "";
    if (text.includes("2026/06/03")) {
      li.textContent = text.replaceAll("2026/06/03", reportDateSlash);
    }
  });
}

export function fillBulletListSection(
  sec: Element | null,
  bullets: string[] | null | undefined,
) {
  if (!sec || bullets == null) return;
  const ul = sec.querySelector("ul");
  if (!ul) return;
  const doc = sec.ownerDocument;
  ul.replaceChildren();
  for (const text of bullets) {
    const li = doc.createElement("li");
    li.textContent = text;
    ul.appendChild(li);
  }
}

function fillResearchScopeSection(
  sec: Element | null,
  bullets: string[],
  notes: string,
) {
  if (!sec) return;
  if (bullets.length) fillBulletListSection(sec, bullets);
  const existing = sec.querySelector(".search-scope-notes");
  if (existing) existing.remove();
  if (!notes) return;
  const doc = sec.ownerDocument;
  const noteBlock = doc.createElement("table");
  noteBlock.className = "search-scope-notes";
  noteBlock.style.marginTop = "8px";
  const tr = doc.createElement("tr");
  const k = doc.createElement("td");
  k.className = "k";
  k.style.width = "28%";
  k.textContent = "ملاحظات نطاق البحث";
  const v = doc.createElement("td");
  v.className = "v";
  v.textContent = notes;
  tr.append(k, v);
  noteBlock.appendChild(tr);
  sec.appendChild(noteBlock);
}

function formatFinishingHtml(text: string): string {
  const t = text.trim();
  if (!t) return "";
  // Org settings use "Exterior finishes: …\nInterior finishes: …"
  const parts = t.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  return parts
    .map((line) => {
      const colon = line.indexOf(":");
      if (colon > 0 && colon < 40) {
        const head = line.slice(0, colon).trim();
        const body = line.slice(colon + 1).trim();
        return `<b>${escHtml(head)}:</b><br>${escHtml(body)}`;
      }
      return escHtml(line);
    })
    .join("<br>");
}

export function fillFinishingLevelSection(
  sec: Element | null,
  fill: ValuationReportLiveFill,
) {
  if (!sec) return;
  const table = sec.querySelector("table");
  if (!table) return;
  const rows = [...table.querySelectorAll("tr")];
  const header = rows[0];
  const body = rows[1];
  const noneRow = rows.find((tr) =>
    normLabel(tr.textContent ?? "").includes("بدون تشطيب"),
  );
  if (!header || !body) return;

  const headers = [...header.querySelectorAll("th")];
  const cells = [...body.querySelectorAll("td")];
  const level = fill.finishingLevel;
  const label = finishingLevelLabel(level);

  const texts = [
    fill.finishingTexts.luxury,
    fill.finishingTexts.medium,
    fill.finishingTexts.ordinary,
  ];
  cells.forEach((cell, i) => {
    const html = formatFinishingHtml(texts[i] ?? "");
    if (html) {
      cell.innerHTML = html;
      cell.style.fontSize = "9px";
      cell.style.lineHeight = "1.5";
    }
  });

  const clearMark = (el: Element) => {
    el.removeAttribute("data-finishing-selected");
    const htmlEl = el as HTMLElement;
    htmlEl.style.outline = "";
    htmlEl.style.outlineOffset = "";
    htmlEl.style.background = "";
    htmlEl.style.color = "";
    htmlEl.style.boxShadow = "";
    htmlEl.style.opacity = "";
    htmlEl.style.display = "";
    htmlEl.style.width = "";
  };

  const hideEl = (el: Element) => {
    (el as HTMLElement).style.display = "none";
  };

  headers.forEach(clearMark);
  cells.forEach(clearMark);
  if (noneRow) {
    [...noneRow.querySelectorAll("th, td")].forEach(clearMark);
    (noneRow as HTMLElement).style.display = "";
  }
  (header as HTMLElement).style.display = "";
  (body as HTMLElement).style.display = "";

  if (!label) return;

  if (level === "none" && noneRow) {
    hideEl(header);
    hideEl(body);
    const th = noneRow.querySelector("th");
    if (th) {
      th.textContent = normLabel(th.textContent ?? "بدون تشطيب").replace(
        /^✓\s*/,
        "",
      );
    }
    return;
  }

  const idx = headers.findIndex((th) => {
    const text = normLabel(th.textContent ?? "").replace(/^✓\s*/, "");
    return text === normLabel(label);
  });
  if (idx < 0) return;

  if (noneRow) hideEl(noneRow);

  headers.forEach((th, i) => {
    if (i === idx) {
      (th as HTMLElement).style.width = "100%";
      th.textContent = normLabel(th.textContent ?? "").replace(/^✓\s*/, "");
    } else {
      hideEl(th);
    }
  });
  cells.forEach((td, i) => {
    if (i === idx) {
      (td as HTMLElement).style.width = "100%";
    } else {
      hideEl(td);
    }
  });
}

export function fillGoogleMapHostSlot(
  dom: Document,
  slotId: string,
  hostId: string,
  pins: ComparablesMapPin[],
  item: ValuationReportSlotAttachment | null | undefined,
  emptyLabel: string,
  caption: string,
  interactive: boolean,
  extras?: { zoom?: number; mapType?: string; heightPx?: number },
) {
  const el =
    dom.getElementById(slotId) ||
    dom.querySelector(`[data-slot-id="${slotId}"]`);
  if (!el) return;

  const hasGoogleKey = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim(),
  );
  if (interactive && hasGoogleKey && pins.length > 0) {
    const style = el.getAttribute("style") ?? "";
    const { wrapStyle } = splitSlotBoxStyle(style);
    const height = extras?.heightPx ?? 280;
    const center = pins.find((p) => p.kind === "subject") ?? pins[0]!;
    const wrap = dom.createElement("figure");
    wrap.className = "attach-fig";
    wrap.style.cssText = [
      wrapStyle || "width:100%",
      "margin:0",
      "overflow:visible",
      "display:flex",
      "flex-direction:column",
    ]
      .filter(Boolean)
      .join(";");
    const host = dom.createElement("div");
    host.id = hostId;
    host.setAttribute("data-ejada-gmap", "1");
    host.setAttribute("data-pins", JSON.stringify(pins));
    host.setAttribute("data-lat", String(center.lat));
    host.setAttribute("data-lng", String(center.lng));
    if (extras?.zoom != null) host.setAttribute("data-zoom", String(extras.zoom));
    if (extras?.mapType) host.setAttribute("data-map-type", extras.mapType);
    host.setAttribute(
      "style",
      `width:100%;height:${height}px;min-height:${Math.min(height, 220)}px;border-radius:8px;overflow:hidden;background:#e9e6df;flex:0 0 auto`,
    );
    const mount = dom.createElement("div");
    mount.className = "ejada-gmap-mount";
    mount.setAttribute(
      "style",
      "width:100%;height:100%;min-height:220px",
    );
    host.appendChild(mount);
    const cap = dom.createElement("figcaption");
    cap.style.cssText =
      "font-size:9px;margin-top:4px;color:#3a3f4d;line-height:1.35;flex:0 0 auto";
    cap.textContent = item?.labelAr || caption;
    wrap.append(host, cap);
    el.replaceWith(wrap);
    return;
  }

  fillImageSlot(dom, slotId, item, emptyLabel);
}

export function fillComparablesMapSlot(
  dom: Document,
  item: ValuationReportSlotAttachment | null | undefined,
  pins: ComparablesMapPin[],
  emptyLabel: string,
  interactive: boolean,
) {
  fillGoogleMapHostSlot(
    dom,
    "map-comparables",
    COMPARABLES_MAP_HOST_ID,
    pins,
    item,
    emptyLabel,
    "خريطة مواقع المقارنات",
    interactive,
    { heightPx: 280, mapType: "hybrid" },
  );
}

export function fillLocationMapsSlots(
  dom: Document,
  fill: ValuationReportLiveFill,
  interactive: boolean,
) {
  // Both §33 maps must share the exact same subject pin (never a random comparable).
  const pins = subjectOnlyMapPins(fill.comparablesMapPins ?? []);

  fillGoogleMapHostSlot(
    dom,
    "map-satellite",
    SATELLITE_MAP_HOST_ID,
    pins,
    fill.comparableMapSlot,
    "خريطة الأقمار الصناعية — تُرفق صورة الموقع",
    "خريطة الأقمار الصناعية",
    interactive,
    { zoom: 15, mapType: "hybrid", heightPx: 300 },
  );
  fillGoogleMapHostSlot(
    dom,
    "map-closeup",
    CLOSEUP_MAP_HOST_ID,
    pins,
    fill.closeupMapSlot ?? fill.comparableMapSlot,
    "صورة مقربة للموقع — تُرفق صورة",
    "خريطة الموقع العام",
    interactive,
    { zoom: 18, mapType: "satellite", heightPx: 300 },
  );
}

export function fillAttachmentAndGlossarySections(
  dom: Document,
  fill: ValuationReportLiveFill,
  options?: { interactiveComparablesMap?: boolean },
) {
  fillComparablesMapSlot(
    dom,
    fill.comparableMapSlot,
    fill.comparablesMapPins ?? [],
    "خريطة مواقع المقارنات — اسحب الصورة هنا",
    options?.interactiveComparablesMap === true,
  );

  const photos = fill.photoSlots ?? [];
  for (let i = 0; i < 12; i++) {
    fillImageSlot(
      dom,
      `photo-${i + 1}`,
      photos[i] ?? null,
      "—",
    );
  }

  fillImageSlot(
    dom,
    "survey-report",
    fill.surveySlot,
    "التقرير المساحي — يُرفق مستند الرفع المساحي",
  );
  fillImageSlot(
    dom,
    "deed",
    fill.deedSlot,
    "صك الملكية — تُرفق صورة الصك",
  );

  fillResearchScopeSection(
    dom.querySelector('[data-sec="28"]'),
    fill.researchScopeBullets,
    fill.searchScopeNotes,
  );

  fillBulletListSection(
    dom.querySelector('[data-sec="29"]'),
    fill.specialAssumptionBullets,
  );

  rebuildDefinitionTable(
    dom.querySelector('[data-sec="37"]'),
    fill.ivsPairs,
    "22%",
  );

  const glossary = fill.glossaryPairs ?? [];
  if (glossary.length) {
    const mid = Math.ceil(glossary.length / 2);
    rebuildDefinitionTable(
      dom.querySelector('[data-sec="38"]'),
      glossary.slice(0, mid),
      "20%",
    );
    const rest = glossary.slice(mid);
    const secB = dom.querySelector('[data-sec="38ب"]');
    if (rest.length) {
      rebuildDefinitionTable(secB, rest, "20%");
    } else if (secB) {
      const table = secB.querySelector("table");
      if (table) table.replaceChildren();
    }
  }
}
