import { CaseStudyApprovalSection } from "./CaseStudyApprovalSection";
import {
  CASE_STUDY_REPORT_SUBTITLE,
  CASE_STUDY_REPORT_TITLE,
  CASE_STUDY_SECTION_REMARKS_HINT,
} from "../../lib/prototype/case-study-form-data";
import type { CaseStudyQuestionSection } from "../../lib/prototype/case-study-form-data";
import type { CaseStudyReportModel } from "../../lib/prototype/case-study-report-model";
import "./case-study-report.css";

type Props = {
  model: CaseStudyReportModel;
  id?: string;
  className?: string;
};

const SECTIONS_WITH_REMARKS_HINT: ReadonlySet<CaseStudyQuestionSection> =
  new Set(["deed", "survey"]);

function ReportMark({ checked }: { checked: boolean }) {
  return (
    <span
      className={`cs-report-mark${checked ? " checked" : ""}`}
      aria-hidden="true"
    >
      {checked ? "✓" : ""}
    </span>
  );
}

export function CaseStudyReportDocument({ model, id, className }: Props) {
  return (
    <div className={`cs-report-page${className ? ` ${className}` : ""}`}>
      <article id={id} className="cs-report-doc" dir="rtl" lang="ar">
        <div className="cs-report-form-title">
          <h1>{CASE_STUDY_REPORT_TITLE}</h1>
          <p>{CASE_STUDY_REPORT_SUBTITLE}</p>
        </div>

        <table className="cs-report-meta-table">
          <tbody>
            <tr>
              <th>اسم مزود الخدمة</th>
              <td>{model.providerName}</td>
              <th>رقم الطلب</th>
              <td>{model.requestNumber}</td>
            </tr>
            <tr>
              <th>تاريخ الطلب</th>
              <td>{model.requestDate}</td>
              <th>رقم الصك</th>
              <td>{model.deedNumber}</td>
            </tr>
            {model.propertyLocation || model.propertyType ? (
              <tr>
                {model.propertyLocation ? (
                  <>
                    <th>الموقع</th>
                    <td>{model.propertyLocation}</td>
                  </>
                ) : (
                  <>
                    <th />
                    <td />
                  </>
                )}
                {model.propertyType ? (
                  <>
                    <th>نوع العقار</th>
                    <td>{model.propertyType}</td>
                  </>
                ) : (
                  <>
                    <th />
                    <td />
                  </>
                )}
              </tr>
            ) : null}
            {model.assignmentSpecialist && model.assignmentSpecialist !== "—" ? (
              <tr>
                <th>أخصائي الإسناد</th>
                <td colSpan={3}>{model.assignmentSpecialist}</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {model.sections.map((section) => (
          <section key={section.id} className="cs-report-section">
            <h2 className="cs-report-section-title">{section.title}</h2>
            <table className="cs-report-table">
              <thead>
                <tr>
                  <th>الأسئلة</th>
                  <th className="center col-a">{section.colAHeader}</th>
                  <th className="center col-b">{section.colBHeader}</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, i) => (
                  <tr key={`${section.id}-${i}`}>
                    <td className="question">{row.question}</td>
                    <td className="center">
                      <ReportMark checked={row.markA} />
                    </td>
                    <td className="center">
                      <ReportMark checked={row.markB} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {SECTIONS_WITH_REMARKS_HINT.has(section.id) ? (
              <p className="cs-report-remarks-hint">
                {CASE_STUDY_SECTION_REMARKS_HINT}
              </p>
            ) : null}
            {section.extras?.map((line) => (
              <p key={line} className="cs-report-extra-line">
                {line}
              </p>
            ))}
            {section.remarks ? (
              <div className="cs-report-remarks">
                <span className="cs-report-remarks-label">ملاحظات:</span>
                <p>{section.remarks}</p>
              </div>
            ) : null}
          </section>
        ))}

        <section className="cs-report-section cs-report-section--approval">
          <h2 className="cs-report-section-title cs-report-section-title--approval">
            الاعتماد والتوقيع
          </h2>
          <CaseStudyApprovalSection approval={model.approval} variant="report" />
        </section>
      </article>
    </div>
  );
}
