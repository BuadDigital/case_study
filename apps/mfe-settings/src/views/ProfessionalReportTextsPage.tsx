"use client";

/**
 * Second printed page of the professional valuation report settings: research
 * scope, special assumptions, terms/restrictions, attachments and glossary.
 */

import Link from "next/link";
import type {
  OrganizationValuationReportSettings,
  ValuationListItemDto,
  ValuationListsDto,
} from "@platform/api-client";
import { Auto, K, Sec } from "./professional-valuation-report-tables";
import { BulletEdit } from "./professional-valuation-report-fields";

export function ProfessionalReportTextsPage({
  draft,
  patch,
  canEdit,
  isOpen,
  toggle,
  lists,
  glossary,
  ivs,
  listsHref,
}: {
  draft: OrganizationValuationReportSettings;
  patch: (next: Partial<OrganizationValuationReportSettings>) => void;
  canEdit: boolean;
  isOpen: (n: string) => boolean;
  toggle: (n: string) => void;
  lists: ValuationListsDto | null;
  glossary: ValuationListItemDto[];
  ivs: ValuationListItemDto[];
  listsHref: string;
}) {
  return (
    <>
      <section className="rpt-page">
      <Sec
        n="28"
        title="نطاق البحث وطبيعة ومصدر المعلومات"
        open={isOpen("28")}
        onToggle={() => toggle("28")}
      >
        <p className="sysnote">نص ثابت — يُطبع في التقرير كما هو.</p>
        <p>تـم الاعتمـاد على مصـادر المعلومـات التاليـة في إصـدار الرأي حـول قيمـة العقـار:</p>
        <BulletEdit
          text={draft.researchScopeText}
          canEdit={canEdit}
          onChange={(researchScopeText) => patch({ researchScopeText })}
        />
      </Sec>
      <Sec n="29" title="الافتراضات الخاصة" open={isOpen("29")} onToggle={() => toggle("29")}>
        <p className="sysnote">
          تظهر العبارات كلها عند إعداد التقرير وعلى كل عبارة مربع اختيار — يزيل المستخدم العبارة
          التي لا تصح على العقار، ويُطبع المُبقى فقط.
        </p>
        <ul>
          {draft.specialAssumptionLibrary.map((item, index) => (
            <li key={index}>
              {canEdit ? (
                <textarea
                  className="li-edit"
                  rows={Math.max(2, Math.ceil(item.length / 90))}
                  value={item}
                  onChange={(e) =>
                    patch({
                      specialAssumptionLibrary: draft.specialAssumptionLibrary.map((x, i) =>
                        i === index ? e.target.value : x,
                      ),
                    })
                  }
                />
              ) : (
                item
              )}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <button
            type="button"
            className="add-line"
            onClick={() =>
              patch({
                specialAssumptionLibrary: [...draft.specialAssumptionLibrary, ""],
              })
            }
          >
            + إضافة افتراض
          </button>
        ) : null}
      </Sec>
    </section>

    <section className="rpt-page">
      <Sec
        n="30"
        title="العوامل البيئية والاجتماعية والحوكمة (ESG)"
        open={isOpen("30")}
        onToggle={() => toggle("30")}
      >
        <p className="sysnote">
          بند اختياري — يعبّئها الأخصائي من مستندات العقار (المجموعات الثلاث)، وتظهر للمقيّم
          للعرض فقط وتُطبع في التقرير.
        </p>
        <table>
          <thead>
            <tr>
              <th style={{ width: "16%" }}>المجموعة</th>
              <th style={{ width: "26%" }}>العوامل المتاحة للاختيار</th>
              <th>وصف الأثر</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="k" style={{ whiteSpace: "normal", verticalAlign: "middle" }}>
                التأثيرات البيئية
              </td>
              <td className="v">
                كفاءة الطاقة · أخطار الموقع والمناخ · المباني الخضراء
                <div className="esg-or">أو «لا يوجد»</div>
              </td>
              <Auto>إدخال — يكتبه الأخصائي عند وجود تأثير</Auto>
            </tr>
            <tr>
              <td className="k" style={{ whiteSpace: "normal", verticalAlign: "middle" }}>
                التأثيرات الاجتماعية
              </td>
              <td className="v">
                جودة التصاميم ورفاهية المسكن · الإسهام المجتمعي للعقار · الخدمات المتوفرة في
                الموقع
                <div className="esg-or">أو «لا يوجد»</div>
              </td>
              <Auto>إدخال — يكتبه الأخصائي عند وجود تأثير</Auto>
            </tr>
            <tr>
              <td className="k" style={{ whiteSpace: "normal", verticalAlign: "middle" }}>
                تأثيرات الحوكمة
              </td>
              <td className="v">
                الامتثال التنظيمي · الإدارة الفعالة لبيانات العقار · مقومات تشغيل العقار
                <div className="esg-or">أو «لا يوجد»</div>
              </td>
              <Auto>إدخال — يكتبه الأخصائي عند وجود تأثير</Auto>
            </tr>
          </tbody>
        </table>
      </Sec>
    </section>

    <section className="rpt-page">
      <Sec
        n="31"
        title="الشروط والأحكام وإخلاء المسؤولية"
        open={isOpen("31")}
        onToggle={() => toggle("31")}
      >
        <p className="sysnote">
          نص ثابت — يُطبع كما هو، وبعض البنود تحمل شرط ظهور موضّحاً داخلها (مثل بند المباني
          والعقارات القائمة).
        </p>
        <BulletEdit
          text={draft.terms}
          canEdit={canEdit}
          onChange={(terms) => patch({ terms })}
        />
      </Sec>
    </section>

    <section className="rpt-page">
      <Sec
        n="32"
        title="القيود على الاستخدام والنشر"
        open={isOpen("32")}
        onToggle={() => toggle("32")}
      >
        <p className="sysnote">
          نص ثابت — يُطبع كما هو، وبعض البنود تحمل متغيرات أو شروط ظهور موضّحة داخلها.
        </p>
        <BulletEdit
          text={draft.restrictions}
          canEdit={canEdit}
          onChange={(restrictions) => patch({ restrictions })}
        />
      </Sec>
    </section>

    <section className="rpt-page">
      <Sec
        n="33"
        title="خريطة الأقمار الصناعية"
        open={isOpen("33")}
        onToggle={() => toggle("33")}
      >
        <p className="sysnote">
          خريطة ديناميكية — لا صورة تُرفع: تُولَّد آليًا عبر API محرك الخرائط من إحداثيات
          العقار وحدود القطعة، وتُطبع في التقرير كلقطة وقت الإصدار.
        </p>
        <h3 className="rpt-h3">خريطة الموقع العام</h3>
        <table>
          <tbody>
            <tr>
              <K>الموقع</K>
              <Auto>المدينة والحي — من النظام</Auto>
              <K>إحداثيات الموقع</K>
              <Auto>من النظام (المعاينة)</Auto>
            </tr>
          </tbody>
        </table>
        <p className="sysnote">
          خريطة ديناميكية — تُولَّد آليًا من محرك الخرائط بمستوى تقريب أقرب للموقع.
        </p>
      </Sec>
    </section>

    <section className="rpt-page">
      <Sec n="34" title="صور العقار" open={isOpen("34")} onToggle={() => toggle("34")}>
        <p className="sysnote">
          من النظام — الصور يلتقطها المعاين ويرفعها في المعاينة، وتُدرج تلقائيًا هنا بترتيبها
          ووسومها وتاريخ الالتقاط. عدد الصفحات من تبويب «صفحات الصور» في{" "}
          <Link href={listsHref} className="rpt-link">
            قوائم التقييم
          </Link>{" "}
          (6 صور بالصفحة) — أرض <bdi>{lists?.photoPagesLand ?? 1}</bdi> · مبانٍ{" "}
          <bdi>{lists?.photoPagesBuilt ?? 2}</bdi>.
        </p>
      </Sec>
    </section>

    <section className="rpt-page">
      <Sec n="35" title="التقرير المساحي" open={isOpen("35")} onToggle={() => toggle("35")}>
        <p className="sysnote">
          من المرفقات — مستند يرفعه المستخدمون على النظام، ويختاره الأخصائي بعلامة «للتقرير»
          من مستندات العقار ليظهر في التقرير. قائمة المرفقات وإلزاميتها من تبويب «مرفقات التقرير» في
          قوائم التقييم. <strong>شرط الظهور:</strong> يُطبع فقط إذا اختير.
        </p>
      </Sec>
    </section>

    <section className="rpt-page">
      <Sec n="36" title="صك الملكية" open={isOpen("36")} onToggle={() => toggle("36")}>
        <p className="sysnote">
          من المرفقات — مستند يرفعه المستخدمون على النظام، ويختاره الأخصائي بعلامة «للتقرير»
          من مستندات العقار ليظهر في التقرير. قائمة المرفقات وإلزاميتها من تبويب «مرفقات التقرير» في قوائم
          التقييم.
        </p>
      </Sec>
    </section>

    <section className="rpt-page">
      <Sec
        n="37"
        title="معايير التقييم الدولية العامة"
        open={isOpen("37")}
        onToggle={() => toggle("37")}
      >
        <p className="sysnote">
          تُطبع من قائمة «معايير التقييم الدولية» في{" "}
          <Link href={listsHref} className="rpt-link">
            قوائم التقييم
          </Link>{" "}
          — المفعَّل يظهر، والأوصاف تُحرَّر هناك.
        </p>
        <table className="def">
          <tbody>
            {ivs.map((row) => (
              <tr key={row.id}>
                <td className="k" style={{ width: "22%", whiteSpace: "normal" }}>
                  {row.name}
                </td>
                <td>{row.cells[0] ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sec>
    </section>

    <section className="rpt-page">
      <Sec n="38" title="مصطلحات مهنية" open={isOpen("38")} onToggle={() => toggle("38")}>
        <p className="sysnote">
          تُطبع كما هي — بياناتها من قائمة «المصطلحات المهنية» في قوائم التقييم، والمفعَّل
          منها يظهر.
        </p>
        <table className="tight">
          <tbody>
            {glossary.map((row) => (
              <tr key={row.id}>
                <td className="k" style={{ width: "20%", whiteSpace: "normal" }}>
                  {row.name}
                </td>
                <td>{row.cells[0] ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sec>
    </section>
    </>
  );
}
