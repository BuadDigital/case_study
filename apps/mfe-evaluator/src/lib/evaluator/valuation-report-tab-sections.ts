/** Report field sheet for the appraiser — order matches `docs/نموذج تقرير التقييم/تقرير التقييم v3.dc.html`. */

export type ReportTabField = {
  id: string;
  label: string;
  /** Catalog keys from `ValuationReportFieldCatalog`. First filled wins. */
  keys?: readonly string[];
  compose?: "coords" | "license";
  span?: 1 | 2;
  ltr?: boolean;
};

export type ReportTabTableCell = {
  keys?: readonly string[];
  text?: string;
};

export type ReportTabTable = {
  columns: readonly string[];
  rows: readonly {
    label?: string;
    cells: readonly ReportTabTableCell[];
  }[];
};

export type ReportTabSection = {
  n: string;
  title: string;
  hint?: string;
  fields?: readonly ReportTabField[];
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  pairs?: readonly { term: string; text: string }[];
  tables?: readonly ReportTabTable[];
};

export const VALUATION_REPORT_TAB_SECTIONS: readonly ReportTabSection[] = [
  {
    n: "01",
    title: "هوية المقيم المعتمد",
    fields: [
      { id: "valuer-name", label: "اسم المقيم المعتمد", keys: ["valuer.name_ar"] },
      {
        id: "valuer-license",
        label: "رقم ترخيص مزاولة المهنة",
        keys: ["valuer.membership_number"],
        ltr: true,
      },
      { id: "valuer-issue", label: "تاريخ الإصدار" },
      { id: "valuer-expiry", label: "تاريخ الانتهاء" },
      { id: "valuer-branch", label: "فرع التقييم", span: 2 },
    ],
  },
  {
    n: "02",
    title: "نطاق العمل",
    fields: [
      {
        id: "client",
        label: "اسم العميل",
        keys: ["client_requesting_entity"],
      },
      {
        id: "valuation-date",
        label: "تاريخ التقييم",
        keys: ["valuation_effective_date_g"],
        ltr: true,
      },
      {
        id: "report-user",
        label: "اسم مستخدم تقرير التقييم",
        keys: ["client_requesting_entity"],
      },
      {
        id: "inspection-date",
        label: "تاريخ المعاينة",
        keys: ["inspection_date"],
        ltr: true,
      },
      { id: "owner", label: "اسم المالك", keys: ["owner_name"] },
      {
        id: "request-no",
        label: "رقم الطلب",
        keys: ["assignment_number"],
        ltr: true,
      },
      {
        id: "purpose",
        label: "الغرض من التقييم",
        keys: ["valuation_purpose_ar"],
      },
      {
        id: "request-date",
        label: "تاريخ الطلب",
        keys: ["entry_date_g"],
        ltr: true,
      },
      { id: "basis", label: "أساس القيمة", keys: ["basis_of_value_ar"] },
      {
        id: "premise",
        label: "فرضية القيمة (الاستخدام المفترض)",
        keys: ["value_premise_ar"],
      },
      { id: "report-type", label: "نوع التقرير" },
      { id: "currency", label: "عملة التقييم" },
      { id: "property-type", label: "نوع العقار", keys: ["property_type_ar"] },
      { id: "approaches", label: "أساليب التقييم المستخدمة" },
    ],
  },
  {
    n: "03",
    title: "المدخلات الرئيسية",
    bullets: [
      "إطار نطاق العمل الذي تمت مناقشته مع العميل، ومن خلاله تم تحديد الغرض من التقييم، والمخرجات المتوقعة من تقرير التقييم.",
      "بيانات العقارات الأساسية المستخرجة من المستندات الرسمية للعقار، مثل صك الملكية، ورخصة البناء للمباني، وإثباتات الدخل للعقارات المدرة للدخل.",
      "نوع العقار وموقعه وحالته الراهنة ونوع الاستخدام الحالي والتنظيمي.",
    ],
  },
  {
    n: "04",
    title: "التأكيد على الالتزام بمعايير التقييم الدولية",
    paragraphs: [
      "تم إعداد هذا التقرير وفقًا لمعايير التقييم الدولية السارية من 31 يناير 2025 الصادرة عن مجلس المعايير الدولية (IVSC) والمعتمدة من الهيئة السعودية للمقيمين المعتمدين.",
    ],
  },
  {
    n: "05",
    title: "إقرار بالاستقلالية وعدم تضارب المصالح",
    paragraphs: [
      "تقر وتؤكد شركة إجادة المهنية للتقييم شركة شخص واحد على استقلالية مقيميها وعدم وجود منفعة أو مصالح خاصة في تقييم هذا العقار.",
    ],
  },
  {
    n: "06",
    title: "الأصل محل التقييم",
    fields: [
      { id: "asset-type", label: "نوع العقار", keys: ["property_type_ar"] },
      {
        id: "asset-condition",
        label: "حالة العقار",
        keys: ["building_condition_ar"],
      },
      { id: "asset-desc", label: "وصف العقار", span: 2 },
      { id: "ownership", label: "نوع الملكية", span: 2 },
      { id: "has-movables", label: "هل يوجد منقولات" },
      { id: "movables-desc", label: "وصف المنقولات" },
    ],
  },
  {
    n: "07",
    title: "تفاصيل موقع العقار",
    fields: [
      { id: "region", label: "اسم المنطقة", keys: ["region_ar"] },
      { id: "city", label: "اسم المدينة", keys: ["city_ar"] },
      { id: "district", label: "اسم الحي", keys: ["district_ar"] },
      { id: "plan-name", label: "اسم المخطط", keys: ["property_plan_name"] },
      { id: "plan-no", label: "رقم المخطط", keys: ["plan_number"], ltr: true },
      {
        id: "block",
        label: "رقم البلك",
        keys: ["property_block_number"],
        ltr: true,
      },
      { id: "plot", label: "رقم القطعة", keys: ["plot_number"], ltr: true },
      { id: "usage", label: "استخدام العقار", keys: ["usage_type_ar"] },
      {
        id: "coords",
        label: "إحداثيات الموقع",
        keys: ["geo_latitude", "geo_longitude"],
        compose: "coords",
        ltr: true,
      },
      { id: "owner-2", label: "اسم المالك", keys: ["owner_name"] },
      { id: "deed-no", label: "رقم الصك", keys: ["deed_number"], ltr: true },
      { id: "deed-date", label: "تاريخ الصك", keys: ["deed_date_h"], ltr: true },
      {
        id: "license",
        label: "رقم رخصة البناء وتاريخها",
        keys: ["client_license_number", "client_license_date_h"],
        compose: "license",
        ltr: true,
      },
      {
        id: "age",
        label: "عمر البناء",
        keys: ["property_age_years", "property_effective_age"],
      },
      {
        id: "partition",
        label: "محضر التجزئة",
        keys: ["partition_minutes_number"],
      },
      {
        id: "build-state",
        label: "حالة البناء",
        keys: ["building_condition_ar"],
      },
      { id: "occupancy", label: "حالة الإشغال", keys: ["vacancy_ar"] },
    ],
  },
  {
    n: "08",
    title: "حدود وأطوال العقار",
    tables: [
      {
        columns: ["الجهة", "الحد", "طول الضلع", "الواجهات"],
        rows: [
          {
            cells: [
              { text: "الشمالية" },
              { keys: ["north_boundary"] },
              { keys: ["north_boundary_length_m"] },
              { keys: ["finishing_facade_north"] },
            ],
          },
          {
            cells: [
              { text: "الجنوبية" },
              { keys: ["south_boundary"] },
              { keys: ["south_boundary_length_m"] },
              { keys: ["finishing_facade_south"] },
            ],
          },
          {
            cells: [
              { text: "الشرقية" },
              { keys: ["east_boundary"] },
              { keys: ["east_boundary_length_m"] },
              { keys: ["finishing_facade_east"] },
            ],
          },
          {
            cells: [
              { text: "الغربية" },
              { keys: ["west_boundary"] },
              { keys: ["west_boundary_length_m"] },
              { keys: ["finishing_facade_west"] },
            ],
          },
        ],
      },
    ],
  },
  {
    n: "09",
    title: "تفاصيل المساحات",
    fields: [
      { id: "land-area", label: "مساحة الأرض (حسب الصك)", span: 2 },
    ],
    tables: [
      {
        columns: ["البيان — الحصر الميداني", "المساحة (م²)"],
        rows: [
          {
            cells: [
              { text: "الدور الأرضي" },
              { keys: ["cost_line.7090"] },
            ],
          },
          {
            cells: [{ text: "الدور الأول" }, { keys: ["cost_line.7150"] }],
          },
          {
            cells: [{ text: "الملحق العلوي" }, { keys: ["cost_line.7240"] }],
          },
          {
            cells: [{ text: "الملحق الأرضي" }, { keys: ["cost_line.7210"] }],
          },
          {
            cells: [
              { text: "القبو" },
              { keys: ["cost_line.7060"] },
            ],
          },
          {
            cells: [
              { text: "إجمالي الملاحق" },
              { keys: ["inventory.7270"] },
            ],
          },
        ],
      },
    ],
  },
  {
    n: "10",
    title: "تفاصيل البناء",
    hint: "وصف الأدوار من الحصر الميداني — يظهر للمقيم ولا يُعاد إدخاله.",
    tables: [
      {
        columns: ["الدور", "الوصف والاستخدام"],
        rows: [
          { cells: [{ text: "الدور الأرضي" }, { text: "" }] },
          { cells: [{ text: "الدور الأول" }, { text: "" }] },
          { cells: [{ text: "الملحق العلوي" }, { text: "" }] },
          { cells: [{ text: "الملحق الأرضي" }, { text: "" }] },
        ],
      },
    ],
  },
  {
    n: "11",
    title: "مكونات العقار",
    fields: [
      { id: "fence", label: "سور" },
      { id: "parking", label: "مواقف", keys: ["inventory.6490"] },
      { id: "pool", label: "مسبح" },
      { id: "elevator", label: "مصعد", keys: ["inventory.5280"] },
      { id: "jacuzzi", label: "جاكوزي", keys: ["inventory.5330"] },
      { id: "annexes", label: "ملاحق", keys: ["inventory.5350"] },
      { id: "annex-upper", label: "ملحق علوي (عدد)" },
      { id: "annex-ground", label: "ملحق أرضي (عدد)" },
      { id: "bedrooms", label: "غرف النوم", keys: ["inventory.6040"] },
      { id: "halls", label: "الصالات", keys: ["pending.6090"] },
      { id: "units", label: "عدد الشقق" },
      { id: "dining", label: "غرف الطعام", keys: ["inventory.6140"] },
      { id: "majlis", label: "المجالس", keys: ["inventory.6190"] },
      { id: "maid", label: "غرف الخدم", keys: ["inventory.6240"] },
      { id: "kitchens", label: "مطابخ", keys: ["inventory.6290"] },
      { id: "guard", label: "غرفة حارس", keys: ["inventory.6390"] },
      { id: "store", label: "مستودع", keys: ["inventory.6440"] },
      { id: "baths", label: "دورات المياه", keys: ["inventory.6540"] },
      { id: "playground", label: "ملاعب أطفال", keys: ["pending.5360"] },
      { id: "showrooms", label: "عدد المعارض" },
      { id: "wells", label: "عدد الآبار" },
      { id: "towers", label: "عدد الأبراج" },
      { id: "other-comp", label: "أخرى", keys: ["inventory.6590"] },
    ],
  },
  {
    n: "12",
    title: "مستوى تشطيبات البناء",
    fields: [
      {
        id: "fin-n",
        label: "تشطيب الواجهة الشمالية",
        keys: ["finishing_facade_north"],
      },
      {
        id: "fin-e",
        label: "تشطيب الواجهة الشرقية",
        keys: ["finishing_facade_east"],
      },
      {
        id: "fin-s",
        label: "تشطيب الواجهة الجنوبية",
        keys: ["finishing_facade_south"],
      },
      {
        id: "fin-w",
        label: "تشطيب الواجهة الغربية",
        keys: ["finishing_facade_west"],
      },
    ],
    pairs: [
      {
        term: "تشطيب فاخر",
        text: "واجهات حجر طبيعي أو دهان عالي الجودة، أرضيات مداخل ومجالس من رخام فاخر، عزل ونوافذ عالية، تكييف مركزي ومصعد.",
      },
      {
        term: "تشطيب متوسط",
        text: "واجهات حجر أو دهان، أرضيات سيراميك، تكييف منفصل (سبليت)، مكونات جدران مزدوجة.",
      },
      {
        term: "تشطيب عادي",
        text: "واجهات دهان، أرضيات سيراميك عادي أو بلاط بلدي، شبابيك عادية، تكييف شباك، بدون جبس أسقف.",
      },
      { term: "بدون تشطيب", text: "عقار دون تشطيبات داخلية أو خارجية مكتملة." },
    ],
  },
  {
    n: "13",
    title: "وصف العيوب الإنشائية",
    fields: [
      {
        id: "defects",
        label: "وصف العيوب الإنشائية",
        keys: ["pending.50016", "pending.50017", "notes.9060"],
        span: 2,
      },
    ],
  },
  {
    n: "14",
    title: "الخدمات والمرافق المتوفرة بالعقار",
    tables: [
      {
        columns: ["الخدمة", "التوفر", "عدد العدادات", "أرقام العدادات"],
        rows: [
          {
            cells: [
              { text: "كهرباء" },
              { text: "" },
              { keys: ["meter.4120"] },
              { keys: ["meter.4130"] },
            ],
          },
          {
            cells: [
              { text: "ماء" },
              { text: "" },
              { keys: ["meter.4160"] },
              { keys: ["meter.4170"] },
            ],
          },
          {
            cells: [{ text: "صرف صحي" }, { text: "" }, { text: "" }, { text: "" }],
          },
          {
            cells: [
              { text: "هاتف / ألياف بصرية" },
              { text: "" },
              { text: "" },
              { text: "" },
            ],
          },
        ],
      },
    ],
  },
  {
    n: "15",
    title: "المحيط المؤثر للعقار",
    fields: [
      { id: "surr-mosque", label: "جامع" },
      { id: "surr-medical", label: "مرفق طبي" },
      { id: "surr-security", label: "مرفق أمني" },
      { id: "surr-market", label: "سوق تجاري" },
      { id: "surr-park", label: "حديقة" },
      { id: "surr-school", label: "مرفق تعليمي" },
      { id: "surr-gov", label: "مقر حكومي" },
      { id: "surr-highway", label: "طريق سريع" },
      { id: "surr-other", label: "أخرى", span: 2 },
    ],
  },
  {
    n: "16",
    title: "أسلوب وطريقة التقييم المستخدمة",
    hint: "تُحرَّر الأساليب في تبويب المقارنات.",
    fields: [
      { id: "mkt-approach", label: "أسلوب السوق", keys: ["recon.weight_market_pct"] },
      { id: "cost-approach", label: "أسلوب التكلفة", keys: ["recon.weight_cost_pct"] },
      { id: "inc-approach", label: "أسلوب الدخل", keys: ["recon.weight_income_pct"] },
    ],
  },
  {
    n: "17",
    title: "العقارات المقارنة",
    hint: "تُختار وتُحرَّر في تبويب المقارنات.",
    tables: [
      {
        columns: [
          "#",
          "العقار المقارن",
          "المساحة",
          "تاريخ العملية",
          "السعر",
          "سعر المتر",
        ],
        rows: [
          {
            cells: [
              { text: "1" },
              { keys: ["comp1.property_type"] },
              { keys: ["comp1.area_sqm"] },
              { keys: ["comp1.transaction_date"] },
              { keys: ["comp1.price"] },
              { keys: ["comp1.price_per_sqm"] },
            ],
          },
          {
            cells: [
              { text: "2" },
              { keys: ["comp2.property_type"] },
              { keys: ["comp2.area_sqm"] },
              { keys: ["comp2.transaction_date"] },
              { keys: ["comp2.price"] },
              { keys: ["comp2.price_per_sqm"] },
            ],
          },
          {
            cells: [
              { text: "3" },
              { keys: ["comp3.property_type"] },
              { keys: ["comp3.area_sqm"] },
              { keys: ["comp3.transaction_date"] },
              { keys: ["comp3.price"] },
              { keys: ["comp3.price_per_sqm"] },
            ],
          },
        ],
      },
    ],
  },
  {
    n: "18",
    title: "خريطة مواقع المقارنات",
    fields: [
      {
        id: "map-comps",
        label: "خريطة مواقع المقارنات",
        keys: ["attachment.aerial_hybrid_comps"],
        span: 2,
      },
    ],
  },
  {
    n: "19",
    title: "جدول التسويات",
    hint: "تُحسب من بنك المقارنات — تظهر هنا كما ستُطبع.",
    tables: [
      {
        columns: ["عناصر المقارنة", "المقارن (1)", "المقارن (2)", "المقارن (3)"],
        rows: [
          {
            cells: [
              { text: "وصف العقار المقارن" },
              { keys: ["comp1.property_type"] },
              { keys: ["comp2.property_type"] },
              { keys: ["comp3.property_type"] },
            ],
          },
          {
            cells: [
              { text: "قيمة العقارات المقارنة" },
              { keys: ["comp1.price"] },
              { keys: ["comp2.price"] },
              { keys: ["comp3.price"] },
            ],
          },
          {
            cells: [
              { text: "تسوية عامل الوقت" },
              { keys: ["adj.60101"] },
              { keys: ["adj.60103"] },
              { keys: ["adj.60105"] },
            ],
          },
          {
            cells: [
              { text: "تسوية شروط التمويل" },
              { keys: ["adj.60107"] },
              { keys: ["adj.60109"] },
              { keys: ["adj.60111"] },
            ],
          },
          {
            cells: [
              { text: "تسوية ظروف السوق" },
              { keys: ["adj.60113"] },
              { keys: ["adj.60115"] },
              { keys: ["adj.60117"] },
            ],
          },
          {
            cells: [
              { text: "إجمالي تسويات التمويل والسوق ٪" },
              { keys: ["adj.60119"] },
              { keys: ["adj.60121"] },
              { keys: ["adj.60123"] },
            ],
          },
          {
            cells: [
              { text: "سعر البيع بعد تسوية التمويل والسوق" },
              { keys: ["adj.60131"] },
              { keys: ["adj.60133"] },
              { keys: ["adj.60135"] },
            ],
          },
          {
            cells: [
              { text: "تسوية المساحة" },
              { keys: ["adj.40006"] },
              { keys: ["adj.40007"] },
              { keys: ["adj.40008"] },
            ],
          },
          {
            cells: [
              { text: "الموقع العام" },
              { keys: ["adj.40012"] },
              { keys: ["adj.40013"] },
              { keys: ["adj.40014"] },
            ],
          },
          {
            cells: [
              { text: "عدد الشوارع" },
              { keys: ["adj.40018"] },
              { keys: ["adj.40019"] },
              { keys: ["adj.40020"] },
            ],
          },
          {
            cells: [
              { text: "عدد الأدوار" },
              { keys: ["adj.40042"] },
              { keys: ["adj.40043"] },
              { keys: ["adj.40044"] },
            ],
          },
          {
            cells: [
              { text: "مجموع نسب التسويات (٪)" },
              { keys: ["adj.40049"] },
              { keys: ["adj.40051"] },
              { keys: ["adj.40053"] },
            ],
          },
          {
            cells: [
              { text: "سعر متر الأرض بعد التسويات" },
              { keys: ["adj.40061"] },
              { keys: ["adj.40063"] },
              { keys: ["adj.40065"] },
            ],
          },
          {
            cells: [
              { text: "الأوزان النسبية" },
              { keys: ["adj.60188"] },
              { keys: ["adj.60190"] },
              { keys: ["adj.60192"] },
            ],
          },
        ],
      },
    ],
  },
  {
    n: "20",
    title: "قيمة الأرض (أسلوب التكلفة)",
    hint: "تُحرَّر في تبويب المقارنات.",
    fields: [
      {
        id: "land-sqm-price",
        label: "سعر المتر المستورد من طريقة المقارنة",
        keys: ["comp1.price_per_sqm"],
      },
      { id: "land-value", label: "قيمة الأرض", keys: ["cost.land_value_from_market"] },
    ],
  },
  {
    n: "21",
    title: "بنود التكلفة المباشرة",
    tables: [
      {
        columns: ["البند", "المسطح / الكمية (م²)", "سعر المتر (ر.س.)", "الإجمالي (ر.س.)"],
        rows: [
          {
            cells: [
              { text: "مسطح الدور الأرضي" },
              { keys: ["cost_line.7090"] },
              { keys: ["cost_line.7100"] },
              { keys: ["cost_line.7110"] },
            ],
          },
          {
            cells: [
              { text: "مسطح الدور الأول" },
              { keys: ["cost_line.7150"] },
              { keys: ["cost_line.7160"] },
              { keys: ["cost_line.7170"] },
            ],
          },
          {
            cells: [
              { text: "مسطح الملحق العلوي" },
              { keys: ["cost_line.7240"] },
              { keys: ["cost_line.7250"] },
              { keys: ["cost_line.7260"] },
            ],
          },
          {
            cells: [
              { text: "القبو" },
              { keys: ["cost_line.7060"] },
              { keys: ["cost_line.7070"] },
              { keys: ["cost_line.7080"] },
            ],
          },
          {
            cells: [
              { text: "الأسوار" },
              { keys: ["cost_line.7300"] },
              { keys: ["cost_line.7310"] },
              { keys: ["cost_line.7320"] },
            ],
          },
          {
            cells: [
              { text: "المسبح" },
              { keys: ["cost_line.7330"] },
              { keys: ["cost_line.7340"] },
              { keys: ["cost_line.7350"] },
            ],
          },
          {
            cells: [
              { text: "مواقف سيارات" },
              { keys: ["cost_line.7390"] },
              { keys: ["cost_line.7400"] },
              { keys: ["cost_line.7410"] },
            ],
          },
          {
            cells: [
              { text: "أخرى" },
              { keys: ["cost_line.7420"] },
              { keys: ["cost_line.7430"] },
              { keys: ["cost_line.7440"] },
            ],
          },
          {
            cells: [
              { text: "مجموع التكلفة المباشرة" },
              { text: "" },
              { text: "" },
              { keys: ["cost.building_direct"] },
            ],
          },
        ],
      },
    ],
  },
  {
    n: "22",
    title: "التكاليف غير المباشرة",
    fields: [
      { id: "profit", label: "قيمة هامش الربح", keys: ["cost.profit_margin"] },
      {
        id: "cost-with-land",
        label: "تكلفة المبنى والأرض",
        keys: ["cost.opinion_with_land"],
      },
    ],
  },
  {
    n: "23",
    title: "العمر والإهلاك وناتج أسلوب التكلفة",
    fields: [
      { id: "actual-age", label: "العمر الفعلي", keys: ["property_age_years"] },
      { id: "econ-life", label: "العمر الاقتصادي", keys: ["cost.economic_life"] },
      { id: "dep-pct", label: "نسبة الإهلاك / مجموع التقادم", keys: ["cost.depreciation_pct"] },
      { id: "dep-val", label: "قيمة الإهلاك", keys: ["cost.depreciation_value"] },
      {
        id: "after-dep",
        label: "قيمة المباني بعد الإهلاك",
        keys: ["cost.after_depreciation"],
      },
      { id: "cost-land", label: "قيمة الأرض", keys: ["cost.land_value_from_market"] },
      {
        id: "cost-opinion",
        label: "ناتج أسلوب التكلفة (الأرض + المباني)",
        keys: ["cost.market_value"],
        span: 2,
      },
    ],
  },
  {
    n: "24",
    title: "ترجيح أساليب التقييم",
    tables: [
      {
        columns: ["الأسلوب", "نسبة المشاركة", "القيمة بعد المشاركة"],
        rows: [
          {
            cells: [
              { text: "أسلوب السوق — طريقة المقارنة" },
              { keys: ["recon.weight_market_pct"] },
              { keys: ["recon.contrib_market"] },
            ],
          },
          {
            cells: [
              { text: "أسلوب التكلفة — طريقة التكلفة (الإحلال)" },
              { keys: ["recon.weight_cost_pct"] },
              { keys: ["recon.contrib_cost"] },
            ],
          },
          {
            cells: [
              { text: "أسلوب الدخل" },
              { keys: ["recon.weight_income_pct"] },
              { keys: ["recon.contrib_income"] },
            ],
          },
        ],
      },
    ],
    fields: [
      {
        id: "methods-rationale",
        label: "مبرر استخدام طرق التقييم",
        span: 2,
      },
    ],
  },
  {
    n: "25",
    title: "القيمة النهائية للعقار",
    fields: [
      {
        id: "weighted",
        label: "القيمة المرجّحة",
        keys: ["final.opinion_before_liquidation"],
      },
      {
        id: "liq-pct",
        label: "نسبة خصم التصفية المنظمة",
        keys: ["final.liquidation_discount_pct"],
      },
      {
        id: "final-value",
        label: "قيمة العقار",
        keys: ["final.opinion_value"],
        span: 2,
      },
      {
        id: "tafqit",
        label: "القيمة النهائية تفقيطًا",
        keys: ["final.opinion_tafqit"],
        span: 2,
      },
    ],
  },
  {
    n: "26",
    title: "المشاركون في إعداد التقرير",
    hint: "تُحرَّر أسماء العاملين في بيانات الرفع لإنفاذ.",
    fields: [
      { id: "worker-1", label: "المعد / المشارك 1", span: 2 },
      { id: "worker-2", label: "المراجع / المشارك 2", span: 2 },
      { id: "worker-3", label: "المشارك 3", span: 2 },
    ],
  },
  {
    n: "27",
    title: "اعتماد تقرير التقييم",
    fields: [
      { id: "approve-name", label: "الاسم", keys: ["valuer.name_ar"] },
      {
        id: "approve-membership",
        label: "رقم العضوية",
        keys: ["valuer.membership_number"],
        ltr: true,
      },
      { id: "approve-branch", label: "فرع التقييم" },
      { id: "approve-class", label: "فئة العضوية" },
      { id: "approve-role", label: "صفته" },
      { id: "approve-expiry", label: "تاريخ انتهاء العضوية" },
      { id: "approve-sign", label: "التوقيع", keys: ["valuer.signature", "org.signature"] },
      { id: "approve-stamp", label: "ختم المنشأة", keys: ["org.stamp"] },
    ],
  },
  {
    n: "28",
    title: "نطاق البحث وطبيعة ومصدر المعلومات",
    bullets: [
      "المستندات المستلمة من قبل العميل.",
      "الوقوف المباشر على العقار ومعاينته ودراسة خصائصه.",
      "مؤشرات العرض والطلب في منطقة العقار، والبحث والاستقصاء عن أسعار العروض العقارية والمبيعات والصفقات المنفذة في منطقة العقار.",
      "دراسة منطقة العقار ومدى توفر خدمات البنية التحتية والفوقية، واكتمال العمران في المنطقة المحيطة وأنظمة البناء.",
      "تحليل مؤشرات الصفقات العقارية من المصادر الموثوقة مثل مؤشر وزارة العدل.",
      "المكاتب العقارية المتواجدة في محيط منطقة العقار.",
      "قاعدة البيانات الداخلية وسجلات عمليات التقييم الداخلية للشركة.",
      "الهيئة العامة للإحصاء فيما يخص دراسة السوق في المنطقة وفي المملكة بشكل عام.",
      "الاسترشاد بالأدلة الاسترشادية والمناهج والإصدارات الصادرة عن الهيئة السعودية للمقيمين المعتمدين.",
    ],
    fields: [
      { id: "search-notes", label: "ملاحظات نطاق البحث (إن وُجدت)", span: 2 },
    ],
  },
  {
    n: "29",
    title: "الافتراضات الخاصة",
    bullets: [
      "تؤخذ العوامل البيئية والاجتماعية وعوامل الحوكمة (ESG) في الاعتبار عند تقييم العقار، ويُشار إليها في التقرير متى ثبت تأثيرها على القيمة التقديرية أثناء تنفيذ مهمة التقييم.",
      "تمت معاينة العقار ظاهريًا، ولم يتم فحص العقار إنشائيًا، وعليه يجب أن يُفهم أن هذا تقرير تقييم وليس فحصًا إنشائيًا، وتم الاكتفاء بذكر الملاحظات الظاهرة والتي تؤثر في قيمة العقار.",
      "يفترض أن العقار مطلق الملكية وليس عليه أي نزاعات ملكية أو ورثة او قيود على البيع والتملك أو أي خطط لنزع ملكية العقار أو إجراءات تؤثر بالحق العقاري وفي حال تبين عكس ذلك يلزم إعادة النظر في القيمة.",
      "لم يستعن المقيّم بأي أخصائي أو مؤسسة خدمات أثناء تنفيذ مهمة التقييم، وجميع الإجراءات والتحليلات اللازمة نُفّذت بواسطة فريق العمل بإدارة التقييم.",
      "تم افتراض نوع استخدام الأرض حسب الاستخدام في المستكشف الإلكتروني.",
      "تم افتراض بأن قطعة الأرض ليست زائدة تنظيمية.",
      "تم افتراض عدم وجود نزع على قطعة الأرض في تاريخ التقييم.",
      "تم افتراض عدم وجود إيقاف على تراخيص البناء على العقار المراد تقييمه.",
    ],
  },
  {
    n: "30",
    title: "العوامل البيئية والاجتماعية والحوكمة (ESG)",
    fields: [
      { id: "esg-energy", label: "كفاءة الطاقة", span: 2 },
      { id: "esg-climate", label: "أخطار الموقع والمناخ", span: 2 },
      { id: "esg-green", label: "المباني الخضراء", span: 2 },
      { id: "esg-design", label: "جودة التصاميم ورفاهية المسكن", span: 2 },
      { id: "esg-community", label: "الإسهام المجتمعي للعقار", span: 2 },
      { id: "esg-services", label: "الخدمات المتوفرة في الموقع", span: 2 },
      { id: "esg-compliance", label: "الامتثال التنظيمي", span: 2 },
      { id: "esg-data", label: "الإدارة الفعالة لبيانات العقار", span: 2 },
      { id: "esg-ops", label: "مقومات تشغيل العقار", span: 2 },
    ],
  },
  {
    n: "31",
    title: "الشروط والأحكام وإخلاء المسؤولية",
    bullets: [
      "اعتمد المقيم على صحة وسلامة صكوك الملكية والمستندات القانونية المقدمة من العميل دون التحقق من أصولها لدى الجهات المختصة، ويفترض التقرير خلو العقار من أي التزامات او عوائق قانونية لم يتم الإفصاح عنها.",
      "يقتصر دور المقيم على المعاينة البصرية الظاهرية للموقع، لذا فإن المقيم والشركة يخليان مسؤوليتهما عن أي عيوب إنشائية خفية، أو أعطال في الأنظمة الميكانيكية والكهربائية، أو وجود مواد خطرة ومضرة بالبيئة لا يمكن كشفها إلا بالفحص الهندسي المتخصص.",
      "لا يغطي هذا التقييم أي دراسات تتعلق بتربة الأرض أو خصائصها الجيولوجية والزلازل، ولا يتحمل المقيم مسؤولية أي أضرار ناتجة عن طبيعة الأرض ما لم تكن ظاهرة ومؤثرة وقت المعاينة.",
      "أُعد هذا التقرير لخدمة العميل والمستخدمين المقصودين فقط وللغرض المذكور في متنه، ولا يتحمل المقيم أي مسؤولية تجاه أي طرف ثالث يعتمد على التقرير دون موافقة خطية مسبقة من الشركة.",
      "يُمنع منعًا باتًا نشر، أو تداول، أو إعادة إصدار التقرير، أو أي جزء منه في المراسلات، أو المطبوعات، أو الوسائط الإلكترونية دون إذن كتابي صريح من شركة إجادة المهنية للتقييم.",
      "لا يلزم هذا التقرير المقيم أو الشركة بالمثول أمام الجهات القضائية أو تقديم شهادة رسمية بخصوص محتواه، ما لم يتم الاتفاق على ذلك مسبقًا وبترتيبات تعاقدية منفصلة.",
      "تعتبر القيمة التقديرية مرتبطة بظروف السوق وقت المعاينة، وهي صالحة لمدة (90) يومًا فقط من تاريخ التقرير، وأي تغير في ظروف السوق أو الاستخدام الحالي للعقار قد يؤدي إلى بطلان هذا التقدير.",
      "تم إعداد هذا التقرير وفق معايير التقييم الدولية (IVS) وبحياد تام، دون وجود أي مصالح مشتركة أو مكاسب شخصية للمقيم في العقار محل الدراسة.",
      "لا يعتبر هذا التقرير مستندًا نظاميًا مكتملًا إلا إذا تم اعتماده بختم الشركة الرسمي وتوقيع المقيم المعتمد.",
      "تُعد القيمة الواردة في هذا التقرير قيمة تقديرية وفق أساس القيمة المحدد في نطاق العمل.",
    ],
  },
  {
    n: "32",
    title: "القيود على الاستخدام والنشر",
    bullets: [
      "أُعد هذا التقرير حصريًا للغرض المحدد فيه، ولا يجوز استخدامه أو الاقتباس منه أو الإشارة إليه لأي غرض آخر غير الذي صُدر من أجله.",
      "يُصنف هذا التقرير كوثيقة سرية للغاية، وهو مخصص لاستخدام العميل والمستخدمين المقصودين المسمَّين بالتقرير فقط، ولا يجوز تقديمه لأي طرف ثالث دون موافقة خطية صريحة ومسبقة من الشركة.",
      "تحتفظ الشركة والمقيم بكافة حقوق الملكية الفكرية الخاصة بالتقرير؛ لذا يمنع منعًا باتًا إعادة إصدار التقرير أو نشر أي جزء منه في أي مراسلات أو مطبوعات أو وسائط إعلامية دون إذن خطي مسبق.",
      "لا تتحمل الشركة أو المقيم أي مسؤولية قانونية أو مالية عن أي خسائر قد تنجم عن سوء استخدام التقرير، أو الاعتماد عليه من قبل أطراف غير مصرح لها، أو استخدامه في غير سياقه الموضح.",
      "يُعد هذا التقرير وحدة فنية متكاملة وغير قابلة للتجزئة، ويُحظر استخدامه جزئيًا أو الاقتباس منه بشكلٍ منفصل عن سياقه الكلي وفرضياته الواردة فيه.",
    ],
  },
  {
    n: "33",
    title: "خريطة الأقمار الصناعية وخريطة الموقع العام",
    fields: [
      {
        id: "sat-a",
        label: "الصورة الجوية ستالايت",
        keys: ["attachment.aerial_sat_a", "attachment.aerial_sat_b"],
      },
      {
        id: "hybrid-a",
        label: "الصور الجوية هايبرد",
        keys: ["attachment.aerial_hybrid_a"],
      },
      {
        id: "map-coords",
        label: "إحداثيات الموقع",
        keys: ["geo_latitude", "geo_longitude"],
        compose: "coords",
        ltr: true,
        span: 2,
      },
    ],
  },
  {
    n: "34",
    title: "صور العقار",
    fields: Array.from({ length: 12 }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return {
        id: `photo-${n}`,
        label: `صورة العقار ${n}`,
        keys: [`photo.${n}`],
      };
    }),
  },
  {
    n: "35",
    title: "التقرير المساحي",
    fields: [
      { id: "survey-doc", label: "التقرير المساحي", keys: ["document.01"], span: 2 },
    ],
  },
  {
    n: "36",
    title: "صك الملكية",
    fields: [
      { id: "deed-doc", label: "صك الملكية", keys: ["document.02"], span: 2 },
    ],
  },
  {
    n: "37",
    title: "معايير التقييم الدولية العامة",
    pairs: [
      {
        term: "المعيار 100 – إطار التقييم",
        text: "الأساس الذي تُبنى عليه كل عملية تقييم؛ ينطبق على الأصول والالتزامات كافة وتتفرع عنه معايير الأصول بمتطلباتها الخاصة، ويقتضي الامتثالُ الالتزامَ بها جميعًا مع ملاحقها.",
      },
      {
        term: "المعيار 101 – نطاق العمل",
        text: "يعنى بالاتفاق الجوهري بين المقيّم والعميل الذي يحدد شروط التعاقد والالتزامات والحد الأدنى من المتطلبات اللازمة لإنجاز عملية التقييم بما يتناسب مع الاستخدام المقصود.",
      },
      {
        term: "المعيار 102 – أسس القيمة",
        text: "يوجب على المقيّم اختيار أساس القيمة الملائم للغرض والاستخدام المقصود، والتقيد بكل المتطلبات المرتبطة بالأساس المختار.",
      },
      {
        term: "المعيار 103 – أساليب التقييم",
        text: "يوجب دراسة أساليب التقييم الثلاثة (السوق، الدخل، التكلفة) وطرقها، واختيار الأنسب منها — أو الجمع بين أكثر من أسلوب — بما يلائم الأصل محل التقييم واستخدامه المقصود.",
      },
      {
        term: "المعيار 104 – البيانات والمدخلات",
        text: "يُعنى باختيار بيانات التقييم ومدخلاته وتوثيقها، ويجعل الغاية بلوغ أقصى استخدام ممكن للبيانات الملحوظة ذات الصلة.",
      },
      {
        term: "المعيار 105 – نماذج التقييم",
        text: "يُعنى باختيار نماذج التقييم وكيفية استخدامها وتوثيقها، ويقرر أن النموذج لا يُنتج وحده تقييمًا ممتثلًا ما لم يُعمل المقيّم فيه حكمه المهني.",
      },
      {
        term: "المعيار 106 – التوثيق وإعداد التقارير",
        text: "يفرض إعداد تقارير نهائية تعكس مخرجات التقييم بوضوح، مع إلزامية توثيق كافة الأدلة وسجلات العمل لضمان الشفافية وقابلية المراجعة المهنية.",
      },
    ],
  },
  {
    n: "38",
    title: "مصطلحات مهنية",
    pairs: [
      { term: "المنشأة", text: "المؤسسة أو الشركة التي تصدر التقرير وينتسب لها المقيم أو يتعاقد معها." },
      { term: "المقيم", text: "فرد أو مجموعة يملكون المؤهلات والقدرة والخبرة اللازمة لتنفيذ التقييم بموضوعية وحياد ونزاهة وكفاءة." },
      { term: "المقيم المعتمد", text: "شخص طبيعي أو اعتباري مرخص له مزاولة المهنة وفقا لأحكام نظام المقيمين المعتمدين." },
      { term: "العميل", text: "الشخص الذي يُعين المُقيّم لإجراء عملية تقييم معينة." },
      { term: "نطاق العمل", text: "الشروط الأساسية للتقييم، وتشمل الأصل محل التقييم والاستخدام المقصود ومسؤوليات الأطراف." },
      { term: "الغرض من التقييم", text: "سبب أو أسباب إجراء التقييم." },
      { term: "أساس القيمة", text: "المبادئ الأساسية التي تعتمد عليها القيم المُقرّرة (المعيار 102)." },
      { term: "قيمة التصفية", text: "المبلغ الإجمالي الذي يمكن تحقيقه عند بيع أصل بموجب بيع التصفية، منظمة أو إجبارية." },
      { term: "مستخدم التقرير", text: "الشخص أو الأشخاص المخولين لاستخدام تقرير التقييم، وللغرض المحدد فقط." },
      { term: "أسلوب السوق", text: "مؤشر قيمة بمقارنة الأصل مع أصول مطابقة أو مشابهة تتوفر عنها معلومات سعرية." },
      { term: "أسلوب التكلفة", text: "مؤشر قيمة بحساب تكلفة إحلال أو إعادة إنتاج الأصل بعد خصم جميع أشكال التقادم." },
      { term: "تكلفة الإحلال المهلكة (DRC)", text: "التكلفة الحالية لاستبدال الأصل بأصل مكافئ حديث مطروحًا منها استقطاعات التقادم." },
      { term: "أسلوب الدخل", text: "مؤشر قيمة بتحويل التدفقات المالية المستقبلية أو الدخل إلى قيمة رأسمالية حالية." },
      { term: "الافتراضات الخاصة", text: "حقائق مفترضة تختلف عن الحقائق الموجودة في تاريخ التقييم لتوضيح أثر التغيرات المحتملة على القيمة." },
      { term: "الترجيح", text: "مقدار الاعتماد على مؤشر قيمة معين للتوصل إلى استنتاج بخصوص القيمة." },
      { term: "العوامل البيئية والاجتماعية والحوكمة (ESG)", text: "إطار تقييم تأثير الاستدامة والممارسات الأخلاقية على الأصل أو الالتزام." },
    ],
  },
];

export function catalogKeysUsedInReportTab(): string[] {
  const keys = new Set<string>();
  for (const section of VALUATION_REPORT_TAB_SECTIONS) {
    for (const field of section.fields ?? []) {
      for (const key of field.keys ?? []) keys.add(key);
    }
    for (const table of section.tables ?? []) {
      for (const row of table.rows) {
        for (const cell of row.cells) {
          for (const key of cell.keys ?? []) keys.add(key);
        }
      }
    }
  }
  return [...keys];
}

export function firstFilledValue(
  keys: readonly string[] | undefined,
  values: Record<string, string>,
  compose?: ReportTabField["compose"],
): string {
  if (!keys?.length) return "";
  const parts = keys
    .map((key) => (values[key] ?? "").trim())
    .filter(Boolean);
  if (!parts.length) return "";
  if (compose === "coords") return parts.join(", ");
  if (compose === "license") return parts.join(" · ");
  return parts[0] ?? "";
}

export type ReportTabLayer = "settings" | "intake" | "appraiser";

const SETTINGS_SECTION_NS = new Set([
  "01",
  "03",
  "04",
  "05",
  "27",
  "28",
  "31",
  "32",
  "37",
  "38",
]);

export function layerForSection(n: string): ReportTabLayer {
  if (SETTINGS_SECTION_NS.has(n)) return "settings";
  const k = Number(n);
  if ((k >= 6 && k <= 15) || (k >= 33 && k <= 36)) return "intake";
  return "appraiser";
}
