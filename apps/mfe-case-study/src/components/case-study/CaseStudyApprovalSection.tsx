import { CASE_STUDY_SIGNATURE_IMAGE, CASE_STUDY_STAMP_IMAGE } from "../../lib/prototype/case-study-form-data";
import type { CaseStudyReportApproval } from "../../lib/prototype/case-study-report-model";
import "./case-study-report.css";

type Props = {
  approval: CaseStudyReportApproval;
  variant?: "form" | "report";
};

export function CaseStudyApprovalSection({
  approval,
  variant = "form",
}: Props) {
  const rootClass =
    variant === "report" ? "cs-report-approval" : "cs-form-approval";

  return (
    <div className={rootClass}>
      <p className="note note-info cs-form-approval-note">
        {approval.declarationText}
      </p>
      <div className="cs-form-sig-table-wrap">
        <table className="cs-form-sig-table">
          <thead>
            <tr>
              <th>رقم الصك</th>
              <th>معتمد التقرير</th>
              <th>التاريخ</th>
              <th>التوقيع</th>
              <th>ختم الشركة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="cs-form-sig-value">{approval.deedNumber}</span>
              </td>
              <td>
                <span className="cs-form-sig-value">{approval.approverName}</span>
              </td>
              <td>
                <span className="cs-form-sig-value">{approval.reportDate}</span>
              </td>
              <td>
                <img
                  className="cs-form-sig-img cs-form-sig-img--signature"
                  src={CASE_STUDY_SIGNATURE_IMAGE}
                  alt="توقيع معتمد التقرير"
                />
              </td>
              <td>
                <img
                  className="cs-form-sig-img cs-form-sig-img--stamp"
                  src={CASE_STUDY_STAMP_IMAGE}
                  alt="ختم الشركة"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
