import { getApiBase } from "./index";
import { repositoryFetch as fetch } from "./write-repository";
import { ApiAuthError } from "./permissions";

export type OrganizationSettingsApiConfig = {
  baseUrl?: string;
  token: string;
};

export type OrganizationCompanySettings = {
  name: string;
  taxNumber?: string | null;
  address?: string | null;
  commercialRegistration?: string | null;
  practiceLicenseNumber?: string | null;
  /** ISO date — إصدار ترخيص مزاولة المنشأة. */
  practiceLicenseIssuedAt?: string | null;
  practiceLicenseExpiresAt?: string | null;
  certifiedValuerId?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
};

/** بيانات المنشأة — المصدر: الإعدادات v2.dc.html `o`. */
export const ORG_COMPANY_DEFAULTS: OrganizationCompanySettings = {
  name: "شركة إجادة المهنية للتقييم العقاري",
  commercialRegistration: "1010456789",
  taxNumber: "310123456700003",
  practiceLicenseNumber: "1302",
  practiceLicenseIssuedAt: "2022-03-10",
  practiceLicenseExpiresAt: "2027-03-10",
  certifiedValuerId: "certified",
  address: "الرياض — حي الصحافة، طريق الملك فهد، مبنى 7443",
  email: "info@ejadah.sa",
  phone: "+966114567890",
  website: "ejadah.sa",
};

export type OrganizationEvaluatorSettings = {
  name?: string | null;
  licenseNumber?: string | null;
  membershipNumber?: string | null;
  membershipCategory?: string | null;
  licenseExpiresAt?: string | null;
  membershipExpiresAt?: string | null;
  /** تاريخ إصدار الترخيص (هجري). */
  licenseIssuedAt?: string | null;
  /** تاريخ انتهاء الترخيص (هجري) للعرض. */
  licenseExpiresHijri?: string | null;
  /** صفته. */
  title?: string | null;
};

export const VALUER_MEMBERSHIP_CATEGORIES = [
  { value: "fellow", label: "عضو أساسي زميل" },
  { value: "associate", label: "عضو أساسي منتسب" },
  { value: "affiliate", label: "عضو أساسي" },
  { value: "student", label: "طالب" },
] as const;

/** فئة العضوية في سجل المقيّمين — المصدر: الإعدادات v2.dc.html `isValuers`. */
export const VALUER_ROSTER_MEMBERSHIP_OPTIONS = [
  { value: "fellow", label: "عضو أساسي زميل" },
  { value: "associate", label: "عضو أساسي منتسب" },
  { value: "affiliate", label: "عضو منتسب" },
] as const;

/** الدور في النظام — صلاحية المنشأة، لا صفة الهيئة. */
export const VALUER_SYS_ROLES = [
  { value: "certified", label: "مقيم معتمد" },
  { value: "valuer", label: "مقيم عقاري" },
  { value: "reviewer", label: "مقيم عقاري مراجع" },
  { value: "assistant", label: "مساعد مقيم" },
] as const;

/** بيانات المقيم المعتمد — المصدر: الإعدادات v2.dc.html `cv`. */
export const CERTIFIED_VALUER_HTML_DEFAULTS: OrganizationEvaluatorSettings = {
  name: "عماد رشيد صالح الرشيد",
  licenseNumber: "1302",
  licenseIssuedAt: "1437-03-02",
  licenseExpiresHijri: "1452-04-29",
  membershipNumber: "1210000003",
  membershipCategory: "fellow",
  title: "الرئيس التنفيذي",
  membershipExpiresAt: "2026-06-03",
};

export const CERTIFIED_VALUER_HTML_BRANCH = "فرع العقار";

/** Additional valuers for report participants — certified singleton stays on `evaluator`. */
export type OrganizationValuerRosterEntry = {
  id: string;
  nameAr: string;
  licenseNumber?: string | null;
  membershipNumber?: string | null;
  membershipCategory?: string | null;
  licenseExpiresAt?: string | null;
  licenseIssuedAt?: string | null;
  membershipExpiresAt?: string | null;
  /** certified | valuer | assistant | reviewer */
  role: string;
  isActive: boolean;
  /** توقيع المقيّم — يُطبع في التقارير الجديدة. */
  signatureUrl?: string | null;
};

/** سجل المقيّمين — المصدر: الإعدادات v2.dc.html `valuers`. */
export const VALUER_ROSTER_HTML_DEFAULTS: OrganizationValuerRosterEntry[] = [
  {
    id: "v1",
    nameAr: "عماد رشيد صالح الرشيد",
    licenseNumber: "1302",
    membershipNumber: "1210000003",
    membershipCategory: "fellow",
    membershipExpiresAt: "2026-06-03",
    role: "certified",
    isActive: true,
    signatureUrl: "/case-study/ejadah-signature.png",
  },
  {
    id: "v2",
    nameAr: "عبدالله الكثيري",
    membershipNumber: "1220001583",
    membershipCategory: "associate",
    membershipExpiresAt: "2027-01-20",
    role: "valuer",
    isActive: true,
    signatureUrl: "/case-study/ejadah-signature.png",
  },
  {
    id: "v3",
    nameAr: "سليمان عبد الله الصالحي",
    membershipNumber: "1220000919",
    membershipCategory: "associate",
    membershipExpiresAt: "2026-12-31",
    role: "reviewer",
    isActive: true,
    signatureUrl: "/case-study/ejadah-signature.png",
  },
  {
    id: "v4",
    nameAr: "سالم الغريب",
    membershipNumber: "1220000845",
    membershipCategory: "fellow",
    membershipExpiresAt: "2027-06-30",
    role: "reviewer",
    isActive: true,
    signatureUrl: null,
  },
  {
    id: "v5",
    nameAr: "أيمن أحمد مجرشي",
    membershipNumber: "1210002040",
    membershipCategory: "associate",
    membershipExpiresAt: "2026-12-31",
    role: "assistant",
    isActive: true,
    signatureUrl: null,
  },
  {
    id: "v6",
    nameAr: "محمد العساف",
    membershipNumber: "1210003474",
    membershipCategory: "associate",
    membershipExpiresAt: "2027-12-31",
    role: "valuer",
    isActive: true,
    signatureUrl: null,
  },
];

export type OrganizationBrandingSettings = {
  stampUrl: string;
  signatureUrl: string;
  headerUrl?: string | null;
  /** Report letterhead image — sliced by letterhead*Mm. */
  letterheadUrl?: string | null;
  watermarkText: string;
  logoColorUrl?: string | null;
  logoWhiteUrl?: string | null;
  stampWidthCm?: number | null;
  stampHeightCm?: number | null;
  /** Signature size on A4 (cm) — approval / participants tables. */
  signatureWidthCm?: number | null;
  signatureHeightCm?: number | null;
  letterheadHeadMm?: number | null;
  letterheadFootTopMm?: number | null;
  letterheadPadMm?: number | null;
  letterheadPadStartMm?: number | null;
  letterheadStripMm?: number | null;
  logoVersion?: string | null;
  logoUpdatedAt?: string | null;
  logoUploadedBy?: string | null;
  stampUpdatedAt?: string | null;
  stampUploadedBy?: string | null;
  letterheadVersion?: string | null;
  letterheadUpdatedAt?: string | null;
};

/** الهوية البصرية — المصدر: الإعدادات v2.dc.html (isBrand) وأصول assets. */
export const BRAND_IDENTITY_DEFAULTS: OrganizationBrandingSettings = {
  stampUrl: "/case-study/ejadah-stamp.svg",
  signatureUrl: "/case-study/ejadah-signature.png",
  headerUrl: null,
  letterheadUrl: "/case-study/ejadah-letterhead.png",
  watermarkText: "EJADAH",
  logoColorUrl: "/case-study/logo.svg",
  logoWhiteUrl: "/case-study/logo-sidebar.svg",
  stampWidthCm: 4,
  stampHeightCm: 2,
  signatureWidthCm: 4,
  signatureHeightCm: 2,
  letterheadHeadMm: 41,
  letterheadFootTopMm: 270,
  letterheadPadMm: 17,
  letterheadPadStartMm: 13,
  letterheadStripMm: 13,
  logoVersion: "v3",
  logoUpdatedAt: "2026-05-02",
  logoUploadedBy: "م. عبدالله الحربي",
  stampUpdatedAt: "2026-03-14",
  stampUploadedBy: "مسؤول النظام",
  letterheadVersion: "v2",
  letterheadUpdatedAt: "2026-06-19",
};

export type OrganizationCommunicationsSettings = {
  otpProvider: string;
  defaultOtpChannel: string;
  smsSenderId?: string | null;
  emailFrom?: string | null;
  smsApiUrl?: string | null;
  smsApiKey?: string | null;
  smsApiKeyConfigured?: boolean;
  smtpHost?: string | null;
  smtpPort?: number;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  smtpPasswordConfigured?: boolean;
};

export type OrganizationSlaSettings = {
  defaultBusinessDays: number;
  privateSectorBusinessDays: number;
};

/** «حد أقصى قابل للضبط» — P2-5 approved 2026-08-16. */
export type OrganizationValuationSettings = {
  maxAdoptedComparables: number;
  /** ق-4: عتبة الفارق الزمني بالأشهر لتنبيه تسوية الزمن (m20). */
  comparableTimeGapMonths: number;
  /** معامل تسوية المساحة ٪ (منطق-التسويات). */
  areaFactorPct: number;
  /** معدل تغير السوق السنوي ٪ لاقتراح ظروف السوق. */
  annualMarketRatePct: number;
  /** أسّ تقريب قيمة السوق (١٠^ن) — منطق-التسويات. */
  marketValueRoundDecimals: number;
};

/** تبويب «تقرير التقييم» (القرار 25 طبقة ب) — ثوابت ونصوص تُعبَّأ مرة. */
export type OrganizationValuationReportSettings = {
  reportType: string;
  currency: string;
  valuationBranch: string;
  keyInputsText: string;
  professionalStandards: string;
  independence: string;
  researchScopeText: string;
  terms: string;
  restrictions: string;
  ivsStandards: string;
  glossary: string;
  finishingLuxury: string;
  finishingMedium: string;
  finishingOrdinary: string;
  specialAssumptionLibrary: string[];
};

export function emptyValuationReportSettings(): OrganizationValuationReportSettings {
  return {
    reportType: "",
    currency: "",
    valuationBranch: "",
    keyInputsText: "",
    professionalStandards: "",
    independence: "",
    researchScopeText: "",
    terms: "",
    restrictions: "",
    ivsStandards: "",
    glossary: "",
    finishingLuxury: "",
    finishingMedium: "",
    finishingOrdinary: "",
    specialAssumptionLibrary: [],
  };
}

/** تقرير التقييم المهني — المصدر: الإعدادات v2.dc.html `isProReport` / `rpt`. */
export const VALUATION_REPORT_HTML_DEFAULTS: OrganizationValuationReportSettings = {
  reportType: "تقرير مفصل",
  currency: "الريال السعودي (ر.س.)",
  valuationBranch: CERTIFIED_VALUER_HTML_BRANCH,
  keyInputsText:
    "إطار نطاق العمل الذي تمت مناقشته مع العميل، ومن خلاله تم تحديد الغرض من التقييم، والمخرجات المتوقعة من تقرير التقييم.\n" +
    "بيانات العقارات الأساسية المستخرجة من المستندات الرسمية للعقار، مثل صك الملكية، ورخصة البناء للمباني، وإثباتات الدخل للعقارات المدرة للدخل.\n" +
    "نوع العقار وموقعه وحالته الراهنة ونوع الاستخدام الحالي والتنظيمي.",
  professionalStandards:
    "تم إعداد هذا التقرير وفقًا لمعايير التقييم الدولية السارية من {{ivsDate}} الصادرة عن مجلس المعايير الدولية (IVSC) والمعتمدة من الهيئة السعودية للمقيمين المعتمدين.",
  independence:
    "تقر وتؤكد شركة إجادة المهنية للتقييم شركة شخص واحد على استقلالية مقيميها وعدم وجود منفعة أو مصالح خاصة في تقييم هذا العقار.",
  researchScopeText:
    "المستندات المستلمة من قبل العميل.\n" +
    "الوقوف المباشر على العقار ومعاينته ودراسة خصائصه.\n" +
    "مؤشرات العرض والطلب في منطقة العقار، والبحث والاستقصاء عن أسعار العروض العقارية والمبيعات والصفقات المنفذة في منطقة العقار.\n" +
    "دراسة منطقة العقار ومدى توفر خدمات البنية التحتية والفوقية، واكتمال العمران في المنطقة المحيطة وأنظمة البناء.\n" +
    "تحليل مؤشرات الصفقات العقارية من المصادر الموثوقة مثل مؤشر وزارة العدل.\n" +
    "المكاتب العقارية المتواجدة في محيط منطقة العقار.\n" +
    "قاعدة البيانات الداخلية وسجلات عمليات التقييم الداخلية للشركة.\n" +
    "الهيئة العامة للإحصاء فيما يخص دراسة السوق في المنطقة وفي المملكة بشكل عام.\n" +
    "الاسترشاد بالأدلة الاسترشادية والمناهج والإصدارات الصادرة عن الهيئة السعودية للمقيمين المعتمدين.",
  terms:
    "اعتمد المقيم على صحة وسلامة صكوك الملكية والمستندات القانونية المقدمة من العميل دون التحقق من أصولها لدى الجهات المختصة، ويفترض التقرير خلو العقار من أي التزامات او عوائق قانونية لم يتم الإفصاح عنها.\n" +
    "يقتصر دور المقيم على المعاينة البصرية الظاهرية للموقع، لذا فإن المقيم والشركة يخليان مسؤوليتهما عن أي عيوب إنشائية خفية، أو أعطال في الأنظمة الميكانيكية والكهربائية، أو وجود مواد خطرة ومضرة بالبيئة لا يمكن كشفها إلا بالفحص الهندسي المتخصص.\n" +
    "لا يغطي هذا التقييم أي دراسات تتعلق بتربة الأرض أو خصائصها الجيولوجية والزلازل، ولا يتحمل المقيم مسؤولية أي أضرار ناتجة عن طبيعة الأرض ما لم تكن ظاهرة ومؤثرة وقت المعاينة.\n" +
    "أُعد هذا التقرير لخدمة العميل والمستخدمين المقصودين فقط وللغرض المذكور في متنه، ولا يتحمل المقيم أي مسؤولية تجاه أي طرف ثالث يعتمد على التقرير دون موافقة خطية مسبقة من الشركة.\n" +
    "تعتبر القيمة التقديرية مرتبطة بظروف السوق وقت المعاينة، وهي صالحة لمدة (90) يومًا فقط من تاريخ التقرير، وأي تغير في ظروف السوق أو الاستخدام الحالي للعقار قد يؤدي إلى بطلان هذا التقدير.\n" +
    "تم إعداد هذا التقرير وفق معايير التقييم الدولية (IVS) وبحياد تام، دون وجود أي مصالح مشتركة أو مكاسب شخصية للمقيم في العقار محل الدراسة.\n" +
    "لا يعتبر هذا التقرير مستندًا نظاميًا مكتملًا إلا إذا تم اعتماده بختم الشركة الرسمي وتوقيع المقيم المعتمد.\n" +
    "تُعد القيمة الواردة في هذا التقرير قيمة تقديرية وفق أساس القيمة المحدد في نطاق العمل.",
  restrictions:
    "أُعد هذا التقرير حصريًا للغرض المحدد فيه، ولا يجوز استخدامه أو الاقتباس منه أو الإشارة إليه لأي غرض آخر غير الذي صُدر من أجله.\n" +
    "يُصنف هذا التقرير كوثيقة سرية للغاية، وهو مخصص لاستخدام العميل والمستخدمين المقصودين المسمَّين بالتقرير فقط، ولا يجوز تقديمه لأي طرف ثالث دون موافقة خطية صريحة ومسبقة من الشركة.\n" +
    "تحتفظ الشركة والمقيم بكافة حقوق الملكية الفكرية الخاصة بالتقرير؛ لذا يمنع منعًا باتًا إعادة إصدار التقرير أو نشر أي جزء منه في أي مراسلات أو مطبوعات أو وسائط إعلامية دون إذن خطي مسبق.\n" +
    "لا تتحمل الشركة أو المقيم أي مسؤولية قانونية أو مالية عن أي خسائر قد تنجم عن سوء استخدام التقرير، أو الاعتماد عليه من قبل أطراف غير مصرح لها، أو استخدامه في غير سياقه الموضح.\n" +
    "يُعد هذا التقرير وحدة فنية متكاملة وغير قابلة للتجزئة، ويُحظر استخدامه جزئيًا أو الاقتباس منه بشكلٍ منفصل عن سياقه الكلي وفرضياته الواردة فيه.",
  ivsStandards: "",
  glossary: "",
  finishingLuxury:
    "تشطيبات خارجية: الواجهات من حجر طبيعي أو دهان ذو جودة عالية، نوعية الأبواب الخارجية، نوعية أرضيات الساحات الخارجية.\n" +
    "تشطيبات داخلية: نوعية أرضيات المداخل والمجالس وصالات الطعام تتكون من رخام فاخر، نوعية الأبواب الداخلية، نوعية العزل، نوعية الشبابيك، مكونات الجدران الخارجية تكون مزدوجة، نوعية التسليك والسباكة، نوعية الدهان الداخلي، أعمال الجبس بأشكال هندسية وجودتها، تكييف مركزي، مصعد، جودة عمال التشطيب.",
  finishingMedium:
    "تشطيبات خارجية: الواجهات من حجر أو دهان، نوعية الأبواب الخارجية، نوعية أرضيات الساحات الخارجية غالبًا من السيراميك، مكونات الجدران الخارجية تكون مزدوجة.\n" +
    "تشطيبات داخلية: نوعية أرضيات المداخل والمجالس وصالات الطعام تتكون من السيراميك، نوعية الأبواب الداخلية، نوعية العزل، نوعية الشبابيك، نوعية التسليك والسباكة، نوعية الدهان الداخلي، أعمال الجبس وجودتها، التكييف منفصل (سبليت).",
  finishingOrdinary:
    "تشطيبات خارجية: الواجهات دهان، نوعية الأبواب الخارجية، نوعية أرضيات الساحات الخارجية غالبًا من بلاط بلدي.\n" +
    "تشطيبات داخلية: نوعية أرضيات المداخل والمجالس وصالات الطعام تتكون من السيراميك العادي أو بلاط بلدي لفرش الموكيت، نوعية الأبواب الداخلية، لا يوجد عوازل، الشبابيك عادية جدًا، نوعية التسليك والسباكة، نوعية الدهان الداخلي، لا يوجد جبس بالأسقف، نوعية التكييف شباك.",
  specialAssumptionLibrary: [
    "تؤخذ العوامل البيئية والاجتماعية وعوامل الحوكمة (ESG) في الاعتبار عند تقييم العقار، ويُشار إليها في التقرير متى ثبت تأثيرها على القيمة التقديرية أثناء تنفيذ مهمة التقييم.",
    "تمت معاينة العقار ظاهريًا، ولم يتم فحص العقار إنشائيًا، وعليه يجب أن يُفهم أن هذا تقرير تقييم وليس فحصًا إنشائيًا، وتم الاكتفاء بذكر الملاحظات الظاهرة والتي تؤثر في قيمة العقار.",
    "يفترض أن العقار مطلق الملكية وليس عليه أي نزاعات ملكية أو ورثة او قيود على البيع والتملك أو أي خطط لنزع ملكية العقار أو إجراءات تؤثر بالحق العقاري وفي حال تبين عكس ذلك يلزم إعادة النظر في القيمة.",
    "لم يستعن المقيّم بأي أخصائي أو مؤسسة خدمات أثناء تنفيذ مهمة التقييم، وجميع الإجراءات والتحليلات اللازمة نُفّذت بواسطة فريق العمل بإدارة التقييم.",
    "تم افتراض نوع استخدام الأرض حسب الاستخدام في المستكشف الإلكتروني.",
    "تم افتراض بأن قطعة الأرض ليست زائدة تنظيمية.",
    "تم افتراض عدم وجود نزع على قطعة الأرض في تاريخ التقييم.",
    "تم افتراض عدم وجود إيقاف على تراخيص البناء على العقار المراد تقييمه.",
  ],
};

/** Matches the org-library clause and the shorter backend denial. */
const NO_EXTERNAL_SPECIALIST_ASSUMPTION_MARKER = "لم يستعن المقيّم بأي أخصائي";

export function isNoExternalSpecialistAssumption(text: string): boolean {
  return text.replace(/\s+/g, " ").trim().includes(NO_EXTERNAL_SPECIALIST_ASSUMPTION_MARKER);
}

export function applyIvsDateToStandards(text: string, ivsDate: string): string {
  const date = ivsDate.trim() || "31 يناير 2025";
  return text.replaceAll("{{ivsDate}}", date);
}

export type OrganizationSettingsDto = {
  company: OrganizationCompanySettings;
  evaluator: OrganizationEvaluatorSettings;
  valuers: OrganizationValuerRosterEntry[];
  branding: OrganizationBrandingSettings;
  communications: OrganizationCommunicationsSettings;
  sla: OrganizationSlaSettings;
  valuation: OrganizationValuationSettings;
  valuationReport: OrganizationValuationReportSettings;
  updatedAtUtc: string;
};

export type SaveOrganizationSettingsRequest = {
  company?: OrganizationCompanySettings;
  evaluator?: OrganizationEvaluatorSettings;
  valuers?: OrganizationValuerRosterEntry[];
  branding?: OrganizationBrandingSettings;
  communications?: OrganizationCommunicationsSettings;
  sla?: OrganizationSlaSettings;
  valuation?: OrganizationValuationSettings;
  valuationReport?: OrganizationValuationReportSettings;
};

export type OrganizationSettingsResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "network" | "server" | "auth" | "forbidden" | "validation";
      message?: string;
    };

function normalizeCommunications(
  communications: Record<string, unknown>,
): OrganizationCommunicationsSettings {
  return {
    otpProvider: String(
      communications.otpProvider ?? communications.OtpProvider ?? "dev-log",
    ),
    defaultOtpChannel: String(
      communications.defaultOtpChannel ??
        communications.DefaultOtpChannel ??
        "sms",
    ),
    smsSenderId: (communications.smsSenderId ??
      communications.SmsSenderId ??
      null) as string | null,
    emailFrom: (communications.emailFrom ??
      communications.EmailFrom ??
      null) as string | null,
    smsApiUrl: (communications.smsApiUrl ??
      communications.SmsApiUrl ??
      null) as string | null,
    smsApiKey: null,
    smsApiKeyConfigured: Boolean(
      communications.smsApiKeyConfigured ??
        communications.SmsApiKeyConfigured ??
        false,
    ),
    smtpHost: (communications.smtpHost ??
      communications.SmtpHost ??
      null) as string | null,
    smtpPort: Number(communications.smtpPort ?? communications.SmtpPort ?? 587),
    smtpUsername: (communications.smtpUsername ??
      communications.SmtpUsername ??
      null) as string | null,
    smtpPassword: null,
    smtpPasswordConfigured: Boolean(
      communications.smtpPasswordConfigured ??
        communications.SmtpPasswordConfigured ??
        false,
    ),
  };
}

function normalizeValuers(raw: unknown): OrganizationValuerRosterEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: OrganizationValuerRosterEntry[] = [];
  for (const item of raw) {
    const v = (item ?? {}) as Record<string, unknown>;
    const nameAr = String(v.nameAr ?? v.NameAr ?? "").trim();
    if (!nameAr) continue;
    out.push({
      id: String(v.id ?? v.Id ?? "").trim() || `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      nameAr,
      licenseNumber: (v.licenseNumber ?? v.LicenseNumber ?? null) as string | null,
      membershipNumber: (v.membershipNumber ?? v.MembershipNumber ?? null) as string | null,
      membershipCategory: (v.membershipCategory ?? v.MembershipCategory ?? null) as string | null,
      licenseExpiresAt: (v.licenseExpiresAt ?? v.LicenseExpiresAt ?? null) as | string | null,
      licenseIssuedAt: (v.licenseIssuedAt ?? v.LicenseIssuedAt ?? null) as string | null,
      membershipExpiresAt: (v.membershipExpiresAt ?? v.MembershipExpiresAt ?? null) as string | null,
      role: String(v.role ?? v.Role ?? "assistant").trim() || "assistant",
      isActive: Boolean(v.isActive ?? v.IsActive ?? true),
      signatureUrl: (v.signatureUrl ?? v.SignatureUrl ?? null) as string | null,
    });
  }
  return out;
}

function pickStr(
  raw: Record<string, unknown>,
  camel: string,
  pascal: string,
): string {
  const value = raw[camel] ?? raw[pascal];
  return typeof value === "string" ? value : "";
}

function normalizeValuationReport( raw: Record<string, unknown> ): OrganizationValuationReportSettings {
  const libraryRaw =
    raw.specialAssumptionLibrary ?? raw.SpecialAssumptionLibrary;
  const library = Array.isArray(libraryRaw)
    ? libraryRaw.filter((item): item is string => typeof item === "string")
    : [];
  return {
    reportType: pickStr(raw, "reportType", "ReportType"),
    currency: pickStr(raw, "currency", "Currency"),
    valuationBranch: pickStr(raw, "valuationBranch", "ValuationBranch"),
    keyInputsText: pickStr(raw, "keyInputsText", "KeyInputsText"),
    professionalStandards: pickStr(
      raw,
      "professionalStandards",
      "ProfessionalStandards",
    ),
    independence: pickStr(raw, "independence", "Independence"),
    researchScopeText: pickStr(raw, "researchScopeText", "ResearchScopeText"),
    terms: pickStr(raw, "terms", "Terms"),
    restrictions: pickStr(raw, "restrictions", "Restrictions"),
    ivsStandards: pickStr(raw, "ivsStandards", "IvsStandards"),
    glossary: pickStr(raw, "glossary", "Glossary"),
    finishingLuxury: pickStr(raw, "finishingLuxury", "FinishingLuxury"),
    finishingMedium: pickStr(raw, "finishingMedium", "FinishingMedium"),
    finishingOrdinary: pickStr(raw, "finishingOrdinary", "FinishingOrdinary"),
    specialAssumptionLibrary: library,
  };
}

function numOr(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveStampUrl(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s === "/case-study/ejadah-stamp.png") {
    return BRAND_IDENTITY_DEFAULTS.stampUrl;
  }
  return s;
}

function normalizeSettings(raw: Record<string, unknown>): OrganizationSettingsDto {
  const company = (raw.company ?? raw.Company ?? {}) as Record<string, unknown>;
  const evaluator = (raw.evaluator ?? raw.Evaluator ?? {}) as Record<string, unknown>;
  const branding = (raw.branding ?? raw.Branding ?? {}) as Record<string, unknown>;
  const communications = (raw.communications ??
    raw.Communications ??
    {}) as Record<string, unknown>;
  const sla = (raw.sla ?? raw.Sla ?? {}) as Record<string, unknown>;
  const valuation = (raw.valuation ?? raw.Valuation ?? {}) as Record<string, unknown>;

  return {
    company: {
      name: String(
        company.name ?? company.Name ?? ORG_COMPANY_DEFAULTS.name,
      ),
      taxNumber: (company.taxNumber ?? company.TaxNumber ?? null) as string | null,
      address: (company.address ?? company.Address ?? null) as string | null,
      commercialRegistration: (company.commercialRegistration ?? company.CommercialRegistration ?? null) as string | null,
      practiceLicenseNumber: (company.practiceLicenseNumber ?? company.PracticeLicenseNumber ?? null) as string | null,
      practiceLicenseIssuedAt: (company.practiceLicenseIssuedAt ?? company.PracticeLicenseIssuedAt ?? null) as string | null,
      practiceLicenseExpiresAt: (company.practiceLicenseExpiresAt ?? company.PracticeLicenseExpiresAt ?? null) as string | null,
      certifiedValuerId: (company.certifiedValuerId ?? company.CertifiedValuerId ?? null) as string | null,
      email: (company.email ?? company.Email ?? null) as string | null,
      phone: (company.phone ?? company.Phone ?? null) as string | null,
      website: (company.website ?? company.Website ?? null) as string | null,
    },
    evaluator: {
      name: (evaluator.name ?? evaluator.Name ?? null) as string | null,
      licenseNumber: (evaluator.licenseNumber ?? evaluator.LicenseNumber ?? null) as string | null,
      membershipNumber: (evaluator.membershipNumber ?? evaluator.MembershipNumber ?? null) as string | null,
      membershipCategory: (evaluator.membershipCategory ?? evaluator.MembershipCategory ?? null) as string | null,
      licenseExpiresAt: (evaluator.licenseExpiresAt ?? evaluator.LicenseExpiresAt ?? null) as string | null,
      membershipExpiresAt: (evaluator.membershipExpiresAt ?? evaluator.MembershipExpiresAt ?? null) as string | null,
      licenseIssuedAt: (evaluator.licenseIssuedAt ?? evaluator.LicenseIssuedAt ?? null) as string | null,
      licenseExpiresHijri: (evaluator.licenseExpiresHijri ?? evaluator.LicenseExpiresHijri ?? null) as string | null,
      title: (evaluator.title ?? evaluator.Title ?? null) as string | null,
    },
    valuers: normalizeValuers(raw.valuers ?? raw.Valuers),
    branding: {
      stampUrl: resolveStampUrl(branding.stampUrl ?? branding.StampUrl), signatureUrl: String( 
        branding.signatureUrl ??
          branding.SignatureUrl ??
          BRAND_IDENTITY_DEFAULTS.signatureUrl,
      ),
      headerUrl: ( branding.headerUrl ?? branding.HeaderUrl ?? null ) as string | null,
      letterheadUrl: (branding.letterheadUrl ?? branding.LetterheadUrl ?? null) as | string | null,
      watermarkText: String( branding.watermarkText ?? branding.WatermarkText ?? "EJADAH" ),
      logoColorUrl: (branding.logoColorUrl ?? branding.LogoColorUrl ?? null) as | string | null,
      logoWhiteUrl: (branding.logoWhiteUrl ?? branding.LogoWhiteUrl ?? null) as | string | null,
      stampWidthCm: numOr( branding.stampWidthCm ?? branding.StampWidthCm, BRAND_IDENTITY_DEFAULTS.stampWidthCm! ),
      stampHeightCm: numOr( branding.stampHeightCm ?? branding.StampHeightCm, BRAND_IDENTITY_DEFAULTS.stampHeightCm! ),
      signatureWidthCm: numOr(
        branding.signatureWidthCm ?? branding.SignatureWidthCm,
        BRAND_IDENTITY_DEFAULTS.signatureWidthCm!,
      ),
      signatureHeightCm: numOr(
        branding.signatureHeightCm ?? branding.SignatureHeightCm,
        BRAND_IDENTITY_DEFAULTS.signatureHeightCm!,
      ),
      letterheadHeadMm: numOr( branding.letterheadHeadMm ?? branding.LetterheadHeadMm, BRAND_IDENTITY_DEFAULTS.letterheadHeadMm! ),
      letterheadFootTopMm: numOr( branding.letterheadFootTopMm ?? branding.LetterheadFootTopMm, BRAND_IDENTITY_DEFAULTS.letterheadFootTopMm! ),
      letterheadPadMm: numOr( branding.letterheadPadMm ?? branding.LetterheadPadMm, BRAND_IDENTITY_DEFAULTS.letterheadPadMm! ),
      letterheadPadStartMm: numOr( branding.letterheadPadStartMm ?? branding.LetterheadPadStartMm, BRAND_IDENTITY_DEFAULTS.letterheadPadStartMm! ),
      letterheadStripMm: numOr( branding.letterheadStripMm ?? branding.LetterheadStripMm, BRAND_IDENTITY_DEFAULTS.letterheadStripMm! ),
      logoVersion: (branding.logoVersion ?? branding.LogoVersion ?? null) as | string | null,
      logoUpdatedAt: (branding.logoUpdatedAt ?? branding.LogoUpdatedAt ?? null) as | string | null,
      logoUploadedBy: (branding.logoUploadedBy ?? branding.LogoUploadedBy ?? null) as | string | null,
      stampUpdatedAt: (branding.stampUpdatedAt ?? branding.StampUpdatedAt ?? null) as | string | null,
      stampUploadedBy: (branding.stampUploadedBy ?? branding.StampUploadedBy ?? null) as | string | null,
      letterheadVersion: (branding.letterheadVersion ?? branding.LetterheadVersion ?? null) as string | null,
      letterheadUpdatedAt: (branding.letterheadUpdatedAt ?? branding.LetterheadUpdatedAt ?? null) as string | null,
    },
    communications: normalizeCommunications(communications),
    sla: {
      defaultBusinessDays: Number(
        sla.defaultBusinessDays ?? sla.DefaultBusinessDays ?? 4,
      ),
      privateSectorBusinessDays: Number(
        sla.privateSectorBusinessDays ?? sla.PrivateSectorBusinessDays ?? 10,
      ),
    },
    valuation: {
      maxAdoptedComparables: Number(
        valuation.maxAdoptedComparables ?? valuation.MaxAdoptedComparables ?? 3,
      ),
      comparableTimeGapMonths: Number(
        valuation.comparableTimeGapMonths ?? valuation.ComparableTimeGapMonths ?? 6,
      ),
      areaFactorPct: Number(
        valuation.areaFactorPct ?? valuation.AreaFactorPct ?? 5,
      ),
      annualMarketRatePct: Number(
        valuation.annualMarketRatePct ?? valuation.AnnualMarketRatePct ?? 4,
      ),
      marketValueRoundDecimals: Number(
        valuation.marketValueRoundDecimals ??
          valuation.MarketValueRoundDecimals ??
          4,
      ),
    },
    valuationReport: normalizeValuationReport(
      (raw.valuationReport ?? raw.ValuationReport ?? {}) as Record<string, unknown>,
    ),
    updatedAtUtc: String(raw.updatedAtUtc ?? raw.UpdatedAtUtc ?? new Date().toISOString()),
  };
}

export async function getOrganizationSettings(
  config: OrganizationSettingsApiConfig,
): Promise<OrganizationSettingsResult<OrganizationSettingsDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/organization-settings`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeSettings(raw) };
  } catch (err) {
    if (err instanceof ApiAuthError) return { ok: false, kind: "auth" };
    return { ok: false, kind: "network" };
  }
}

export async function saveOrganizationSettings(
  config: OrganizationSettingsApiConfig,
  body: SaveOrganizationSettingsRequest,
): Promise<OrganizationSettingsResult<OrganizationSettingsDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/organization-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message: payload?.error ?? "بيانات غير صالحة",
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeSettings(raw) };
  } catch (err) {
    if (err instanceof ApiAuthError) return { ok: false, kind: "auth" };
    return { ok: false, kind: "network" };
  }
}

export async function testOrganizationCommunication(
  config: OrganizationSettingsApiConfig,
  body: { channel: string; destination: string },
): Promise<
  OrganizationSettingsResult<{ ok: boolean; provider: string; detail?: string | null }>
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/organization-settings/test-communication`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message: payload?.error ?? "بيانات غير صالحة",
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      data: {
        ok: Boolean(raw.ok ?? raw.Ok),
        provider: String(raw.provider ?? raw.Provider ?? ""),
        detail: (raw.detail ?? raw.Detail ?? null) as string | null,
      },
    };
  } catch (err) {
    if (err instanceof ApiAuthError) return { ok: false, kind: "auth" };
    return { ok: false, kind: "network" };
  }
}
