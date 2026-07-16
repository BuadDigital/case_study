export type PropertyFieldCatalogEntry = {
  key: string;
  label: string;
};

export type PropertyFieldCatalogGroup = {
  id: string;
  /** الدور صاحب المصدر */
  sourceRole: string;
  /** الشاشة أو النموذج */
  screen: string;
  fields: PropertyFieldCatalogEntry[];
};

const poIntakeFields: PropertyFieldCatalogEntry[] = [
  { key: "id", label: "معرّف العقار (داخلي)" },
  { key: "identifierType", label: "مصدر البيانات" },
  { key: "deedNumber", label: "رقم الصك / رقم التسجيل العيني" },
  { key: "assignmentMandateNumber", label: "رقم التكليف" },
  { key: "assignmentMandateDate", label: "تاريخ التكليف" },
  { key: "requestNumber", label: "رقم الطلب" },
  { key: "planNumber", label: "رقم المخطط" },
  { key: "plotNumber", label: "رقم القطعة" },
  { key: "locationMapUrl", label: "رابط موقع الخريطة" },
  { key: "deedDate", label: "تاريخ الصك" },
  { key: "ownerName", label: "اسم المالك" },
  { key: "court", label: "المحكمة" },
  { key: "circuit", label: "الدائرة" },
  { key: "delegationLetterFileNames", label: "خطاب التفويض" },
  { key: "realEstateRegFileName", label: "السجل العقاري (مرفق)" },
  { key: "assignmentDocFileNames", label: "قرار الإسناد" },
  { key: "otherDocumentFileNames", label: "مستندات أخرى" },
  { key: "contactName", label: "ضابط الاتصال — الاسم" },
  { key: "contactRole", label: "ضابط الاتصال — الصفة" },
  { key: "contactPhone", label: "ضابط الاتصال — الجوال" },
  { key: "contacts", label: "ضباط الاتصال (قائمة)" },
];

const bourseFields: PropertyFieldCatalogEntry[] = [
  { key: "city", label: "المدينة" },
  { key: "district", label: "الحي" },
  { key: "classification", label: "التصنيف" },
  { key: "propertyType", label: "نوع العقار" },
  { key: "area", label: "المساحة" },
  { key: "deedStatus", label: "حالة الصك" },
  { key: "restrictionsPresent", label: "القيود على العقار" },
  { key: "boundariesAvailability", label: "توفر الحدود" },
  { key: "boundariesExternalDocName", label: "المستند الخارجي للحدود" },
  { key: "bourseDataCompleted", label: "اكتمال بيانات البورصة" },
];

const bourseObstructionFields: PropertyFieldCatalogEntry[] = [
  { key: "deedVitality", label: "فعالية الصك (البورصة)" },
  { key: "obstructionReason", label: "سبب التعذر — استعلام البورصة" },
];

const propertyDetailFields: PropertyFieldCatalogEntry[] = [
  { key: "workflowSurvey", label: "مرحلة الرفع المساحي" },
  { key: "workflowValuation", label: "مرحلة التقييم" },
  { key: "workflowStudy", label: "مرحلة دراسة الحالة" },
  { key: "propertyRowStatus", label: "حالة العقار في الجدول" },
  { key: "appraisalPrice", label: "سعر التقييم" },
  { key: "appraisalSummaryDate", label: "تاريخ التقييم (ملخص)" },
  { key: "appraisalEntity", label: "جهة التقييم" },
  { key: "appraiserNotes", label: "ملاحظات المقيّم (ملخص)" },
  { key: "certificateNumber", label: "رقم الشهادة" },
  { key: "reportStatus", label: "حالة التقرير" },
];

/** حقول عرض فقط — تبويب البيانات الأساسية (تفاصيل العقار). */
const propertyDetailBasicDisplayFields: PropertyFieldCatalogEntry[] = [
  { key: "ownershipStatus", label: "حالة الملك" },
  { key: "coordinatesDisplay", label: "الإحداثيات" },
  { key: "dimensionsDisplay", label: "الأطوال والأبعاد" },
  { key: "landFacadesDisplay", label: "واجهات الأرض" },
  { key: "plotPlanNumberDisplay", label: "رقم القطعة / المخطط" },
  { key: "contactPartyDisplay", label: "جهة الاتصال" },
  { key: "contactPhoneDisplay", label: "رقم الجوال" },
  { key: "bourseDeedStatusDisplay", label: "حالة الصك في البورصة" },
  { key: "bourseDiffNotesDisplay", label: "الفروق / الملاحظات" },
  { key: "bourseLastUpdateDisplay", label: "تاريخ آخر تحديث (البورصة)" },
];

/** شريط ملخص العقار (رأس الصفحة). */
const propertyDetailHeroFields: PropertyFieldCatalogEntry[] = [
  { key: "propertyIndex", label: "ترتيب العقار في أمر العمل" },
  { key: "assignmentType", label: "نوع الإسناد" },
  { key: "dueDateAt", label: "تاريخ الاستحقاق" },
];

const inspectorCoreFields: PropertyFieldCatalogEntry[] = [
  { key: "propertyDisplayId", label: "رقم العقار" },
  { key: "propertyType", label: "نوع العقار" },
  { key: "areaDistrict", label: "المنطقة / الحي" },
  { key: "actualAreaSqm", label: "المساحة الفعلية (م²)" },
  { key: "structuralCondition", label: "الحالة الإنشائية" },
  { key: "hasMovableItems", label: "هل يوجد منقولات داخل العقار؟" },
  { key: "isCurrentlyRented", label: "هل العقار مؤجر حالياً؟" },
  { key: "accessDifficulty", label: "إمكانية الوصول للعقار" },
  { key: "avgPricePerSqm", label: "متوسط سعر المتر (ر.س)" },
  { key: "marketActivityLevel", label: "مستوى النشاط السوقي" },
  { key: "marketNotes", label: "ملاحظات السوق" },
  { key: "responsiblePersonName", label: "اسم الموقّع" },
  { key: "responsiblePersonRole", label: "صفة الموقّع" },
  { key: "signedDocumentPhotos", label: "صور المستندات الموقعة" },
  { key: "photoMainFacade", label: "صورة — واجهة رئيسية" },
  { key: "photoEntrance", label: "صورة — المدخل" },
  { key: "photoInterior", label: "صورة — الداخل" },
  { key: "photoSurroundings", label: "صورة — المحيط" },
  { key: "generalNotes", label: "ملاحظات عامة" },
];

const inspectorInfathFields: PropertyFieldCatalogEntry[] = [
  { key: "inspectionDate", label: "تاريخ المعاينة" },
  { key: "facade", label: "الواجهة" },
  { key: "streetWidth", label: "عرض الشارع (م)" },
  { key: "builtArea", label: "مساحة البناء (م²)" },
  { key: "propertyUsage", label: "استخدام العقار" },
  { key: "streetName", label: "اسم الشارع" },
  { key: "mainStreet", label: "اسم أقرب شارع رئيسي" },
  { key: "mapCoords", label: "الموقع على الخارطة (إحداثيات)" },
  { key: "roomCount", label: "عدد الغرف" },
  { key: "hallCount", label: "عدد الصالات" },
  { key: "unitCount", label: "عدد الشقق" },
  { key: "bathroomCount", label: "عدد دورات المياه" },
  { key: "propertyAge", label: "عمر العقار (سنة)" },
  { key: "showroomCount", label: "عدد المعارض" },
  { key: "towerCount", label: "عدد الأبراج" },
  { key: "wellCount", label: "عدد الآبار" },
  { key: "kitchen", label: "مطبخ" },
  { key: "carEntrance", label: "مدخل السيارة" },
  { key: "hasBasement", label: "يوجد قبو" },
  { key: "hasElevator", label: "يوجد مصعد" },
  { key: "hasPool", label: "يوجد مسبح" },
  { key: "buildState", label: "حالة البناء" },
  { key: "occupancyState", label: "حالة الإشغال" },
  { key: "districtState", label: "حالة الحي" },
  { key: "movables", label: "يوجد منقولات" },
  { key: "services", label: "الخدمات المتوفرة" },
  { key: "amenities", label: "المرافق المحيطة" },
  { key: "propertyDescription", label: "وصف العقار" },
  { key: "districtProsCons", label: "الإيجابيات والعيوب الظاهرة على الحي" },
  { key: "accessRoute", label: "طريقة الوصول للعقار" },
  { key: "assetNotes", label: "ملاحظات على الأصل" },
  { key: "buildingFloors", label: "عدد أدوار المباني" },
  { key: "basementTotal", label: "إجمالي مساحة القبو (م²)" },
  { key: "annexTotal", label: "إجمالي مساحة اللاحق (م²)" },
  { key: "buildingsTotal", label: "إجمالي مساحة المباني (م²)" },
  { key: "exteriorPhotos", label: "صور الأصل من الخارج (PDF مجمّع)" },
  { key: "interiorPhotos", label: "صور الأصل من الداخل (PDF مجمّع)" },
  { key: "siteLocation", label: "موقع الأصل" },
];

/** مفاتيح نموذج المعاينة (طبقة التخزين — تُربط بحقول إنفاذ أعلاه). */
const inspectorFormKeyFields: PropertyFieldCatalogEntry[] = [
  { key: "streetWidthM", label: "عرض الشارع (م) — مفتاح النموذج" },
  { key: "builtAreaSqm", label: "مساحة البناء (م²) — مفتاح النموذج" },
  { key: "mainStreetName", label: "اسم أقرب شارع رئيسي — مفتاح النموذج" },
  { key: "mapLatitude", label: "خط العرض — مفتاح النموذج" },
  { key: "mapLongitude", label: "خط الطول — مفتاح النموذج" },
  { key: "propertyAgeYears", label: "عمر العقار (سنة) — مفتاح النموذج" },
  { key: "hasKitchen", label: "مطبخ — مفتاح النموذج" },
  { key: "hasCarEntrance", label: "مدخل السيارة — مفتاح النموذج" },
  { key: "availableServices", label: "الخدمات المتوفرة — مفتاح النموذج" },
  { key: "surroundingAmenities", label: "المرافق المحيطة — مفتاح النموذج" },
  { key: "accessRouteDescription", label: "طريقة الوصول — مفتاح النموذج" },
  { key: "basementTotalSqm", label: "مساحة القبو — مفتاح النموذج" },
  { key: "annexTotalSqm", label: "مساحة اللاحق — مفتاح النموذج" },
  { key: "buildingsTotalSqm", label: "مساحة المباني — مفتاح النموذج" },
  { key: "exteriorPhotosPdf", label: "صور خارجية PDF — مفتاح النموذج" },
  { key: "interiorPhotosPdf", label: "صور داخلية PDF — مفتاح النموذج" },
];

const engineeringCoreFields: PropertyFieldCatalogEntry[] = [
  { key: "latitude", label: "خط العرض (موقع المسح)" },
  { key: "longitude", label: "خط الطول (موقع المسح)" },
  { key: "surveyReportFileName", label: "تقرير الرفع المساحي" },
  { key: "siteLetterFileName", label: "خطاب إقرار صحة الموقع" },
  { key: "returnNote", label: "ملاحظة الإرجاع" },
];

const engineeringInfathFields: PropertyFieldCatalogEntry[] = [
  { key: "onSiteArea", label: "المساحة على الطبيعة (م²)" },
  { key: "northBoundary", label: "الحد الشمالي" },
  { key: "northLength", label: "طول الحد الشمالي التقريبي (م)" },
  { key: "southBoundary", label: "الحد الجنوبي" },
  { key: "southLength", label: "طول الحد الجنوبي التقريبي (م)" },
  { key: "eastBoundary", label: "الحد الشرقي" },
  { key: "eastLength", label: "طول الحد الشرقي التقريبي (م)" },
  { key: "westBoundary", label: "الحد الغربي" },
  { key: "westLength", label: "طول الحد الغربي التقريبي (م)" },
  { key: "surveyNotes", label: "ملاحظات الرفع المساحي" },
  { key: "surveyFile", label: "مرفق الرفع المساحي" },
];

const engineeringFormKeyFields: PropertyFieldCatalogEntry[] = [
  { key: "onSiteAreaSqm", label: "المساحة على الطبيعة — مفتاح النموذج" },
  { key: "northBoundaryLengthM", label: "طول الحد الشمالي — مفتاح النموذج" },
  { key: "southBoundaryLengthM", label: "طول الحد الجنوبي — مفتاح النموذج" },
  { key: "eastBoundaryLengthM", label: "طول الحد الشرقي — مفتاح النموذج" },
  { key: "westBoundaryLengthM", label: "طول الحد الغربي — مفتاح النموذج" },
  { key: "siteConfirmed", label: "تأكيد الوقوف على الموقع" },
  { key: "siteDeclarationSigned", label: "إقرار الموقع (موقّع)" },
];

const engineeringChecklistFields: PropertyFieldCatalogEntry[] = [
  { key: "chk_deed_match", label: "هل الصك مطابق للرفع المساحي (الأطوال والمساحة)" },
  { key: "chk_site_declaration", label: "هل تم الوقوف على الموقع وتوقيع إقرار صحة الاستدلال" },
  { key: "chk_plot_mismatch", label: "هل يوجد اختلاف في رقم القطعة / المخطط / البلوك / الحي / المدينة" },
  { key: "chk_area_mismatch", label: "هل يوجد اختلاف في مساحة / أطوال الصك عن الطبيعة" },
  { key: "chk_roads_not_in_deed", label: "هل يوجد شوارع محتزلة / شطفات في المخطط ولم تذكر في الصك" },
  { key: "chk_overlap", label: "هل يوجد تداخل في الصك أو أجزاء مشتركة ظاهرياً" },
  { key: "chk_usage_in_deed", label: "هل ذُكر الاستخدام حسب الصك" },
  { key: "chk_vacant_land", label: "هل الموقع أرض فضاء" },
  { key: "chk_electric_room", label: "هل يوجد غرفة كهرباء داخل / خارج حدود الموقع" },
  { key: "chk_utility_boxes", label: "هل يوجد صناديق خدمات كهربائية / اتصالات / أخرى" },
  { key: "chk_instructions_applied", label: "هل تم تطبيق جميع التعليمات الصادرة في الرفع المساحي" },
  { key: "chk_fences", label: "هل يوجد أسوار داخلية وخارجية بمحيط المبنى القائم" },
  { key: "chk_boundary_mismatch", label: "هل يوجد اختلاف في الحدود / الصك أو الأفادة من المستكشف" },
];

const engineeringChecklistNoteFields: PropertyFieldCatalogEntry[] = [
  { key: "chk_deed_match_note", label: "ملاحظة — مطابقة الصك للرفع المساحي" },
  { key: "chk_site_declaration_note", label: "ملاحظة — إقرار صحة الاستدلال" },
  { key: "chk_plot_mismatch_note", label: "ملاحظة — اختلاف رقم القطعة / المخطط" },
  { key: "chk_area_mismatch_note", label: "ملاحظة — اختلاف المساحة / الأطوال" },
  { key: "chk_roads_not_in_deed_note", label: "ملاحظة — شوارع محتزلة غير مذكورة" },
  { key: "chk_overlap_note", label: "ملاحظة — تداخل الصك" },
  { key: "chk_usage_in_deed_note", label: "ملاحظة — الاستخدام حسب الصك" },
  { key: "chk_vacant_land_note", label: "ملاحظة — أرض فضاء" },
  { key: "chk_electric_room_note", label: "ملاحظة — غرفة كهرباء" },
  { key: "chk_utility_boxes_note", label: "ملاحظة — صناديق خدمات" },
  { key: "chk_instructions_applied_note", label: "ملاحظة — تطبيق التعليمات" },
  { key: "chk_fences_note", label: "ملاحظة — أسوار المبنى" },
  { key: "chk_boundary_mismatch_note", label: "ملاحظة — اختلاف الحدود / المستكشف" },
];

const evaluatorCoreFields: PropertyFieldCatalogEntry[] = [
  { key: "evaluatorPrice", label: "سعر التقييم" },
  { key: "evaluatorNotes", label: "ملاحظات المقيّم" },
  { key: "reportFileName", label: "تقرير التقييم (مرفق)" },
];

const evaluatorChecklistFields: PropertyFieldCatalogEntry[] = [
  { key: "q_plan_match", label: "هل رقم المخطط مطابق للصك؟" },
  { key: "q_excess_zoning", label: "هل القطعة زائدة تنظيمية؟" },
  { key: "q_land_waqf", label: "هل الأرض موقوفة؟" },
  { key: "q_property_waqf", label: "هل العقار موقوف؟" },
  { key: "q_expropriation", label: "هل يوجد نزع على منطقة العقار؟" },
  { key: "q_property_use_verified", label: "هل تم التأكد من استخدام العقار؟" },
  { key: "q_agriculture_inquiry", label: "هل تم الاستعلام من وزارة الزراعة حيال الأرض الزراعية؟" },
  { key: "q_overlap", label: "هل يوجد تداخل في الأصل؟" },
  { key: "q_shared_building", label: "هل يوجد على الأصل مبنى مشترك؟" },
  { key: "q_environmental_factors", label: "هل هناك عوامل بيئية أو تنظيمية قد تؤثر على العقار؟" },
  { key: "q_unregistered_additions", label: "هل العقار يحتوي على إضافات غير مسجلة في الصك؟" },
  { key: "q_shared_deed", label: "هل الصك مشاع؟" },
  { key: "shared_deed_scope", label: "نطاق الملكية في الصك المشاع" },
  { key: "shared_deed_percentage", label: "نسبة الملكية في الصك المشاع" },
  { key: "q_lease_exists", label: "هل يوجد عقد إيجار؟" },
  { key: "q_lease_active", label: "هل عقد الإيجار ساري؟" },
  { key: "q_technical_notes_exists", label: "هل يوجد ملاحظات فنية قد تؤثر على قيمة العقار؟" },
  { key: "technical_notes_text", label: "نص الملاحظات الفنية" },
];

const evaluatorInfathFields: PropertyFieldCatalogEntry[] = [
  { key: "appraisalDate", label: "تاريخ التقييم" },
  { key: "valuationMethod", label: "الأسلوب المستخدم" },
  { key: "valueBasis", label: "أساس القيمة" },
  { key: "demandLevel", label: "حجم الطلب على العقار" },
  { key: "landValue", label: "قيمة الأرض (ر.س)" },
  { key: "buildingValue", label: "قيمة المباني (ر.س)" },
  { key: "forcedDiscount", label: "نسبة خصم البيع القسري" },
  { key: "searchScope", label: "نطاق البحث ومصادر معلومات القيم" },
  { key: "planPhoto", label: "صورة الأصل من المخطط (PDF)" },
  { key: "appraiserAddress", label: "عنوان المقيم" },
  { key: "appraiserPhone", label: "رقم تواصل المقيّم" },
  { key: "reportIssueDate", label: "تاريخ إصدار التقرير" },
  { key: "signedAppraisal", label: "مرفق التقييم المعتمد" },
];

const evaluatorFormKeyFields: PropertyFieldCatalogEntry[] = [
  { key: "forcedSaleDiscountPct", label: "نسبة خصم البيع القسري — مفتاح النموذج" },
  { key: "searchScopeNotes", label: "نطاق البحث — مفتاح النموذج" },
  { key: "planImageFileName", label: "صورة المخطط — مفتاح النموذج" },
];

const governmentFields: PropertyFieldCatalogEntry[] = [
  { key: "visitStatus", label: "حالة الزيارة" },
  { key: "visitDate", label: "تاريخ الزيارة" },
  { key: "courtName", label: "اسم المحكمة" },
  { key: "keysStatus", label: "حالة المفاتيح" },
  { key: "keysDescription", label: "وصف المفاتيح" },
  { key: "accessBlockReason", label: "سبب تعذّر الوصول" },
  { key: "reviewNotes", label: "ملاحظات المراجعة" },
  { key: "zoneStatus", label: "حالة منطقة العقار (وقف)" },
  { key: "keysProof", label: "إثبات استلام المفتاح (خطاب أو صورة)" },
  { key: "keysReceived", label: "هل تم استلام المفتاح من الدائرة؟" },
  { key: "confirmed", label: "تأكيد المراجعة" },
];

const governmentFormKeyFields: PropertyFieldCatalogEntry[] = [
  { key: "propertyZoneStatus", label: "حالة منطقة العقار — مفتاح النموذج" },
  { key: "keysProofFiles", label: "إثبات المفتاح — مرفقات النموذج" },
];

const caseStudyMetaFields: PropertyFieldCatalogEntry[] = [
  { key: "requestNumber", label: "رقم الطلب" },
  { key: "requestDate", label: "تاريخ الطلب" },
  { key: "deedNumber", label: "رقم الصك (نموذج الدراسة)" },
  { key: "deedRemarks", label: "ملاحظات قسم الصك" },
  { key: "surveyRemarks", label: "ملاحظات الرفع المساحي" },
  { key: "componentsRemarks", label: "ملاحظات مكونات العقار" },
  { key: "occupancyRemarks", label: "ملاحظات الإشغال والإيجار" },
  { key: "meterType", label: "نوع العداد" },
  { key: "meterNumber", label: "رقم العداد" },
  { key: "hoaFee", label: "رسوم اتحاد الملاك" },
  { key: "sigDeed", label: "توقيع — الصك" },
  { key: "sigApprover", label: "توقيع — المعتمد" },
  { key: "sigDate", label: "تاريخ التوقيع" },
];

const caseStudyDeedQuestions: PropertyFieldCatalogEntry[] = [
  { key: "deed_0", label: "هل الصك فعال" },
  { key: "deed_1", label: "هل رقم القطعة مطابق للصك" },
  { key: "deed_2", label: "هل رقم المخطط مطابق للصك" },
  { key: "deed_3", label: "هل القطعة زائدة تنظيمية" },
  { key: "deed_4", label: "هل يوجد نزع على منطقة العقار" },
  { key: "deed_5", label: "هل الأرض موقوفة" },
  { key: "deed_6", label: "هل العقار موقوف" },
  { key: "deed_7", label: "هل تم التأكد من استخدام العقار" },
  { key: "deed_8", label: "هل تم الاستعلام من وزارة الزراعة حيال الأرض الزراعية" },
  { key: "deed_9", label: "هل الصك مشاع" },
  { key: "deed_10", label: "في حال الصك المشاع — نطاق الملكية والنسبة" },
];

const caseStudySurveyQuestions: PropertyFieldCatalogEntry[] = [
  { key: "survey_0", label: "هل الصك مطابق للرفع المساحي" },
  { key: "survey_1", label: "هل تم ذكر جميع الاختلافات في الرفع المساحي" },
  { key: "survey_2", label: "هل تم تطبيق جميع التعليمات الصادرة من المركز في الرفع المساحي" },
  { key: "survey_3", label: "هل تم التوقيع وإرفاق إقرار على صحة الموقع" },
  { key: "survey_4", label: "هل يوجد تداخل في الأصل" },
  { key: "survey_5", label: "هل يوجد على الأصل مبنى مشترك" },
  { key: "survey_6", label: "هل ذكر المرجع المعتمد في الاستدلال على استخدام العقار" },
];

const caseStudyComponentsQuestions: PropertyFieldCatalogEntry[] = [
  { key: "comp_0", label: "هل يوجد في العقار بئر" },
  { key: "comp_1", label: "هل يوجد في العقار غرفة كهرباء" },
  { key: "comp_2", label: "هل يوجد في العقار أبراج كهرباء" },
  { key: "comp_3", label: "هل يوجد في العقار أبراج اتصالات" },
  { key: "comp_4", label: "هل يوجد في العقار مضخة دفاع مدني" },
  { key: "comp_5", label: "هل يوجد في العقار منقولات" },
  { key: "comp_6", label: "هل يوجد في العقار مركبات" },
  { key: "comp_7", label: "هل يوجد في العقار معدات زراعية أو موجودات حيوية" },
  { key: "comp_8", label: "هل تم مطابقة مكونات العقار على الطبيعة مع المكونات المذكورة في الصك" },
];

const caseStudyOccupancyQuestions: PropertyFieldCatalogEntry[] = [
  { key: "occ_0", label: "هل العقار مأهول بالسكن" },
  { key: "occ_1", label: "هل يوجد عقد إيجار" },
  { key: "occ_2", label: "هل تم مطابقة رقم الصك بالمذكور بعقد الإيجار" },
  { key: "occ_3", label: "هل عقد الإيجار ساري" },
  { key: "occ_4", label: "هل عقد الإيجار إلكتروني" },
  { key: "occ_5", label: "هل يوجد اتحاد ملاك؟" },
];

const caseStudyExtraQuestions: PropertyFieldCatalogEntry[] = [
  { key: "extra_0", label: "هل تم ذكر جميع الملاحظات للتوضيح في حال عدم المطابقة" },
  { key: "extra_1", label: "هل يوجد ملاحظات فنية قد تؤثر على قيمة العقار" },
  { key: "extra_2", label: "هل هناك عوامل بيئية أو تنظيمية قد تؤثر على العقار" },
  { key: "extra_3", label: "هل العقار يحتوي على أي إضافات غير مسجلة في الصك" },
];

const specialistInfathFields: PropertyFieldCatalogEntry[] = [
  { key: "linkedAssets", label: "هل الأصل مرتبط بأصول أخرى؟" },
  { key: "linkedDeedNumbers", label: "أرقام صكوك الأصول المرتبطة" },
  { key: "linkedAssetsNotes", label: "ملاحظات ربط الأصل" },
  { key: "otherNotes", label: "ملاحظات" },
  { key: "closingNotes", label: "ملاحظات ختامية" },
];

const specialistFormKeyFields: PropertyFieldCatalogEntry[] = [
  { key: "infathLinkedAssets", label: "ربط الأصول — مفتاح النموذج" },
  { key: "infathLinkedDeedNumbers", label: "صكوك مرتبطة — مفتاح النموذج" },
  { key: "infathLinkedAssetsNotes", label: "ملاحظات الربط — مفتاح النموذج" },
  { key: "infathOtherNotes", label: "ملاحظات — مفتاح النموذج" },
  { key: "infathClosingNotes", label: "ملاحظات ختامية — مفتاح النموذج" },
  { key: "specialistReviewApproved", label: "اعتماد إجابات الأطراف (أخصائي)" },
];

const systemAutoFields: PropertyFieldCatalogEntry[] = [
  { key: "reportNumber", label: "رقم التقرير" },
  { key: "assetSubject", label: "الأصل محل التقييم (من بيانات المعاملة)" },
  { key: "deedAreaRef", label: "المساحة حسب الصك (م²)" },
  { key: "areaDiff", label: "يوجد اختلاف في المساحة" },
  { key: "totalValue", label: "إجمالي قيمة العقار (ر.س)" },
  { key: "forcedSaleValue", label: "قيمة البيع القسري (ر.س)" },
  { key: "deedPhoto", label: "صك ملكية الأصل (PDF)" },
];

/** القسم ٨ — بيانات العاملين (مواصفة إنفاذ؛ غير مُنفَّذة بعد). */
const infathWorkerLicenseFields: PropertyFieldCatalogEntry[] = [
  { key: "workerName", label: "اسم العامل على التقرير" },
  { key: "workerLicenseNumber", label: "رقم ترخيص العامل" },
  { key: "workerLicenseDate", label: "تاريخ الترخيص" },
  { key: "workerLicenseAttachment", label: "مرفق الترخيص" },
];

const failuresFields: PropertyFieldCatalogEntry[] = [
  { key: "failureTitle", label: "عنوان التعذر" },
  { key: "problemTypeId", label: "نوع المشكلة" },
  { key: "failureSeverity", label: "نوع التعذر (احتمالي / داخلي)" },
  { key: "failureStatus", label: "حالة التعذر" },
  { key: "raisedByRole", label: "الدور الرافع للتعذر" },
  { key: "internalNote", label: "وصف داخلي / ملاحظة التعذر" },
  { key: "finalNote", label: "قرار المشرف" },
  { key: "resolutionReason", label: "سبب الحل" },
  { key: "continueInstructions", label: "توجيه استمرار العمل" },
  { key: "failureSpecialist", label: "أخصائي التعذر" },
  { key: "failurePoNumber", label: "رقم أمر العمل (تعذر)" },
  { key: "failurePropertyId", label: "معرّف العقار (تعذر)" },
  { key: "failureDeedNumber", label: "رقم الصك (تعذر)" },
];

const workflowMetaFields: PropertyFieldCatalogEntry[] = [
  { key: "taskStatus", label: "حالة المهمة" },
  { key: "submissionStatus", label: "حالة الإرسال / النموذج" },
  { key: "submittedAt", label: "تاريخ الإرسال" },
  { key: "updatedAt", label: "آخر تحديث" },
  { key: "formCurrentStep", label: "الخطوة الحالية (دراسة الحالة)" },
  { key: "answersCompleted", label: "الإجابات المكتملة" },
  { key: "checklistCompleted", label: "البنود المكتملة (قائمة التحقق)" },
  { key: "surveySubmissionStatus", label: "حالة الرفع المساحي" },
  { key: "inspectionSubmissionStatus", label: "حالة المعاينة" },
  { key: "appraisalSubmissionStatus", label: "حالة التقييم" },
  { key: "governmentReviewStatus", label: "حالة المراجعة الحكومية" },
  { key: "coordinationReceiptStatus", label: "حالة الاستلام (تنسيق التقييم)" },
];

const partyPanelDerivedFields: PropertyFieldCatalogEntry[] = [
  { key: "partyCoords", label: "الإحداثيات (لوحة الأطراف)" },
  { key: "partyActualArea", label: "المساحة الفعلية (لوحة الأطراف)" },
  { key: "partyMovablesInside", label: "منقولات داخل العقار (لوحة الأطراف)" },
  { key: "partyCurrentlyRented", label: "العقار مؤجر (لوحة الأطراف)" },
  { key: "partyAccessDifficulty", label: "إمكانية الوصول (لوحة الأطراف)" },
  { key: "partyAvgPriceSqm", label: "متوسط سعر م² (لوحة الأطراف)" },
  { key: "partyMarketActivity", label: "نشاط السوق (لوحة الأطراف)" },
  { key: "partySignatoryName", label: "المسؤول عن التوقيع (لوحة الأطراف)" },
  { key: "partySignatoryRole", label: "صفة المسؤول (لوحة الأطراف)" },
  { key: "partyMarketNotes", label: "ملاحظات سوقية (لوحة الأطراف)" },
  { key: "partyGeneralNotes", label: "ملاحظات عامة (لوحة الأطراف)" },
  { key: "partySignedDocs", label: "صور المستندات (لوحة الأطراف)" },
  { key: "partyPropertyPhotos", label: "صور العقار (لوحة الأطراف)" },
  { key: "partyKeysLocation", label: "المفاتيح / موقع الحفظ" },
  { key: "partyAccessBlockFollowUp", label: "سبب التعذر / المتابعة" },
  { key: "partyValuationDepartment", label: "قسم التقييم (مفعّل)" },
  { key: "partyCoordinatorName", label: "المنسق المعيّن" },
  { key: "partyFieldInspector", label: "المعاين الميداني (تنسيق)" },
  { key: "partyAppraiser", label: "المقيم العقاري (تنسيق)" },
  { key: "partyCoordinationPriority", label: "الأولوية (تنسيق التقييم)" },
  { key: "partyCoordinationNotes", label: "ملاحظات التنسيق" },
  { key: "partyInspectorInstructions", label: "تعليمات للمعاين" },
  { key: "partyAppraiserInstructions", label: "تعليمات للمقيم" },
  { key: "partyReceiptDate", label: "تاريخ الاستلام (تنسيق)" },
  { key: "partyConfirmationDate", label: "تاريخ التأكيد (تنسيق)" },
];

const propertyDocumentsFields: PropertyFieldCatalogEntry[] = [
  { key: "docRealEstateReg", label: "السجل العقاري (مستند)" },
  { key: "docAssignmentDecree", label: "قرار الإسناد (مستند)" },
  { key: "docDelegationLetter", label: "خطاب التفويض (مستند)" },
  { key: "docBoundariesExternal", label: "مستند الحدود (مستند)" },
  { key: "docOtherIntake", label: "مستند إضافي (مستند)" },
  { key: "docSurveyReport", label: "تقرير الرفع المساحي (مستند)" },
  { key: "docSiteDeclarationLetter", label: "خطاب إقرار صحة الموقع (مستند)" },
  { key: "docAppraisalReport", label: "تقرير التقييم (مستند)" },
  { key: "docSignedInspection", label: "مستند موقّع — معاينة" },
  { key: "docPhotoMainFacade", label: "صورة واجهة رئيسية (مستند)" },
  { key: "docPhotoEntrance", label: "صورة المدخل (مستند)" },
  { key: "docPhotoInterior", label: "صورة الداخل (مستند)" },
  { key: "docPhotoSurroundings", label: "صورة المحيط (مستند)" },
];

const valuationCoordinationFields: PropertyFieldCatalogEntry[] = [
  { key: "receiptConfirmed", label: "تأكيد الاستلام" },
  { key: "receiptDate", label: "تاريخ الاستلام" },
  { key: "inspectorName", label: "المعاين الميداني" },
  { key: "appraiserName", label: "المقيم العقاري" },
  { key: "priority", label: "الأولوية" },
  { key: "coordinationNotes", label: "ملاحظات التنسيق" },
  { key: "inspectorInstructions", label: "تعليمات للمعاين" },
  { key: "appraiserInstructions", label: "تعليمات للمقيم" },
];

const keysTabFields: PropertyFieldCatalogEntry[] = [
  { key: "keysTabCourt", label: "المحكمة (مفاتيح العقار)" },
  { key: "keysTabStatus", label: "حالة المفاتيح (تبويب)" },
  { key: "keysTabVisitStatus", label: "حالة الزيارة (تبويب)" },
  { key: "keysTabVisitDate", label: "تاريخ الزيارة (تبويب)" },
  { key: "keysTabStorageLocation", label: "المفاتيح / موقع الحفظ (تبويب)" },
  { key: "keysTabAccessNote", label: "سبب التعذر / المتابعة (تبويب)" },
  { key: "keysTabReviewer", label: "المراجع الحكومي (تبويب)" },
];

const backendApiFields: PropertyFieldCatalogEntry[] = [
  { key: "WorkOrderProperty.Id", label: "معرّف العقار (API)" },
  { key: "WorkOrderProperty.WorkOrderId", label: "معرّف أمر العمل (API)" },
  { key: "WorkOrderProperty.IdentifierType", label: "مصدر البيانات (API)" },
  { key: "WorkOrderProperty.DeedNumber", label: "رقم الصك (API)" },
  { key: "WorkOrderProperty.RequestNumber", label: "رقم الطلب (API)" },
  { key: "WorkOrderProperty.AssignmentMandateNumber", label: "رقم التكليف (API)" },
  { key: "WorkOrderProperty.AssignmentMandateDate", label: "تاريخ التكليف (API)" },
  { key: "WorkOrderProperty.PlanNumber", label: "رقم المخطط (API)" },
  { key: "WorkOrderProperty.PlotNumber", label: "رقم القطعة (API)" },
  { key: "WorkOrderProperty.LocationMapUrl", label: "رابط موقع الخريطة (API)" },
  { key: "WorkOrderProperty.DeedDate", label: "تاريخ الصك (API)" },
  { key: "WorkOrderProperty.OwnerName", label: "اسم المالك (API)" },
  { key: "WorkOrderProperty.RestrictionsPresent", label: "القيود على العقار (API)" },
  { key: "WorkOrderProperty.BoundariesAvailability", label: "توفر الحدود (API)" },
  { key: "WorkOrderProperty.BoundariesExternalDocName", label: "مستند الحدود الخارجي (API)" },
  { key: "WorkOrderProperty.City", label: "المدينة (API)" },
  { key: "WorkOrderProperty.District", label: "الحي (API)" },
  { key: "WorkOrderProperty.DeedStatus", label: "حالة الصك (API)" },
  { key: "WorkOrderProperty.Area", label: "المساحة (API)" },
  { key: "WorkOrderProperty.Court", label: "المحكمة (API)" },
  { key: "WorkOrderProperty.Circuit", label: "الدائرة (API)" },
  { key: "WorkOrderProperty.Classification", label: "التصنيف (API)" },
  { key: "WorkOrderProperty.PropertyType", label: "نوع العقار (API)" },
  { key: "WorkOrderProperty.AssignmentDocFileName", label: "قرار الإسناد (API)" },
  { key: "WorkOrderProperty.DelegationLetterFileName", label: "خطاب التفويض (API)" },
  { key: "WorkOrderProperty.OtherDocumentFileNames", label: "مستندات أخرى (API)" },
  { key: "WorkOrderProperty.RealEstateRegFileName", label: "السجل العقاري (API)" },
  { key: "WorkOrderProperty.BourseDataCompleted", label: "اكتمال البورصة (API)" },
  { key: "PropertyContact.Name", label: "ضابط الاتصال — الاسم (API)" },
  { key: "PropertyContact.Role", label: "ضابط الاتصال — الصفة (API)" },
  { key: "PropertyContact.Phone", label: "ضابط الاتصال — الجوال (API)" },
];

/** جميع مجموعات حقول العقار مرتبة حسب الدور والشاشة. */
export const PROPERTY_FIELDS_CATALOG: PropertyFieldCatalogGroup[] = [
  {
    id: "po-intake",
    sourceRole: "أخصائي / عميل",
    screen: "تسجيل العقار — إنفاذ",
    fields: poIntakeFields,
  },
  {
    id: "bourse",
    sourceRole: "بورصة عقارية",
    screen: "استعلام البورصة",
    fields: bourseFields,
  },
  {
    id: "bourse-obstruction",
    sourceRole: "بورصة عقارية",
    screen: "تعذر — صك غير فعال",
    fields: bourseObstructionFields,
  },
  {
    id: "property-detail",
    sourceRole: "نظام",
    screen: "تفاصيل العقار — مراحل وسير العمل",
    fields: propertyDetailFields,
  },
  {
    id: "property-detail-basic",
    sourceRole: "نظام",
    screen: "تفاصيل العقار — البيانات الأساسية (عرض)",
    fields: propertyDetailBasicDisplayFields,
  },
  {
    id: "property-detail-hero",
    sourceRole: "نظام",
    screen: "تفاصيل العقار — رأس الصفحة",
    fields: propertyDetailHeroFields,
  },
  {
    id: "inspector-core",
    sourceRole: "معاين",
    screen: "نموذج المعاينة",
    fields: inspectorCoreFields,
  },
  {
    id: "inspector-infath",
    sourceRole: "معاين",
    screen: "بيانات الرفع لإنفاذ",
    fields: inspectorInfathFields,
  },
  {
    id: "inspector-form-keys",
    sourceRole: "معاين",
    screen: "نموذج المعاينة — مفاتيح التخزين",
    fields: inspectorFormKeyFields,
  },
  {
    id: "engineering-core",
    sourceRole: "مكتب هندسي",
    screen: "الرفع المساحي",
    fields: engineeringCoreFields,
  },
  {
    id: "engineering-infath",
    sourceRole: "مكتب هندسي",
    screen: "بيانات الرفع لإنفاذ",
    fields: engineeringInfathFields,
  },
  {
    id: "engineering-form-keys",
    sourceRole: "مكتب هندسي",
    screen: "الرفع المساحي — مفاتيح التخزين",
    fields: engineeringFormKeyFields,
  },
  {
    id: "engineering-checklist",
    sourceRole: "مكتب هندسي",
    screen: "قائمة التحقق الميداني",
    fields: engineeringChecklistFields,
  },
  {
    id: "engineering-checklist-notes",
    sourceRole: "مكتب هندسي",
    screen: "قائمة التحقق — ملاحظات البنود",
    fields: engineeringChecklistNoteFields,
  },
  {
    id: "evaluator-core",
    sourceRole: "مقيّم",
    screen: "تقييم العقار",
    fields: evaluatorCoreFields,
  },
  {
    id: "evaluator-checklist",
    sourceRole: "مقيّم",
    screen: "قائمة التحقق",
    fields: evaluatorChecklistFields,
  },
  {
    id: "evaluator-infath",
    sourceRole: "مقيّم",
    screen: "بيانات الرفع لإنفاذ",
    fields: evaluatorInfathFields,
  },
  {
    id: "evaluator-form-keys",
    sourceRole: "مقيّم",
    screen: "تقييم العقار — مفاتيح التخزين",
    fields: evaluatorFormKeyFields,
  },
  {
    id: "government",
    sourceRole: "مراجع حكومي",
    screen: "المراجعة الحكومية",
    fields: governmentFields,
  },
  {
    id: "government-form-keys",
    sourceRole: "مراجع حكومي",
    screen: "المراجعة الحكومية — مفاتيح التخزين",
    fields: governmentFormKeyFields,
  },
  {
    id: "keys-tab",
    sourceRole: "مراجع حكومي",
    screen: "مفاتيح العقار (تبويب)",
    fields: keysTabFields,
  },
  {
    id: "case-study-meta",
    sourceRole: "أخصائي",
    screen: "نموذج دراسة الحالة — بيانات عامة",
    fields: caseStudyMetaFields,
  },
  {
    id: "case-study-deed",
    sourceRole: "أخصائي",
    screen: "نموذج دراسة الحالة — الصك والعقار",
    fields: caseStudyDeedQuestions,
  },
  {
    id: "case-study-survey",
    sourceRole: "أخصائي",
    screen: "نموذج دراسة الحالة — الرفع المساحي",
    fields: caseStudySurveyQuestions,
  },
  {
    id: "case-study-comp",
    sourceRole: "أخصائي",
    screen: "نموذج دراسة الحالة — مكونات العقار",
    fields: caseStudyComponentsQuestions,
  },
  {
    id: "case-study-occ",
    sourceRole: "أخصائي",
    screen: "نموذج دراسة الحالة — الإشغال والإيجار",
    fields: caseStudyOccupancyQuestions,
  },
  {
    id: "case-study-extra",
    sourceRole: "أخصائي",
    screen: "نموذج دراسة الحالة — ملاحظات إضافية",
    fields: caseStudyExtraQuestions,
  },
  {
    id: "specialist-infath",
    sourceRole: "أخصائي",
    screen: "بيانات الرفع لإنفاذ",
    fields: specialistInfathFields,
  },
  {
    id: "specialist-form-keys",
    sourceRole: "أخصائي",
    screen: "دراسة الحالة — مفاتيح التخزين",
    fields: specialistFormKeyFields,
  },
  {
    id: "valuation-coordination",
    sourceRole: "منسق تقييم",
    screen: "تنسيق التقييم",
    fields: valuationCoordinationFields,
  },
  {
    id: "failures",
    sourceRole: "أخصائي / نظام",
    screen: "التعذرات",
    fields: failuresFields,
  },
  {
    id: "workflow-meta",
    sourceRole: "نظام",
    screen: "حالات المهام والإرسال",
    fields: workflowMetaFields,
  },
  {
    id: "party-panel",
    sourceRole: "نظام",
    screen: "لوحة الأطراف — حقول مشتقة",
    fields: partyPanelDerivedFields,
  },
  {
    id: "property-documents",
    sourceRole: "نظام",
    screen: "مستندات العقار",
    fields: propertyDocumentsFields,
  },
  {
    id: "system-auto",
    sourceRole: "نظام",
    screen: "بيانات تلقائية / محسوبة",
    fields: systemAutoFields,
  },
  {
    id: "infath-worker-license",
    sourceRole: "نظام",
    screen: "بيانات العاملين على التقرير (مواصفة)",
    fields: infathWorkerLicenseFields,
  },
  {
    id: "backend-api",
    sourceRole: "نظام",
    screen: "كيان العقار — API / قاعدة البيانات",
    fields: backendApiFields,
  },
];

export function propertyFieldsCatalogFlat(): PropertyFieldCatalogEntry[] {
  return PROPERTY_FIELDS_CATALOG.flatMap((g) => g.fields);
}

export function propertyFieldsCatalogTotalCount(): number {
  return propertyFieldsCatalogFlat().length;
}

export const PROPERTY_FIELDS_SOURCE_ROLES = [
  ...new Set(PROPERTY_FIELDS_CATALOG.map((g) => g.sourceRole)),
];
