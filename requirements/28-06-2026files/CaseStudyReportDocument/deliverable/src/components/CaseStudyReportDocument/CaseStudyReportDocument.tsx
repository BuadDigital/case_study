/**
 * CaseStudyReportDocument.tsx
 * ─────────────────────────────────────────────────────────────
 * A4 RTL print-ready report for Ejadah Professional Valuation.
 *
 * Usage:
 *   import CaseStudyReportDocument from './CaseStudyReportDocument';
 *
 *   <CaseStudyReportDocument
 *     meta={{ orderNumber: '032785', orderDate: '2026/05/13', deedNumber: '315703003914' }}
 *     section1={{ answers: [...], notes: '...' }}
 *     section2={{ answers: [...], notes: '...' }}
 *     section3={{ answers: [...], meterType: 'electronic', notes: '...' }}
 *     section4={{ answers: [...], ownershipFee: undefined }}
 *     section5={{ answers: [...] }}
 *     approval={{ approverName: 'عماد رشيد الرشيد', approvalDate: '2026/05/13' }}
 *   />
 *
 * Assets (place in src/assets/):
 *   ejadah-header.png   — letterhead header image (full width, 38 mm tall)
 *   ejadah-footer.png   — letterhead footer image (full width, 24 mm tall)
 *   ejadah-watermark.png — right-edge watermark (optional)
 *   ejadah-stamp.png    — company round stamp (transparent PNG)
 *   ejadah-signature.png — approver signature (transparent PNG)
 *
 * When an asset is not present, a CSS placeholder is rendered instead.
 * ─────────────────────────────────────────────────────────────
 */

import React from 'react';
import './CaseStudyReportDocument.css';

// ── Asset imports (replace paths if your bundler differs) ──────
// If an image file is missing, set the import to `undefined` and
// the component renders a CSS placeholder automatically.
let headerImg: string | undefined;
let footerImg: string | undefined;
let watermarkImg: string | undefined;
let stampImg: string | undefined;
let signatureImg: string | undefined;

try { headerImg    = (await import('../../assets/ejadah-header.png'   )).default; } catch { /* placeholder */ }
try { footerImg    = (await import('../../assets/ejadah-footer.png'   )).default; } catch { /* placeholder */ }
try { watermarkImg = (await import('../../assets/ejadah-watermark.png')).default; } catch { /* placeholder */ }
try { stampImg     = (await import('../../assets/ejadah-stamp.png'    )).default; } catch { /* placeholder */ }
try { signatureImg = (await import('../../assets/ejadah-signature.png')).default; } catch { /* placeholder */ }

// ── If top-level await isn't supported in your setup, use static imports:
// import headerImg    from '../../assets/ejadah-header.png';
// import footerImg    from '../../assets/ejadah-footer.png';
// import watermarkImg from '../../assets/ejadah-watermark.png';
// import stampImg     from '../../assets/ejadah-stamp.png';
// import signatureImg from '../../assets/ejadah-signature.png';

/* ============================================================
   TYPES
   ============================================================ */

/** A tri-state checkbox answer */
export type Answer = true | false | null;

/** null = N/A (renders as "—"), true = checked left col, false = checked right col */

export interface MetaData {
  /** رقم الطلب */
  orderNumber: string;
  /** تاريخ الطلب  e.g. "2026/05/13" */
  orderDate: string;
  /** رقم الصك */
  deedNumber: string;
}

/** Section 1 — بيانات الصك والعقار (11 questions) */
export interface Section1Data {
  /**
   * Answers array, index corresponds to question order:
   * [0]  هل الصك فعال
   * [1]  هل رقم القطعة مطابق للصك
   * [2]  هل رقم المخطط مطابق للصك
   * [3]  هل القطعة زائدة تنظيمية
   * [4]  هل يوجد نزع على منطقة العقار
   * [5]  هل الأرض موقوفة
   * [6]  هل العقار وقف
   * [7]  هل تم التأكد من استخدام العقار
   * [8]  هل تم الاستعلام من وزارة الزراعة
   * [9]  هل الصك مشاع
   * [10] في حال الصك مشاع — المساحة المملوكة
   */
  answers: Answer[];
  notes?: string;
}

/** Section 2 — الرفع المساحي والطبيعة (7 questions) */
export interface Section2Data {
  /**
   * [0] هل الصك مطابق للرفع المساحي
   * [1] هل تم رصد جميع الاختلافات
   * [2] هل تم تطبيق جميع التعليمات
   * [3] هل تم التوقيع وإرفاق إقرار
   * [4] هل يوجد تداخل في الأصل
   * [5] هل يوجد على الأصل مبنى مشترك
   * [6] هل ذُكر المرجع المعتمد
   */
  answers: Answer[];
  notes?: string;
}

export type MeterType = 'electronic' | 'archived' | 'none' | null;

/** Section 3 — مكونات العقار (9 questions + meter) */
export interface Section3Data {
  /**
   * [0] هل يوجد في العقار بئر
   * [1] هل يوجد في العقار غرفة كهرباء
   * [2] هل يوجد في العقار أبراج كهرباء
   * [3] هل يوجد في العقار أبراج اتصالات
   * [4] هل يوجد في العقار مضخة دفاع مدني
   * [5] هل يوجد في العقار منقولات
   * [6] هل يوجد في العقار مركبات
   * [7] هل يوجد في العقار معدات زراعية أو موجودات حيوية
   * [8] هل تم مطابقة مكونات العقار على الطبيعة
   */
  answers: Answer[];
  /** رقم عداد الكهرباء */
  meterNumber?: string;
  /** نوع العداد */
  meterType?: MeterType;
  notes?: string;
}

/** Section 4 — الإشغال والإيجار (6 questions) */
export interface Section4Data {
  /**
   * [0] هل العقار مأهول بالسكان
   * [1] هل يوجد عقد إيجار
   * [2] هل تم مطابقة رقم الصك بعقد الإيجار
   * [3] هل عقد الإيجار ساري
   * [4] هل عقد الإيجار إلكتروني
   * [5] هل يوجد اتحاد ملاك
   */
  answers: Answer[];
  /** قيمة اشتراك اتحاد الملاك بالريال السعودي */
  ownershipFee?: number;
  notes?: string;
}

/** Section 5 — ملاحظات إضافية (4 questions + sub-notes) */
export interface Section5Data {
  /**
   * [0] هل تم ذكر جميع الملاحظات
   * [1] هل يوجد ملاحظات فنية مؤثرة
   * [2] هل هناك عوامل بيئية/تنظيمية
   * [3] هل العقار يحتوي على إضافات غير مسجلة
   */
  answers: Answer[];
  /** Sub-notes per question — same index */
  subNotes?: (string | undefined)[];
}

export interface ApprovalData {
  approverName: string;
  approvalDate: string;
}

export interface CaseStudyReportDocumentProps {
  meta: MetaData;
  section1: Section1Data;
  section2: Section2Data;
  section3: Section3Data;
  section4: Section4Data;
  section5: Section5Data;
  approval: ApprovalData;
}

/* ============================================================
   SMALL SHARED COMPONENTS
   ============================================================ */

/** Renders ☑ or ☐ — never an <input> */
const Cb: React.FC<{ on: Answer }> = ({ on }) => (
  <span className={`csrd-cb${on === true ? ' csrd-cb--on' : ''}`}>
    {on === true ? '☑' : '☐'}
  </span>
);

interface YNRowProps {
  question: string;
  answer: Answer;
  /** label for left/positive column, defaults to "نعم / فعال" */
  yesLabel?: string;
  /** label for right/negative column, defaults to "لا / غير فعال" */
  noLabel?: string;
}

const YNRow: React.FC<YNRowProps> = ({ question, answer }) => (
  <tr>
    <td>{question}</td>
    <td className="csrd-yn"><Cb on={answer === true ? true : false} /></td>
    <td className="csrd-yn"><Cb on={answer === false ? true : false} /></td>
  </tr>
);

const AlertStrip: React.FC<{ text?: string }> = ({
  text = 'في حال وجود اختلاف في البيانات أعلاه يتم التوضيح في الملاحظات ادناه',
}) => <div className="csrd-alert">⚠ {text}</div>;

const SectionHeader: React.FC<{ title: string; colSpan?: number }> = ({
  title,
  colSpan = 3,
}) => (
  <tr className="csrd-sec-hdr">
    <td colSpan={colSpan}>{title}</td>
  </tr>
);

const ColHeaderRow: React.FC<{
  questionLabel?: string;
  yesLabel: string;
  noLabel: string;
}> = ({ questionLabel = 'الأسئلة', yesLabel, noLabel }) => (
  <tr className="csrd-col-hdr">
    <th>{questionLabel}</th>
    <th className="csrd-yn">{yesLabel}</th>
    <th className="csrd-yn">{noLabel}</th>
  </tr>
);

const NotesRow: React.FC<{ label?: string; notes?: string; colSpan?: number }> = ({
  label = 'في حال وجود اختلاف في البيانات أعلاه يتم التوضيح في الملاحظات ادناه',
  notes,
  colSpan = 3,
}) => (
  <tr className="csrd-notes-row">
    <td colSpan={colSpan}>
      <span className="csrd-notes-label">{label}</span>
      {notes ?? '—'}
    </td>
  </tr>
);

/* ============================================================
   PAGE HEADER
   ============================================================ */
const PageHeader: React.FC = () => (
  <div className="csrd-header">
    {headerImg ? (
      <img src={headerImg} alt="Ejadah letterhead header" />
    ) : (
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
        <div className="csrd-header-url">Ejadah-sa.com</div>
      </div>
    )}
  </div>
);

/* ============================================================
   PAGE FOOTER
   ============================================================ */
const PageFooter: React.FC = () => (
  <div className="csrd-footer">
    {footerImg ? (
      <img src={footerImg} alt="Ejadah letterhead footer" />
    ) : (
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
          Ejadah Profissional Company
        </div>
      </div>
    )}
  </div>
);

/* ============================================================
   WATERMARK
   ============================================================ */
const Watermark: React.FC = () => (
  <div className="csrd-watermark">
    {watermarkImg ? (
      <img src={watermarkImg} alt="" aria-hidden="true" />
    ) : (
      <div className="csrd-watermark-placeholder">
        <span className="csrd-watermark-text" aria-hidden="true">
          {Array(12).fill('EJADAH PROFESSIONAL · ').join('')}
        </span>
      </div>
    )}
  </div>
);

/* ============================================================
   SECTION 0 — بيانات التعميد
   ============================================================ */
const CommissionDataTable: React.FC<{ meta: MetaData }> = ({ meta }) => (
  <div className="csrd-section">
    <table className="csrd-table">
      <tbody>
        <SectionHeader title="بيانات التعميد" colSpan={2} />
        <tr>
          <td className="csrd-data-lbl">اسم مزود الخدمة</td>
          <td>شركة إجادة المهنية للتقييم</td>
        </tr>
        <tr>
          <td className="csrd-data-lbl">رقم الطلب</td>
          <td style={{ direction: 'ltr', textAlign: 'right' }}>{meta.orderNumber}</td>
        </tr>
        <tr>
          <td className="csrd-data-lbl">تاريخ الطلب</td>
          <td style={{ direction: 'ltr', textAlign: 'right' }}>{meta.orderDate}</td>
        </tr>
        <tr>
          <td className="csrd-data-lbl">رقم الصك</td>
          <td style={{ direction: 'ltr', textAlign: 'right' }}>{meta.deedNumber}</td>
        </tr>
      </tbody>
    </table>
  </div>
);

/* ============================================================
   SECTION 1 — بيانات الصك والعقار
   ============================================================ */
const SECTION1_QUESTIONS = [
  'هل الصك فعال',
  'هل رقم القطعة مطابق للصك',
  'هل رقم المخطط مطابق للصك',
  'هل القطعة زائدة تنظيمية',
  'هل يوجد نزع على منطقة العقار',
  'هل الأرض موقوفة',
  'هل العقار وقف',
  'هل تم التأكد من استخدام العقار (سكني – تجاري – ...)',
  'هل تم الاستعلام من وزارة الزراعة حيال الأرض الزراعية',
  'هل الصك مشاع',
  'في حال أن الصك مشاع هل المساحة المملوكة بالبنك لكامل مساحة العقار أو لجزء محدد وتحديد النسبة في الملاحظات',
];

const DeedDataSection: React.FC<{ data: Section1Data }> = ({ data }) => (
  <div className="csrd-section">
    <AlertStrip />
    <table className="csrd-table">
      <tbody>
        <SectionHeader title="بيانات الصك والعقار" />
        <ColHeaderRow yesLabel="فعال / نعم" noLabel="غير فعال / لا" />
        {SECTION1_QUESTIONS.map((q, i) => (
          <YNRow key={i} question={q} answer={data.answers[i] ?? null} />
        ))}
        <NotesRow notes={data.notes} />
      </tbody>
    </table>
  </div>
);

/* ============================================================
   SECTION 2 — الرفع المساحي والطبيعة
   ============================================================ */
const SECTION2_QUESTIONS = [
  'هل الصك مطابق للرفع المساحي',
  'هل تم رصد جميع الاختلافات في الرفع المساحي',
  'هل تم تطبيق جميع التعليمات الصادرة من المركزي في الرفع المساحي',
  'هل تم التوقيع وإرفاق إقرار على صحة الموقع',
  'هل يوجد تداخل في الأصل',
  'هل يوجد على الأصل مبنى مشترك',
  'هل ذُكر المرجع المعتمد في الاستدلال على استخدام العقار',
];

const SurveySection: React.FC<{ data: Section2Data }> = ({ data }) => (
  <div className="csrd-section">
    <AlertStrip />
    <table className="csrd-table">
      <tbody>
        <SectionHeader title="الرفع المساحي والطبيعة" />
        <ColHeaderRow yesLabel="تم التطبيق" noLabel="لم يتم التطبيق" />
        {SECTION2_QUESTIONS.map((q, i) => (
          <YNRow key={i} question={q} answer={data.answers[i] ?? null} />
        ))}
        <NotesRow label="الملاحظات" notes={data.notes} />
      </tbody>
    </table>
  </div>
);

/* ============================================================
   SECTION 3 — مكونات العقار
   ============================================================ */
const SECTION3_QUESTIONS = [
  'هل يوجد في العقار بئر',
  'هل يوجد في العقار غرفة كهرباء',
  'هل يوجد في العقار أبراج كهرباء',
  'هل يوجد في العقار أبراج اتصالات',
  'هل يوجد في العقار مضخة دفاع مدني',
  'هل يوجد في العقار منقولات',
  'هل يوجد في العقار مركبات',
  'هل يوجد في العقار معدات زراعية أو موجودات حيوية',
  'هل تم مطابقة مكونات العقار على الطبيعة مع المكونات المذكورة في الصك (للأصول المفروزة)',
];

const METER_LABELS: Record<NonNullable<MeterType>, string> = {
  electronic: 'الكتروني',
  archived:   'مؤرشف',
  none:       'لا يوجد',
};

const PropertyComponentsSection: React.FC<{ data: Section3Data }> = ({ data }) => (
  <div className="csrd-section csrd-section--break">
    <table className="csrd-table">
      <tbody>
        <SectionHeader title="مكونات العقار" />
        <ColHeaderRow yesLabel="يوجد" noLabel="لا يوجد" />
        {SECTION3_QUESTIONS.map((q, i) => (
          <YNRow key={i} question={q} answer={data.answers[i] ?? null} />
        ))}

        {/* عداد الكهرباء */}
        <tr>
          <td>
            عداد الكهرباء رقم عداد الكهرباء (
            {data.meterNumber ?? '\u00A0\u00A0\u00A0\u00A0'})
          </td>
          <td colSpan={2}>
            <div className="csrd-meter-opts">
              {(['electronic', 'archived', 'none'] as const).map((type) => (
                <span key={type}>
                  <span
                    className={`csrd-cb${data.meterType === type ? ' csrd-cb--on' : ''}`}
                  >
                    {data.meterType === type ? '☑' : '☐'}
                  </span>{' '}
                  {METER_LABELS[type]}
                </span>
              ))}
            </div>
          </td>
        </tr>

        <NotesRow label="الملاحظات" notes={data.notes} />
      </tbody>
    </table>
  </div>
);

/* ============================================================
   SECTION 4 — الإشغال والإيجار
   ============================================================ */
const OccupancySection: React.FC<{ data: Section4Data }> = ({ data }) => {
  const questions = [
    'هل العقار مأهول بالسكان',
    'هل يوجد عقد إيجار',
    'هل تم مطابقة رقم الصك بالمذكور بعقد الإيجار',
    'هل عقد الإيجار ساري',
    'هل عقد الإيجار إلكتروني',
    <>
      هل يوجد اتحاد ملاك؟{' '}
      <span style={{ color: '#5A5A5A' }}>
        &nbsp;&nbsp;قيمة اشتراك اتحاد الملاك{' '}
        {data.ownershipFee !== undefined
          ? `${data.ownershipFee.toLocaleString('ar-SA')} ريال سعودي`
          : '................... ريال سعودي'}
      </span>
    </>,
  ];

  return (
    <div className="csrd-section">
      <table className="csrd-table">
        <tbody>
          <SectionHeader title="الإشغال والإيجار" />
          <ColHeaderRow yesLabel="نعم" noLabel="لا" />
          {questions.map((q, i) => (
            <tr key={i}>
              <td>{q}</td>
              <td className="csrd-yn">
                <Cb on={data.answers[i] === true ? true : false} />
              </td>
              <td className="csrd-yn">
                <Cb on={data.answers[i] === false ? true : false} />
              </td>
            </tr>
          ))}
          <NotesRow label="الملاحظات" notes={data.notes} />
        </tbody>
      </table>
    </div>
  );
};

/* ============================================================
   SECTION 5 — ملاحظات إضافية
   ============================================================ */
const SECTION5_QUESTIONS = [
  'هل تم ذكر جميع الملاحظات للتوضيح في حال عدم المطابقة',
  'هل يوجد ملاحظات فنية قد تؤثر على قيمة العقار',
  'هل هناك أي عوامل بيئية أو تنظيمية قد تؤثر على العقار (مثل طريق مستقبلي أو قيود بناء)',
  'هل العقار يحتوي على أي إضافات غير مسجلة في الصك',
];

const AdditionalNotesSection: React.FC<{ data: Section5Data }> = ({ data }) => (
  <div className="csrd-section">
    <table className="csrd-table">
      <tbody>
        <SectionHeader title="ملاحظات إضافية" />
        <ColHeaderRow yesLabel="يوجد" noLabel="لا يوجد" />
        {SECTION5_QUESTIONS.map((q, i) => (
          <React.Fragment key={i}>
            <YNRow question={q} answer={data.answers[i] ?? null} />
            <tr className="csrd-sub-row">
              <td colSpan={3}>
                {data.subNotes?.[i]
                  ? data.subNotes[i]
                  : 'في حال وجود اختلاف يتم التوضيح في الملاحظات ادناه / لا يوجد'}
              </td>
            </tr>
          </React.Fragment>
        ))}
      </tbody>
    </table>
  </div>
);

/* ============================================================
   SECTION 6 — قسم الاعتماد
   ============================================================ */
const ApprovalSection: React.FC<{
  meta: MetaData;
  approval: ApprovalData;
}> = ({ meta, approval }) => (
  <div className="csrd-approval-block">
    <div className="csrd-approval-decl">
      نقرنحن شركة اجادة المهنية للتقييم بصحة ما ورد في النموذج أعلاه مع تحمل كافة
      المسؤولية نحو ذلك..
    </div>
    <table className="csrd-table csrd-approval-table">
      <thead>
        <tr>
          <th style={{ width: '22%' }}>رقم الصك:</th>
          <th style={{ width: '22%' }}>معتمد التقرير</th>
          <th style={{ width: '16%' }}>التاريخ</th>
          <th style={{ width: '20%' }}>التوقيع</th>
          <th style={{ width: '20%' }}>ختم الشركة</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ fontWeight: 700, fontSize: '8.5pt', direction: 'ltr' }}>
            {meta.deedNumber}
          </td>
          <td>{approval.approverName}</td>
          <td style={{ direction: 'ltr' }}>{approval.approvalDate}</td>
          <td>
            {signatureImg ? (
              <img src={signatureImg} alt="التوقيع" />
            ) : (
              <div className="csrd-sig-box">التوقيع</div>
            )}
          </td>
          <td>
            {stampImg ? (
              <img src={stampImg} alt="ختم الشركة" />
            ) : (
              <div className="csrd-stamp-box">الختم</div>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

/* ============================================================
   ROOT COMPONENT
   ============================================================ */
const CaseStudyReportDocument: React.FC<CaseStudyReportDocumentProps> = ({
  meta,
  section1,
  section2,
  section3,
  section4,
  section5,
  approval,
}) => {
  return (
    <div className="csrd-root" lang="ar" dir="rtl">
      {/* ── Fixed page furniture ── */}
      <PageHeader />
      <PageFooter />
      <Watermark />

      {/* ── Document content ── */}
      <div className="csrd-content">
        {/* Report title */}
        <div className="csrd-title-block">
          <div className="csrd-title-main">نموذج دراسة الحالة</div>
          <div className="csrd-title-sub">منصة إدارة التقييم العقاري</div>
        </div>

        {/* Page 1 */}
        <CommissionDataTable meta={meta} />
        <DeedDataSection data={section1} />
        <SurveySection data={section2} />

        {/* Page 2 (forced break inside PropertyComponentsSection) */}
        <PropertyComponentsSection data={section3} />
        <OccupancySection data={section4} />

        {/* Page 3 */}
        <AdditionalNotesSection data={section5} />
        <ApprovalSection meta={meta} approval={approval} />
      </div>
    </div>
  );
};

export default CaseStudyReportDocument;
