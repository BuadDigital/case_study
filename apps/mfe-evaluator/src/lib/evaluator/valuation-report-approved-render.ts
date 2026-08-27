import type { ValuationReportDocumentDto } from "@platform/api-client";
import { escHtml as esc } from "./html-escape";

function field(doc: ValuationReportDocumentDto, sectionNumber: number, key: string): string {
  const section = doc.sections.find((s) => s.number === sectionNumber);
  const v = section?.fields?.[key];
  return v == null || v === "" ? "-" : String(v);
}

function dash(v: string | null | undefined): string {
  return v == null || v.trim() === "" ? "-" : v;
}

/** قاعدة n (11ك): weighting table only with two or more included methods. */
function isMultiMethod(doc: ValuationReportDocumentDto): boolean {
  return doc.sections.find((s) => s.number === 15)?.fields?.["multiMethod"] === "yes";
}

function kvTable(rows: Array<[string, string] | [string, string, string, string]>): string {
  const body = rows
    .map((row) => {
      if (row.length === 2) {
        return `<tr><td class="k">${esc(row[0])}</td><td class="v" colspan="3">${esc(row[1])}</td></tr>`;
      }
      return `<tr><td class="k">${esc(row[0])}</td><td class="v">${esc(row[1])}</td><td class="k">${esc(row[2])}</td><td class="v">${esc(row[3])}</td></tr>`;
    })
    .join("");
  return `<table>${body}</table>`;
}

function attachmentPlaceholder(title: string, note: string): string {
  return `<p class="attach-ph"><strong>${esc(title)}</strong><br>${esc(note)}</p>`;
}

function resolveAttachmentUrl(contentUrl: string): string {
  if (!contentUrl) return "";
  if (/^https?:\/\//i.test(contentUrl)) return contentUrl;
  // Absolute to current origin so the preview window can load API assets.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return contentUrl.startsWith("/") ? `${origin}${contentUrl}` : `${origin}/${contentUrl}`;
}

function renderPrintedAttachments(
  items: NonNullable<ValuationReportDocumentDto["photoAttachments"]>,
  emptyTitle: string,
  emptyNote: string,
  perPage?: number,
): string {
  if (!items?.length) return attachmentPlaceholder(emptyTitle, emptyNote);

  const renderOne = (a: (typeof items)[number]): string => {
    const url = resolveAttachmentUrl(a.contentUrl);
    // 11س — photos print with their auto-capture date.
    const dated = a.capturedAtDisplay
      ? `${a.labelAr || "صورة"} — ${a.capturedAtDisplay}`
      : a.labelAr || a.fileName || "مرفق";
    const caption = esc(dated);
    const name = esc(a.fileName || a.attachmentId);
    if (a.isImage) {
      return `<figure class="attach-fig"><img src="${esc(url)}" alt="${caption}" /><figcaption>${caption}<br><span class="attach-fn">${name}</span></figcaption></figure>`;
    }
    return `<p class="attach-link"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${caption}</a> — <span class="attach-fn">${name}</span></p>`;
  };

  // 11س — ست صور في الصفحة: chunked grids with print page breaks between them.
  if (perPage && perPage > 0) {
    const chunks: string[] = [];
    for (let i = 0; i < items.length; i += perPage) {
      const chunk = items.slice(i, i + perPage).map(renderOne).join("");
      const breakStyle =
        i + perPage < items.length ? ' style="page-break-after:always"' : "";
      chunks.push(`<div class="attach-grid"${breakStyle}>${chunk}</div>`);
    }
    return chunks.join("");
  }

  return `<div class="attach-grid">${items.map(renderOne).join("")}</div>`;
}

function buildSectionBody(sec: number, doc: ValuationReportDocumentDto): string | null {
  switch (sec) {
    case 1:
      return kvTable([
        ["اسم المقيم المعتمد", field(doc, 1, "name"), "رقم ترخيص مزاولة المهنة", field(doc, 1, "licenseNumber")],
        ["رقم العضوية", field(doc, 1, "membershipNumber"), "فرع التقييم", "جدة — المملكة"],
        ["انتهاء الترخيص", field(doc, 1, "licenseExpiresAt"), "انتهاء العضوية", field(doc, 1, "membershipExpiresAt")],
      ]);
    case 2:
      return (
        kvTable([
          ["اسم / رقم المعاملة", field(doc, 2, "displayId"), "تاريخ التقرير", doc.reportDateDisplay],
          ["التاريخ الهجري", dash(doc.reportDateHijriDisplay), "نوع التقرير", field(doc, 2, "reportType")],
          ["العميل", field(doc, 2, "clientName"), "مستخدمو التقرير", field(doc, 2, "reportUsers")],
          ["عملة التقييم", field(doc, 2, "currency"), "نوع العقار", field(doc, 2, "propertyType")],
          ["أساس القيمة", field(doc, 2, "basis"), "فرضية القيمة", field(doc, 2, "premise")],
          ["المساحة", field(doc, 2, "area"), "صلاحية التقرير حتى", dash(doc.validUntilDisplay)],
        ]) +
        `<p>${esc(field(doc, 2, "usageRestriction"))}</p>` +
        `<p>نطاق العمل يُشتق من بيانات المعاملة والعقار محل التقييم. النصوص القانونية تُجمَّد عند الإصدار.</p>`
      );
    case 3:
      return kvTable([
        ["أساس القيمة", field(doc, 3, "basis"), "فرضية القيمة", field(doc, 3, "premise")],
        ["العملة", field(doc, 3, "currency"), "نوع التقرير", field(doc, 3, "reportType")],
        ["نوع العقار", field(doc, 3, "propertyType"), "المساحة", field(doc, 3, "area")],
        ["وجود مبانٍ", field(doc, 3, "hasStructures"), "رأي السوق", dash(doc.marketOpinionDisplay)],
        ["رأي التكلفة", dash(doc.costOpinionWithLandDisplay), "الرأي النهائي", dash(doc.finalOpinionDisplay)],
      ]);
    case 6:
      return kvTable([
        ["رقم الصك / المعرف", field(doc, 6, "deedNumber")],
        ["المالك", field(doc, 6, "ownerName")],
        ["نوع الملكية", field(doc, 6, "ownershipType")],
        ["المدينة / الحي", `${field(doc, 6, "city")} / ${field(doc, 6, "district")}`],
        ["هل توجد مبانٍ/إنشاءات؟", field(doc, 6, "hasStructures") === "yes" ? "نعم" : "لا"],
        // Building-only rows (decision 6 / 8ب) — deleted for land, no dash.
        ...(doc.hasStructuresToValue
          ? ([
              ["حالة العقار", field(doc, 6, "propertyCondition")],
              ["حصر المباني والإنشاءات", field(doc, 6, "inventorySummary")],
            ] as Array<[string, string]>)
          : []),
        ["المنقولات", field(doc, 6, "movables")],
      ]);
    case 7:
      return kvTable([
        ["المنطقة", field(doc, 7, "region"), "المدينة", field(doc, 7, "city")],
        ...(doc.hasStructuresToValue
          ? ([
              ["عمر البناء (سنة)", field(doc, 7, "buildingAge"), "حالة الإشغال", field(doc, 7, "occupancyState")],
            ] as Array<[string, string, string, string]>)
          : []),
        ["الحي", field(doc, 7, "district"), "رقم المخطط", field(doc, 7, "planNumber")],
        ["اسم المخطط", field(doc, 7, "planName"), "القطعة", field(doc, 7, "plotNumber")],
        ["البلوك", field(doc, 7, "blockNumber")],
      ]);
    case 8:
      return kvTable([
        ["شمال", field(doc, 8, "north"), "نوع الحد", field(doc, 8, "northType")],
        ["تشطيب الواجهة شمالاً", field(doc, 8, "northFacade")],
        ["جنوب", field(doc, 8, "south"), "نوع الحد", field(doc, 8, "southType")],
        ["تشطيب الواجهة جنوباً", field(doc, 8, "southFacade")],
        ["شرق", field(doc, 8, "east"), "نوع الحد", field(doc, 8, "eastType")],
        ["تشطيب الواجهة شرقاً", field(doc, 8, "eastFacade")],
        ["غرب", field(doc, 8, "west"), "نوع الحد", field(doc, 8, "westType")],
        ["تشطيب الواجهة غرباً", field(doc, 8, "westFacade")],
        ["عدد الشوارع", field(doc, 8, "streetCount")],
      ]);
    case 9:
      return kvTable([
        [
          "وضع المرافق / الخدمات",
          field(doc, 9, "mode") === "full_services"
            ? "خدمات كاملة (عقار بمبانٍ)"
            : "مرافق المنطقة (أرض خالية)",
        ],
      ]) +
      (field(doc, 9, "services") !== "-"
        ? `<p>الخدمات المرصودة ميدانيًا: ${esc(field(doc, 9, "services"))}</p>`
        : "") +
      `<p>${esc(field(doc, 9, "body"))}</p>`;
    case 10:
      return `<p>${esc(field(doc, 10, "body"))}</p>`;
    case 11:
      return `<table>
        <tr><th style="width:33%">أسلوب السوق</th><th style="width:33%">أسلوب التكلفة</th><th>أسلوب الدخل</th></tr>
        <tr><td class="v">${esc(doc.marketMethodLabelAr)}</td><td class="v">${esc(doc.costMethodLabelAr)}</td><td class="v">${esc(doc.incomeMethodLabelAr)}</td></tr>
      </table>`;
    case 12: {
      if (!doc.comparables?.length) {
        return `<p>لا مقارنات معتمدة في هذا الطلب.</p>`;
      }
      const rows = doc.comparables
        .map(
          (c) => `<tr>
          <td class="num">${c.index}</td>
          <td class="v">${esc(c.comparablePropertyType)}</td>
          <td class="v">${esc(c.transactionCell)}</td>
          <td class="num">${esc(c.areaSqmDisplay)}</td>
          <td class="num">${esc(c.transactionDateDisplay)}</td>
          <td class="num">${esc(c.priceDisplay)}</td>
          <td class="num">${esc(c.pricePerSqmDisplay)}</td>
        </tr>`,
        )
        .join("");
      return (
        `<table>
        <tr><th style="width:5%">#</th><th style="width:13%">العقار المقارن</th><th style="width:24%">نوع العملية</th><th style="width:11%">المساحة</th><th style="width:13%">تاريخ العملية</th><th style="width:14%">السعر</th><th style="width:12%">سعر المتر</th></tr>
        ${rows}
      </table>` +
        kvTable([
          ["مساحة الأصل", dash(doc.subjectAreaSqmDisplay), "سعر المتر المرجّح", dash(doc.weightedPricePerSqmDisplay)],
          ["رأي أسلوب السوق", dash(doc.marketOpinionDisplay)],
        ])
      );
    }
    case 13:
      return (
        `<p>${esc(field(doc, 13, "body"))}</p>` +
        attachmentPlaceholder(
          "خريطة المقارنات",
          "تُرسم صورة الخريطة النهائية من إحداثيات الأصل والمقارنات أعلاه عند الإصدار.",
        )
      );
    case 14: {
      if (!doc.adjustments?.length) {
        return `<p>لا تسويات للمقارنات المعتمدة.</p>`;
      }
      const rows = doc.adjustments
        .map(
          (a) => `<tr>
          <td class="num">${a.index}</td>
          <td class="v">${esc(a.comparableLabel)}</td>
          <td class="num">${esc(a.sequentialPctDisplay)}</td>
          <td class="num">${esc(a.differencePctDisplay)}</td>
          <td class="num">${esc(a.weightPctDisplay)}</td>
          <td class="num">${esc(a.adjustedPricePerSqmDisplay)}</td>
        </tr>`,
        )
        .join("");
      const adjustedHeader =
        field(doc, 14, "adjustmentBasis") === "whole_property"
          ? "قيمة العقار بعد التسوية"
          : "سعر المتر بعد التسوية";
      return (
        `<table>
        <tr><th>#</th><th>المقارن</th><th>تسلسل %</th><th>اختلاف %</th><th>الوزن %</th><th>${adjustedHeader}</th></tr>
        ${rows}
      </table>` +
        `<p>المبررات التفصيلية لكل عامل تُطبع من تبويب المقارنات دون الاقتراح الآلي.</p>`
      );
    }
    case 15:
      return kvTable([["مبرر استخدام طرق التقييم", doc.methodsRationale?.trim() || "-"]]);
    case 16: {
      // قاعدة n (11ك/11ل): with one method there is no weighting table at all —
      // its value flows straight to the final opinion and section 15 carries the
      // rationale. With n≥2 the table prints and the rationale is its LAST row.
      const methodRows =
        isMultiMethod(doc) && doc.reconciliationMethods?.length > 0
          ? `<table>
        <tr><th>الطريقة</th><th>قيمة الأسلوب</th><th>الوزن %</th><th>المساهمة</th></tr>
        ${doc.reconciliationMethods
          .map(
            (m) => `<tr>
            <td class="v">${esc(m.labelAr)}</td>
            <td class="num">${esc(m.approachValueDisplay)}</td>
            <td class="num">${esc(m.weightPctDisplay)}</td>
            <td class="num">${esc(m.contributionDisplay)}</td>
          </tr>`,
          )
          .join("")}
        <tr><td class="k">مبرر استخدام طرق التقييم</td><td class="v" colspan="3">${esc(
          doc.methodsRationale?.trim() || "-",
        )}</td></tr>
      </table>`
          : "";
      const costBlock = doc.costApproachUsed
        ? kvTable([
            ["قيمة الأرض من السوق", dash(doc.landValueFromMarketDisplay)],
            ["رأي التكلفة مع الأرض", dash(doc.costOpinionWithLandDisplay)],
            ["رأي المباني فقط", dash(doc.costOpinionBuildingsOnlyDisplay)],
          ])
        : "";
      return (
        methodRows +
        costBlock +
        kvTable([
          ["أساس القيمة", field(doc, 16, "basis"), "فرضية القيمة", field(doc, 16, "premise")],
          ["القيمة المرجّحة", dash(doc.weightedValueDisplay)],
          ["قبل خصم التصفية", field(doc, 16, "beforeLiquidation")],
          ["خصم التصفية %", field(doc, 16, "discountPct")],
          ["الرأي النهائي للقيمة", doc.finalOpinionDisplay ? `${doc.finalOpinionDisplay} ر.س` : "-"],
          ["التفقيط", dash(doc.finalOpinionTafqit)],
          ["بوابات الإصدار", doc.allowsIssuance ? "جاهز" : "غير مكتملة"],
        ])
      );
    }
    case 17:
      return kvTable([
        ["المقيم المعتمد", field(doc, 1, "name")],
        ["المشاركون النشطون", field(doc, 17, "rosterNames")],
        ["عدد المشاركين", field(doc, 17, "rosterCount")],
        ["كلمة المقيم", doc.valuerWordPlain],
      ]);
    case 18:
      return `<p>${esc(field(doc, 18, "body"))}</p>`;
    case 20:
      return `<p>${esc(field(doc, 20, "body"))}</p>`;
    case 4:
    case 5:
    case 19:
    case 21:
    case 26:
    case 27:
      return `<p class="frozen">${esc(field(doc, sec, "body"))}</p><p class="attach-fn">${esc(field(doc, sec, "textVersion"))}</p>`;
    case 22:
      return renderPrintedAttachments(
        doc.siteMapAttachments ?? [],
        "خرائط الموقع",
        "لا مرفقات مصنّفة للطباعة في هذا القسم — صنّف الكروكي/الخريطة من مرفقات العقار.",
      );
    case 23:
      return renderPrintedAttachments(
        doc.photoAttachments ?? [],
        "صور العقار",
        doc.photoBudgetHintAr || "لا صور مصنّفة للطباعة بعد.",
        6,
      );
    case 24:
      return renderPrintedAttachments(
        doc.surveyAttachments ?? [],
        "التقرير المساحي",
        "لا تقرير مساحي مصنّف للطباعة.",
      );
    case 25:
      return renderPrintedAttachments(
        doc.deedAttachments ?? [],
        "صك الملكية",
        "لا صورة صك مصنّفة للطباعة.",
      );
    default: {
      const section = doc.sections.find((s) => s.number === sec);
      if (!section?.previewText) return null;
      if (section.bodyKind === "FrozenText") {
        return `<p class="frozen">${esc(section.previewText)}</p>`;
      }
      return `<p>${esc(section.previewText)}</p>`;
    }
  }
}

/**
 * الكليشة أصل نظام تُستبدل من الإعدادات دون أثر على الكود :
 * ثلاث شرائح من هوامش الهوية البصرية (افتراضي HTML: ترويسة 41مم، تذييل من 270مم، يمين 13مم).
 * Null keeps the template's baked letterhead untouched.
 */
function applyLetterheadSlices(
  dom: Document,
  letterheadUrl?: string | null,
  geo?: {
    letterheadHeadMm?: number | null;
    letterheadFootTopMm?: number | null;
    letterheadPadStartMm?: number | null;
  },
): void {
  const url = letterheadUrl?.trim();
  if (!url) return;
  const cssUrl = url.replace(/["\)]/g, "");
  const head = geo?.letterheadHeadMm && geo.letterheadHeadMm > 0 ? geo.letterheadHeadMm : 41;
  const footTop =
    geo?.letterheadFootTopMm && geo.letterheadFootTopMm > 0 ? geo.letterheadFootTopMm : 270;
  const footH = Math.max(0, 297 - footTop);
  const side =
    geo?.letterheadPadStartMm && geo.letterheadPadStartMm > 0 ? geo.letterheadPadStartMm : 13;
  const style = dom.createElement("style");
  style.textContent =
    `.sheet{position:relative;background:#fff!important}` +
    `.lh-slice{position:absolute;pointer-events:none;background-image:url("${cssUrl}")}` +
    `.lh-head{top:0;left:0;right:0;height:${head}mm;background-size:210mm auto;background-position:top center;background-repeat:no-repeat}` +
    `.lh-foot{bottom:0;left:0;right:0;height:${footH}mm;background-size:210mm auto;background-position:bottom center;background-repeat:no-repeat}` +
    `.lh-side{top:${head}mm;bottom:${footH}mm;right:0;width:${side}mm;background-size:210mm auto;background-position:top right;background-repeat:repeat-y}`;
  dom.head.appendChild(style);
  dom.querySelectorAll<HTMLElement>(".sheet").forEach((sheet) => {
    for (const cls of ["lh-head", "lh-foot", "lh-side"]) {
      const slice = dom.createElement("div");
      slice.className = `lh-slice ${cls}`;
      sheet.insertBefore(slice, sheet.firstChild);
    }
  });
}

function applyStampSize(
  dom: Document,
  widthCm?: number | null,
  heightCm?: number | null,
): void {
  const w = widthCm && widthCm > 0 ? widthCm : 4;
  const h = heightCm && heightCm > 0 ? heightCm : 4;
  dom.querySelectorAll("img").forEach((img) => {
    const alt = img.getAttribute("alt") ?? "";
    const src = img.getAttribute("src") ?? "";
    if (!/ختم|stamp/i.test(`${alt} ${src}`)) return;
    img.style.width = `${w}cm`;
    img.style.height = `${h}cm`;
    img.style.objectFit = "contain";
  });
}

/** Attachment-page sections (map/photos/survey/deed) — full-page containers. */
const FULL_PAGE_SECTIONS = new Set([13, 22, 23, 24, 25]);

/**
 * Stages every section for the auto page-flow: the first sheet keeps its chrome
 * (meta + report title) and becomes page one; the packer script below re-packs
 * sections into cloned sheets in the preview window, where real heights exist.
 */
function reflowSheets(dom: Document): void {
  const sheets = Array.from(dom.querySelectorAll<HTMLElement>(".sheet"));
  const sections = Array.from(dom.querySelectorAll<HTMLElement>("section[data-sec]"));
  if (!sheets.length || !sections.length) return;

  // Deleted conditionals pull the printed numbering up (renumber decision — no gaps).
  sections.forEach((sec, i) => {
    const n = sec.querySelector("h2 .n");
    if (n) n.textContent = String(i + 1).padStart(2, "0");
    if (FULL_PAGE_SECTIONS.has(Number(sec.getAttribute("data-sec"))))
      sec.setAttribute("data-fullpage", "1");
  });

  const first = sheets[0];
  const proto = first.cloneNode(true) as HTMLElement;
  proto.querySelectorAll("section[data-sec]").forEach((el) => el.remove());
  // The prototype keeps only the corner meta — the report title prints once.
  proto.querySelectorAll(":scope > div:not(.pg-meta):not(.lh-slice)").forEach((el) => el.remove());

  const staging = dom.createElement("div");
  staging.id = "flow-staging";
  staging.setAttribute("style", "display:none");
  sections.forEach((el) => staging.appendChild(el));

  const template = dom.createElement("template");
  template.id = "sheet-proto";
  template.innerHTML = proto.outerHTML;

  sheets.slice(1).forEach((el) => el.remove());
  first.querySelectorAll("section[data-sec]").forEach((el) => el.remove());

  dom.body.appendChild(staging);
  dom.body.appendChild(template);

  const packer = dom.createElement("script");
  packer.textContent = FLOW_PACKER_JS;
  dom.body.appendChild(packer);
}

// Runs after `load` (images sized) — greedy pack, never splitting a section.
const FLOW_PACKER_JS = `(function(){
function run(){
 var staging=document.getElementById('flow-staging');
 var proto=document.getElementById('sheet-proto');
 var first=document.querySelector('.sheet');
 if(!staging||!proto||!first)return;
 var last=first,current=first;
 function newSheet(){
  var s=proto.content.firstElementChild.cloneNode(true);
  last.insertAdjacentElement('afterend',s);
  last=s;
  return s;
 }
 function overflows(s){return s.scrollHeight>s.clientHeight+2;}
 var secs=Array.prototype.slice.call(staging.querySelectorAll('section[data-sec]'));
 secs.forEach(function(sec){
  if(sec.getAttribute('data-fullpage')==='1'){
   var f=newSheet();
   f.appendChild(sec);
   current=null;
   return;
  }
  if(!current)current=newSheet();
  current.appendChild(sec);
  if(overflows(current)&&current.querySelectorAll('section[data-sec]').length>1){
   var n=newSheet();
   n.appendChild(sec);
   current=n;
  }
 });
 staging.remove();
 proto.remove();
}
if(document.readyState==='complete')run();
else window.addEventListener('load',run);
})();`;

export type ValuationReportMergeExtras = {
  reportNumber?: string | null;
  depositCode?: string | null;
};

/** Merge live valuation document into the approved letterhead HTML. */
export function mergeApprovedValuationTemplate(
  templateHtml: string,
  doc: ValuationReportDocumentDto,
  extras?: ValuationReportMergeExtras,
): string {
  const parser = new DOMParser();
  const dom = parser.parseFromString(templateHtml, "text/html");

  dom.querySelectorAll(".rbar, .rv, .rv-note").forEach((el) => el.remove());
  dom.querySelectorAll("section").forEach((el) => {
    el.classList.remove("marked-keep", "marked-cut", "marked-edit");
  });

  const reportNo = extras?.reportNumber?.trim() || doc.reportNumber?.trim() || doc.displayId;
  const deposit = extras?.depositCode?.trim() || "—";
  const hijri = doc.reportDateHijriDisplay?.trim();
  const metaHtml = hijri
    ? `رقم التقرير: ${esc(reportNo)}<br>التاريخ: ${esc(doc.reportDateDisplay)} م<br>${esc(hijri)}<br>رمز إيداع التقرير: ${esc(deposit)}`
    : `رقم التقرير: ${esc(reportNo)}<br>التاريخ: ${esc(doc.reportDateDisplay)}<br>رمز إيداع التقرير: ${esc(deposit)}`;
  dom.querySelectorAll(".pg-meta").forEach((el) => {
    el.innerHTML = metaHtml;
  });

  const included = new Set(doc.sections.filter((s) => s.included).map((s) => s.number));
  // قاعدة n (11ل): with weighting, the rationale becomes the weighting table's
  // last row (section 16) — the standalone section 15 table drops out.
  if (isMultiMethod(doc)) included.delete(15);

  dom.querySelectorAll("section[data-sec]").forEach((sec) => {
    const n = Number(sec.getAttribute("data-sec"));
    if (!Number.isFinite(n)) return;
    if (!included.has(n)) {
      sec.remove();
      return;
    }
    const body = buildSectionBody(n, doc);
    if (!body) return;
    const h2 = sec.querySelector("h2");
    sec.innerHTML = "";
    if (h2) sec.appendChild(h2.cloneNode(true));
    const wrap = dom.createElement("div");
    wrap.innerHTML = body;
    while (wrap.firstChild) sec.appendChild(wrap.firstChild);
  });

  applyLetterheadSlices(dom, doc.letterheadImageUrl, doc);
  applyStampSize(dom, doc.stampWidthCm, doc.stampHeightCm);

 // محرك الصف التلقائي : لا توزيع يدويًا —
  // القسم وحدة لا تنشطر بين صفحتين، وما لا يتسع ينزل لبداية الصفحة التالية،
  // وحذف الشرطيات يسحب ما بعدها، وصفحات المرفقات حاويات صفحة كاملة.
  reflowSheets(dom);

  const printBtn = dom.createElement("p");
  printBtn.className = "no-print";
  printBtn.setAttribute("style", "text-align:center;margin:16px;font-family:sans-serif");
  printBtn.innerHTML =
    '<button type="button" onclick="window.print()" style="padding:8px 16px;font-size:14px">طباعة / PDF</button>';
  dom.body.appendChild(printBtn);

  const style = dom.createElement("style");
  style.textContent = `@media print{.no-print{display:none!important} .sheet{page-break-after:always;margin:0}} .attach-ph{border:1px dashed #999;padding:16px;margin:8px 0;text-align:center;color:#444} .attach-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:8px 0} .attach-fig{margin:0;border:1px solid #ddd;padding:8px;text-align:center} .attach-fig img{max-width:100%;max-height:280px;object-fit:contain} .attach-fig figcaption{font-size:12px;margin-top:6px;color:#333} .attach-fn{color:#666;font-size:11px;direction:ltr;display:inline-block} .attach-link{margin:8px 0;font-size:13px}`;
  dom.head.appendChild(style);

  return `<!DOCTYPE html>\n${dom.documentElement.outerHTML}`;
}

export async function buildApprovedValuationReportHtml(
  doc: ValuationReportDocumentDto,
  extras?: ValuationReportMergeExtras,
  templateUrl = doc.approvedTemplateUrl || "/ejadah/report-template-approved.html",
): Promise<string> {
  const res = await fetch(templateUrl, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`تعذّر تحميل القالب المعتمد (${res.status})`);
  }
  const templateHtml = await res.text();
  return mergeApprovedValuationTemplate(templateHtml, doc, extras);
}

export async function openApprovedValuationReportPreview(
  doc: ValuationReportDocumentDto,
  extras?: ValuationReportMergeExtras,
  templateUrl = doc.approvedTemplateUrl || "/ejadah/report-template-approved.html",
): Promise<void> {
  const merged = await buildApprovedValuationReportHtml(doc, extras, templateUrl);
  // «noopener» ضمن الخصائص يجعل window.open يعيد null بحكم المواصفة — نحتاج المقبض
  // للكتابة، ونقطع صلة opener يدوياً بعده.
  const w = window.open("", "_blank", "width=980,height=1100");
  if (!w) throw new Error("المتصفح منع فتح نافذة استعراض تقرير التقييم");
  w.opener = null;
  w.document.open();
  w.document.write(merged);
  w.document.close();
}
