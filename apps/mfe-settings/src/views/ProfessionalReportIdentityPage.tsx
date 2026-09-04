"use client";

/**
 * First printed page of the professional valuation report settings: valuer
 * identity, scope of work, key inputs, finishing specs and the stamp block.
 */

import Link from "next/link";
import {
  applyIvsDateToStandards,
  VALUATION_REPORT_HTML_DEFAULTS as D,
  type OrganizationEvaluatorSettings,
  type OrganizationSettingsDto,
  type OrganizationValuationReportSettings,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import {
  Auto,
  K,
  Sec,
  ReportSourceTables,
  ReportDynamicTables,
} from "./professional-valuation-report-tables";
import {
  BulletEdit,
  FinishCell,
  ParaEdit,
  ParticipantsTable,
} from "./professional-valuation-report-fields";
import {
  filled,
  memLabel,
  slashDate,
} from "./professional-valuation-report-state";

export function ProfessionalReportIdentityPage({
  draft,
  patch,
  canEdit,
  isOpen,
  toggle,
  org,
  ev,
  htmlEv,
  certName,
  stamp,
  parts,
  ivsDate,
  listsHref,
  valuersHref,
  orgHref,
  brandHref,
}: {
  draft: OrganizationValuationReportSettings;
  patch: (next: Partial<OrganizationValuationReportSettings>) => void;
  canEdit: boolean;
  isOpen: (n: string) => boolean;
  toggle: (n: string) => void;
  org: OrganizationSettingsDto | null;
  ev: NonNullable<OrganizationSettingsDto["evaluator"]> | Record<string, never>;
  htmlEv: OrganizationEvaluatorSettings;
  certName: string;
  stamp: string;
  parts: OrganizationValuerRosterEntry[];
  ivsDate: string;
  listsHref: string;
  valuersHref: string;
  orgHref: string;
  brandHref: string;
}) {
  return (
    <>
      <section className="rpt-page">
      <div className="rpt-title">تقرير تقييم عقار</div>

      <Sec n="01" title="هوية المقيم المعتمد" open={isOpen("01")} onToggle={() => toggle("01")}>
        <table>
          <tbody>
            <tr>
              <K>اسم المقيم المعتمد</K>
              <Auto>
                يُعبَّأ من{" "}
                <Link href={valuersHref} className="rpt-link">
                  «المقيّمون»
                </Link>
                {" — "}
                {certName}
              </Auto>
              <K>رقم ترخيص مزاولة المهنة</K>
              <Auto>
                <bdi>{filled(ev.licenseNumber, htmlEv.licenseNumber ?? "")}</bdi>
              </Auto>
            </tr>
            <tr>
              <K>تاريخ الإصدار</K>
              <Auto>
                <bdi>{filled(ev.licenseIssuedAt, htmlEv.licenseIssuedAt ?? "")}</bdi>
              </Auto>
              <K>تاريخ الانتهاء</K>
              <Auto>
                <bdi>
                  {filled(ev.licenseExpiresHijri, htmlEv.licenseExpiresHijri ?? "")}
                </bdi>
              </Auto>
            </tr>
            <tr>
              <K>فرع التقييم</K>
              <td className="v" colSpan={3}>
                <input
                  className="cell-input"
                  disabled={!canEdit}
                  value={draft.valuationBranch}
                  onChange={(e) => patch({ valuationBranch: e.target.value })}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </Sec>

      <Sec n="02" title="نطاق العمل" open={isOpen("02")} onToggle={() => toggle("02")}>
        <table>
          <tbody>
            <tr>
              <K>اسم العميل</K>
              <Auto>يُعبَّأ تلقائيًا من المعاملة — اسم العميل</Auto>
              <K>تاريخ التقييم</K>
              <Auto>يُعبَّأ تلقائيًا عند اعتماد قيمة العقار في النظام</Auto>
            </tr>
            <tr>
              <K>مستخدمو التقرير</K>
              <Auto>يُعبَّأ تلقائيًا من المعاملة — من حقل «مستخدمو التقرير» في النظام</Auto>
              <K>تاريخ المعاينة</K>
              <Auto>يُعبَّأ تلقائيًا عند إكمال المعاين دوره في النظام</Auto>
            </tr>
            <tr>
              <K>اسم المالك</K>
              <Auto>
                ملكية مطلقة: مالك واحد بنسبة 100% (من حقل «اسم المالك» في النظام) · مشاع:
                للمستخدم الخيار — كتابة اسم مالك واحد أو أي نص، أو إضافة الملاك مع نسب الملكية
              </Auto>
              <K>رقم الطلب</K>
              <Auto>يُعبَّأ تلقائيًا من المعاملة — من حقل «رقم الطلب» في النظام</Auto>
            </tr>
            <tr>
              <K>الغرض من التقييم</K>
              <Auto>
                يُختار في المعاملة من{" "}
                <Link href={listsHref} className="rpt-link">
                  قوائم التقييم
                </Link>
                {" — قائمة «أغراض التقييم»"}
              </Auto>
              <K>تاريخ الطلب</K>
              <Auto>يُعبَّأ تلقائيًا من المعاملة — من حقل «تاريخ الطلب» في النظام</Auto>
            </tr>
            <tr>
              <K>أساس القيمة</K>
              <Auto>يُختار في المعاملة من قائمة «أساس القيمة» المرجعية</Auto>
              <K>فرضية القيمة (الاستخدام المفترض)</K>
              <Auto>يُختار في المعاملة من قائمة «فرضية القيمة» المرجعية</Auto>
            </tr>
            <tr>
              <K>نوع التقرير</K>
              <td className="v">
                <input
                  className="cell-input"
                  disabled={!canEdit}
                  value={draft.reportType}
                  onChange={(e) => patch({ reportType: e.target.value })}
                />
              </td>
              <K>عملة التقييم</K>
              <td className="v">
                <input
                  className="cell-input"
                  disabled={!canEdit}
                  value={draft.currency}
                  onChange={(e) => patch({ currency: e.target.value })}
                />
              </td>
            </tr>
            <tr>
              <K>نوع العقار</K>
              <Auto>يُعبَّأ تلقائيًا من المعاملة — من حقل «نوع العقار» في النظام</Auto>
              <K>أساليب التقييم المستخدمة</K>
              <Auto>يُعبَّأ عند اختيار المقيم أسلوب التقييم المناسب للعقار في المعاملة</Auto>
            </tr>
          </tbody>
        </table>
        <div className="scope-box">
          <p style={{ margin: "0 0 8px" }}>
            يعتمد أساس التقييم على تحديد{" "}
            <span className="auto">[أساس القيمة — يُؤخذ من الأساس المختار في المعاملة]</span>{" "}
            لموضوع التقييم في حالته الراهنة، وعلى أساس أن العقار خالٍ من جميع الأعباء والشروط
            المقيدة والموافقات والإشعارات القانونية، وعليه فإن المفهوم المتبع في هذا التقرير عن{" "}
            <span className="auto">[أساس القيمة]</span> هو المفهوم الذي تم تقديمه في المعيار 102
            من معايير التقييم الدولية (2025).
          </p>
          <ul style={{ margin: 0 }}>
            <li className="auto">
              تعريف أساس القيمة — يتبدل تلقائيًا حسب الأساس المختار في المعاملة، من قائمة «أساس
              القيمة» في «قوائم التقييم».
            </li>
            <li>
              أُعد هذا التقرير لاستخدام العميل (
              <span className="auto">
                مستخدمو التقرير — يُؤخذ من حقل «مستخدمو التقرير» في النظام
              </span>
              ) فقط، ولا يوجد مستخدمون آخرون للتقرير، ولا يجوز استخدامه من قبل مستخدم آخر إلا
              بإذن خطي موقع ومختوم بختم الشركة.
            </li>
          </ul>
        </div>
      </Sec>

      <Sec n="03" title="المدخلات الرئيسية" open={isOpen("03")} onToggle={() => toggle("03")}>
        <p className="sysnote">نص ثابت — يُطبع كما هو.</p>
        <BulletEdit
          text={draft.keyInputsText}
          canEdit={canEdit}
          onChange={(keyInputsText) => patch({ keyInputsText })}
        />
      </Sec>

      <Sec
        n="04"
        title="التأكيد على الالتزام بمعايير التقييم الدولية"
        open={isOpen("04")}
        onToggle={() => toggle("04")}
      >
        <p className="sysnote">
          نص ثابت — المتغير الوحيد تاريخ سريان المعايير، من{" "}
          <Link href={listsHref} className="rpt-link">
            قوائم التقييم
          </Link>
          .
        </p>
        {canEdit ? (
          <ParaEdit
            text={draft.professionalStandards}
            canEdit
            onChange={(professionalStandards) => patch({ professionalStandards })}
          />
        ) : (
          <p>
            {applyIvsDateToStandards(draft.professionalStandards, ivsDate)
              .split(ivsDate)
              .map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 ? (
                    <span className="gold-date" title="من قوائم التقييم">
                      {ivsDate}
                    </span>
                  ) : null}
                </span>
              ))}
          </p>
        )}
      </Sec>

      <Sec
        n="05"
        title="إقرار بالاستقلالية وعدم تضارب المصالح"
        open={isOpen("05")}
        onToggle={() => toggle("05")}
      >
        <p className="sysnote">
          نص ثابت — يُطبع كما هو، واسم الشركة من{" "}
          <Link href={orgHref} className="rpt-link">
            بيانات المنشأة
          </Link>
          .
        </p>
        <ParaEdit
          text={draft.independence}
          canEdit={canEdit}
          onChange={(independence) => patch({ independence })}
        />
      </Sec>
    </section>

    <ReportSourceTables
      isOpen={isOpen}
      toggle={toggle}
      finishing={
        <Sec
          n="12"
          title="مستوى تشطيبات البناء"
          open={isOpen("12")}
          onToggle={() => toggle("12")}
        >
          <p className="sysnote">
            إدخال (اختيار) — يختار المستخدم المستوى: فاخر / متوسط / عادي / بدون تشطيب. عند
            اختيار أي مستوى يُطبع في التقرير تفصيله المذكور أسفله، إلا «بدون تشطيب» فيُطبع دون
            تفصيل.
          </p>
          <table className="mx">
            <thead>
              <tr>
                <th style={{ width: "33.3%" }}>تشطيب فاخر</th>
                <th style={{ width: "33.3%" }}>تشطيب متوسط</th>
                <th>تشطيب عادي</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <FinishCell
                  text={draft.finishingLuxury}
                  canEdit={canEdit}
                  onChange={(finishingLuxury) => patch({ finishingLuxury })}
                />
                <FinishCell
                  text={draft.finishingMedium}
                  canEdit={canEdit}
                  onChange={(finishingMedium) => patch({ finishingMedium })}
                />
                <FinishCell
                  text={draft.finishingOrdinary}
                  canEdit={canEdit}
                  onChange={(finishingOrdinary) => patch({ finishingOrdinary })}
                />
              </tr>
              <tr>
                <th colSpan={3}>بدون تشطيب</th>
              </tr>
            </tbody>
          </table>
        </Sec>
      }
    />

    <ReportDynamicTables isOpen={isOpen} toggle={toggle} />

    <section className="rpt-page">
      <Sec
        n="26"
        title="المشاركون في إعداد التقرير"
        open={isOpen("26")}
        onToggle={() => toggle("26")}
      >
        <p className="sysnote">
          بند ثابت في التقرير — بياناته من سجل{" "}
          <Link href={valuersHref} className="rpt-link">
            «المقيّمون»
          </Link>
          .
        </p>
        <ParticipantsTable rows={parts} branch={draft.valuationBranch} />
        <h2 className="rpt-h static">
          <span className="n">27</span>إعتماد تقرير التقييم
        </h2>
        <p className="sysnote">
          بند ثابت — مصدره المقيّمون و{" "}
          <Link href={brandHref} className="rpt-link">
            الهوية البصرية
          </Link>{" "}
          (ختم المنشأة).
        </p>
        <table className="ctr">
          <tbody>
            <tr>
              <K>الاسم</K>
              <td className="v" style={{ width: "35%" }}>
                {certName}
              </td>
              <K>رقم العضوية</K>
              <td className="v num">
                {filled(ev.membershipNumber, htmlEv.membershipNumber ?? "")}
              </td>
            </tr>
            <tr>
              <K>فرع التقييم</K>
              <td className="v">{filled(draft.valuationBranch, D.valuationBranch)}</td>
              <K>فئة العضوية</K>
              <td className="v">
                {memLabel(
                  filled(ev.membershipCategory, String(htmlEv.membershipCategory ?? "")),
                )}
              </td>
            </tr>
            <tr>
              <K>صفته</K>
              <td className="v">{filled(ev.title, htmlEv.title ?? "")}</td>
              <K>تاريخ انتهاء العضوية</K>
              <td className="v num">
                {slashDate(
                  filled(ev.membershipExpiresAt, htmlEv.membershipExpiresAt ?? ""),
                )}
              </td>
            </tr>
            <tr>
              <K>التوقيع</K>
              <td className="v" style={{ height: 64 }}>
                {org?.branding.signatureUrl ? (
                  <img
                    src={org.branding.signatureUrl}
                    alt=""
                    style={{ height: 48, objectFit: "contain" }}
                  />
                ) : (
                  <span className="auto">يُرفع من «المقيّمون»</span>
                )}
              </td>
              <K>ختم المنشأة</K>
              <td className="v" style={{ textAlign: "center" }}>
                <img src={stamp} alt="ختم المنشأة" style={{ height: 60 }} />
              </td>
            </tr>
          </tbody>
        </table>
      </Sec>
    </section>
    </>
  );
}
