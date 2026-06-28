import {
  CASE_STUDY_REPORT_SUBTITLE,
  CASE_STUDY_REPORT_TITLE,
  CASE_STUDY_SECTION_REMARKS_HINT,
  CASE_STUDY_SIGNATURE_IMAGE,
  CASE_STUDY_STAMP_IMAGE,
} from "../../lib/prototype/case-study-form-data";
import { Fragment } from "react";
import type { CaseStudyQuestionSection } from "../../lib/prototype/case-study-form-data";
import type {
  CaseStudyReportModel,
  CaseStudyReportSection,
} from "../../lib/prototype/case-study-report-model";
import "./case-study-report.css";

type Props = {
  model: CaseStudyReportModel;
  id?: string;
  className?: string;
};

const SECTIONS_WITH_ALERT: ReadonlySet<CaseStudyQuestionSection> = new Set([
  "deed",
  "survey",
]);

const EXTRA_SUB_NOTE_DEFAULT =
  "في حال وجود اختلاف يتم التوضيح في الملاحظات ادناه / لا يوجد";

function Cb({ checked }: { checked: boolean }) {
  return (
    <span className={`csrd-cb${checked ? " csrd-cb--on" : ""}`} aria-hidden="true">
      {checked ? "☑" : "☐"}
    </span>
  );
}

function PageHeader() {
  return (
    <div className="csrd-header" aria-hidden="true">
      <div className="csrd-header-placeholder">
        <div className="csrd-header-logo">
          <div className="csrd-header-wordmark">
            EJADAH<span className="csrd-header-wordmark-dot">.</span>
          </div>
          <div className="csrd-header-sub">PROFESSIONAL</div>
        </div>
        <div className="csrd-header-divider" />
        <div className="csrd-header-service">
          <div className="csrd-header-service-en">
            VALUATION
            <br />
            SERVICES
          </div>
        </div>
      </div>
    </div>
  );
}

function PageFooter() {
  return (
    <div className="csrd-footer" aria-hidden="true">
      <div className="csrd-footer-placeholder">
        <div className="csrd-footer-col">
          <div>📍 Jeddah 23326 – Building No. 9360 add No. 4150</div>
          <div>📞 920011838</div>
          <div>✉ info@ejadah-sa.com</div>
        </div>
        <div className="csrd-footer-sep" />
        <div className="csrd-footer-col">
          <div>C.R. 4030297680</div>
          <div>VAT: 310163856300003</div>
          <div>CL: 11000007</div>
          <div className="csrd-footer-gold">Ejadah-sa.com</div>
        </div>
        <div className="csrd-footer-ar">
          شركة إجادة المهنية
          <br />
          Ejadah Professional Company
        </div>
      </div>
    </div>
  );
}

const WATERMARK_REPEAT_COUNT = 22;

function Watermark() {
  return (
    <div className="csrd-watermark" aria-hidden="true">
      <div className="csrd-watermark-repeat">
        {Array.from({ length: WATERMARK_REPEAT_COUNT }, (_, i) => (
          <span key={i} className="csrd-watermark-word">
            EJADAH
          </span>
        ))}
      </div>
    </div>
  );
}

function CommissionTable({ model }: { model: CaseStudyReportModel }) {
  return (
    <div className="csrd-section">
      <table className="csrd-table">
        <tbody>
          <tr className="csrd-sec-hdr">
            <td colSpan={2}>بيانات التعميد</td>
          </tr>
          <tr>
            <td className="csrd-data-lbl">اسم مزود الخدمة</td>
            <td>{model.providerName}</td>
          </tr>
          <tr>
            <td className="csrd-data-lbl">رقم الطلب</td>
            <td className="csrd-ltr">{model.requestNumber}</td>
          </tr>
          <tr>
            <td className="csrd-data-lbl">تاريخ الطلب</td>
            <td className="csrd-ltr">{model.requestDate}</td>
          </tr>
          <tr>
            <td className="csrd-data-lbl">رقم الصك</td>
            <td className="csrd-ltr">{model.deedNumber}</td>
          </tr>
          {model.propertyLocation ? (
            <tr>
              <td className="csrd-data-lbl">الموقع</td>
              <td>{model.propertyLocation}</td>
            </tr>
          ) : null}
          {model.propertyType ? (
            <tr>
              <td className="csrd-data-lbl">نوع العقار</td>
              <td>{model.propertyType}</td>
            </tr>
          ) : null}
          {model.assignmentSpecialist && model.assignmentSpecialist !== "—" ? (
            <tr>
              <td className="csrd-data-lbl">أخصائي الإسناد</td>
              <td>{model.assignmentSpecialist}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function NotesRow({
  label = CASE_STUDY_SECTION_REMARKS_HINT,
  notes,
}: {
  label?: string;
  notes?: string;
}) {
  return (
    <tr className="csrd-notes-row">
      <td colSpan={3}>
        <span className="csrd-notes-label">{label}</span>
        {notes?.trim() ? notes : "—"}
      </td>
    </tr>
  );
}

function ReportSection({ section }: { section: CaseStudyReportSection }) {
  const pageBreak = section.id === "comp";
  const notesLabel =
    section.id === "deed" || section.id === "survey"
      ? CASE_STUDY_SECTION_REMARKS_HINT
      : "الملاحظات";
  const occExtra = section.id === "occ" ? section.extras?.[0] : undefined;
  const compExtras =
    section.id === "comp" ? (section.extras ?? []) : [];

  return (
    <div className={`csrd-section${pageBreak ? " csrd-section--break" : ""}`}>
      {SECTIONS_WITH_ALERT.has(section.id) ? (
        <div className="csrd-alert">⚠ {CASE_STUDY_SECTION_REMARKS_HINT}</div>
      ) : null}
      <table className="csrd-table">
        <tbody>
          <tr className="csrd-sec-hdr">
            <td colSpan={3}>{section.title}</td>
          </tr>
          <tr className="csrd-col-hdr">
            <th>الأسئلة</th>
            <th className="csrd-yn">{section.colAHeader}</th>
            <th className="csrd-yn">{section.colBHeader}</th>
          </tr>
          {section.rows.map((row, i) => (
            <Fragment key={`${section.id}-${i}`}>
              <tr>
                <td>
                  {row.question}
                  {section.id === "occ" &&
                  i === section.rows.length - 1 &&
                  occExtra ? (
                    <span className="csrd-muted"> — {occExtra}</span>
                  ) : null}
                </td>
                <td className="csrd-yn">
                  <Cb checked={row.markA} />
                </td>
                <td className="csrd-yn">
                  <Cb checked={row.markB} />
                </td>
              </tr>
              {section.id === "extra" ? (
                <tr className="csrd-sub-row">
                  <td colSpan={3}>{EXTRA_SUB_NOTE_DEFAULT}</td>
                </tr>
              ) : null}
            </Fragment>
          ))}
          {compExtras.map((line) => (
            <tr key={line}>
              <td colSpan={3}>{line}</td>
            </tr>
          ))}
          {section.id !== "extra" ? (
            <NotesRow label={notesLabel} notes={section.remarks} />
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ApprovalBlock({ model }: { model: CaseStudyReportModel }) {
  const { approval } = model;
  return (
    <div className="csrd-approval-block">
      <div className="csrd-approval-decl">{approval.declarationText}</div>
      <table className="csrd-table csrd-approval-table">
        <thead>
          <tr>
            <th style={{ width: "22%" }}>رقم الصك:</th>
            <th style={{ width: "22%" }}>معتمد التقرير</th>
            <th style={{ width: "16%" }}>التاريخ</th>
            <th style={{ width: "20%" }}>التوقيع</th>
            <th style={{ width: "20%" }}>ختم الشركة</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="csrd-ltr csrd-bold">{approval.deedNumber}</td>
            <td>{approval.approverName}</td>
            <td className="csrd-ltr">{approval.reportDate}</td>
            <td>
              <img src={CASE_STUDY_SIGNATURE_IMAGE} alt="توقيع معتمد التقرير" />
            </td>
            <td>
              <img src={CASE_STUDY_STAMP_IMAGE} alt="ختم الشركة" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function CaseStudyReportDocument({ model, id, className }: Props) {
  return (
    <div
      id={id}
      className={`csrd-root${className ? ` ${className}` : ""}`}
      lang="ar"
      dir="rtl"
    >
      <PageHeader />
      <PageFooter />
      <Watermark />
      <div className="csrd-content">
        <div className="csrd-title-block">
          <div className="csrd-title-main">{CASE_STUDY_REPORT_TITLE}</div>
          <div className="csrd-title-sub">{CASE_STUDY_REPORT_SUBTITLE}</div>
        </div>
        <CommissionTable model={model} />
        {model.sections.map((section) => (
          <ReportSection key={section.id} section={section} />
        ))}
        <ApprovalBlock model={model} />
      </div>
    </div>
  );
}
