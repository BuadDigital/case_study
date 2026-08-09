import { Note, Table, TBody, Td, Th, THead, Tr } from "@platform/design-system";
import {
  caseStudySignatureImage,
  caseStudyStampImage,
} from "../../lib/prototype/case-study-form-data";
import type { CaseStudyReportApproval } from "../../lib/prototype/case-study-report-model";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../../lib/prototype/po-intake-data";
import "./case-study-report.css";

type Props = {
  approval: CaseStudyReportApproval;
  variant?: "form" | "report";
};

export function CaseStudyApprovalSection({
  approval,
  variant = "form",
}: Props) {
  if (variant === "report") {
    return (
      <div className="cs-report-approval">
        <p className="note note-info cs-form-approval-note">
          {approval.declarationText}
        </p>
        <div className="cs-form-sig-table-wrap">
          <table className="cs-form-sig-table">
            <thead>
              <tr>
                <th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</th>
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
                    src={caseStudySignatureImage()}
                    alt="توقيع معتمد التقرير"
                  />
                </td>
                <td>
                  <img
                    className="cs-form-sig-img cs-form-sig-img--stamp"
                    src={caseStudyStampImage()}
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

  return (
    <div className="space-y-3">
      <Note tone="info">{approval.declarationText}</Note>
      <div className="overflow-hidden rounded-[10px] border border-border">
        <Table className="min-w-[520px]" wrapClassName="rounded-none border-0">
          <THead>
            <Tr hoverable={false}>
              <Th className="text-center">{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
              <Th className="text-center">معتمد التقرير</Th>
              <Th className="text-center">التاريخ</Th>
              <Th className="text-center">التوقيع</Th>
              <Th className="text-center">ختم الشركة</Th>
            </Tr>
          </THead>
          <TBody>
            <Tr hoverable={false}>
              <Td className="text-center font-semibold">{approval.deedNumber}</Td>
              <Td className="text-center font-semibold">{approval.approverName}</Td>
              <Td className="text-center font-semibold">{approval.reportDate}</Td>
              <Td className="text-center">
                <img
                  className="mx-auto block max-h-14 max-w-[120px] object-contain"
                  src={caseStudySignatureImage()}
                  alt="توقيع معتمد التقرير"
                />
              </Td>
              <Td className="text-center">
                <img
                  className="mx-auto block max-h-24 max-w-24 object-contain"
                  src={caseStudyStampImage()}
                  alt="ختم الشركة"
                />
              </Td>
            </Tr>
          </TBody>
        </Table>
      </div>
    </div>
  );
}
