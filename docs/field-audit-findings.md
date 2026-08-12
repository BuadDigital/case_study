# تدقيق حقول «المقياس» مقابل النظام الفعلي

**الغرض من هذه الوثيقة:**
مقارنة كل حقل وارد في ملف `docs/_حقول المقياس.xlsx` (176 حقلًا موزّعة على 15 قسمًا) بكتالوج الحقول الفعلي المستخدم في الكود، لتحديد ما هو مغطّى فعليًا في النظام وما هو غائب أو مغطّى جزئيًا فقط.

**منهجية المطابقة:**
كل حقل قُورن **بمعناه**، لا بمطابقة نصية حرفية — لأن تسميات النظام غالبًا مختصرة أو مرادفة لصياغة ملف المقياس (مثال: النظام يستخدم «مساجد» ضمن قائمة مرافق ثابتة بينما ملف المقياس يذكر «مجاور مسجد» كحقل مستقل).

**مصادر المطابقة في الكود:**
- `packages/app-shared/src/prototype/property-fields-catalog.ts`
- `apps/mfe-case-study/src/lib/prototype/infath-field-labels.ts`
- `apps/mfe-case-study/src/lib/prototype/inspector-workspace-data.ts`

**تصنيف الحالة:**
| الحالة | المعنى |
|---|---|
| `used` (مستخدم) | الحقل موجود في الكود بمطابقة تامة أو شبه تامة |
| `partial` (جزئي) | المفهوم موجود لكن ببنية أو صياغة مختلفة (مثال: حقل عام واحد بدل عدة حقول باتجاهات، أو قائمة مرافق مختصرة) |
| `none` (غير موجود) | لا يوجد أثر للحقل في الكود إطلاقًا |

---

## الأرقام الإجمالية

| المقياس | العدد |
|---|---|
| إجمالي الحقول | 176 |
| عدد الأقسام | 15 |
| **مستخدم** | **79** (45%) |
| **موجود جزئيًا** | **38** (22%) |
| **غير موجود إطلاقًا** | **59** (34%) |

---

## التغطية حسب القسم (من الأقل تغطية إلى الأكثر)

| القسم | مستخدم | جزئي | غير موجود | الإجمالي | % التغطية |
|---|---|---|---|---|---|
| تفاصيل التشطيبات | 2 | 7 | 20 | 29 | 7% |
| ميزات الموقع | 0 | 6 | 2 | 8 | 0% |
| الخدمات | 1 | 8 | 0 | 9 | 11% |
| تقييم عام | 5 | 2 | 8 | 15 | 33% |
| معلومات عامة | 6 | 4 | 5 | 15 | 40% |
| معلومات العميل | 5 | 3 | 8 | 16 | 31% |
| الحدود | 4 | 4 | 4 | 12 | 33% |
| المرفقات | 5 | 1 | 4 | 10 | 50% |
| معلومات المعاينة | 3 | 1 | 0 | 4 | 75% |
| المعلومات الأساسية | 4 | 0 | 2 | 6 | 67% |
| أنظمة تحديد المواقع | 4 | 0 | 2 | 6 | 67% |
| الاختبارات المطلوبة | 7 | 0 | 1 | 8 | 88% |
| الأساسيات | 7 | 0 | 1 | 8 | 88% |
| الممر الخارجي | 9 | 1 | 0 | 10 | 90% |
| تحقق الصك والملاحظات | 17 | 1 | 2 | 20 | 85% |

### أبرز اكتشاف: قسم «تفاصيل التشطيبات» شبه غائب بالكامل

من أصل 29 حقلًا في هذا القسم (نوع التشطيب، الواجهات الأربع، أنواع الأرضيات، النوافذ، الأبواب، العزل، الأسقف، أنواع التكييف، الأثاث، جاهزية السكن، عدّادات الجاكوزي/المسابح/الملحقات)، **حقلان فقط مستخدَمان** (يوجد مصعد، عدد أدوار المباني)، 7 جزئي، و**20 غير موجودين إطلاقًا**. هذا القسم وحده مسؤول عن ثلث الحقول الغائبة كليًا في النظام (20 من أصل 59).

### الأقسام الأفضل تغطية
- **الممر الخارجي** (مكونات العقار): 9/10 — 90%
- **تحقق الصك والملاحظات**: 17/20 — 85%
- **الأساسيات** (الإشغال والإيجار) و**الاختبارات المطلوبة**: 7/8 لكل منهما — 88%

---

## جدول الحقول الكامل (176)

### معلومات العميل

| # | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|
| 1 | الجهة الطالبة | `client_requesting_entity` | غير موجود | |
| 2 | التقرير | `client_report_type` | غير موجود | عنوان عام فقط، لا حقل مستقل |
| 3 | اسم العميل | `client_name` | غير موجود | مختلف عن اسم المالك — غير موجود |
| 4 | رقم التعميد | `client_po_number` | غير موجود | مختلف عن رقم التكليف |
| 5 | رقم التكليف | `client_assignment_number` | مستخدم | assignmentMandateNumber — تطابق تام |
| 6 | تاريخ التكليف (م) | `client_assignment_date_g` | مستخدم | assignmentMandateDate |
| 7 | اسم المالك | `client_owner_name` | مستخدم | ownerName — تطابق تام |
| 8 | رقم الصك | `client_deed_number` | مستخدم | deedNumber — تطابق تام |
| 9 | رقم الجوال 1 | `client_mobile_1` | جزئي | يوجد حقل جوال واحد فقط (contactPhone)، لا رقمان |
| 10 | رقم الجوال 2 | `client_mobile_2` | جزئي | نفس الملاحظة أعلاه |
| 11 | الإيميل للمشاريع | `client_project_email` | غير موجود | |
| 12 | تاريخ الصك (هـ) | `client_deed_date_h` | مستخدم | deedDate |
| 13 | رقم الرخصة | `client_license_number` | غير موجود | يوجد رقم ترخيص للعامل/المقيّم فقط، لا رخصة للعقار |
| 14 | تاريخ الرخصة (هـ) | `client_license_date_h` | غير موجود | |
| 15 | رمز العقار - الطلب | `client_property_request_code` | جزئي | قريب من requestNumber «رقم الطلب» |
| 16 | نوع التقييم | `client_valuation_type_lov` | غير موجود | يوجد valuationMethod «الأسلوب المستخدم» لكن ليس «نوع» |

### المعلومات الأساسية

| # | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|
| 17 | الأصل محل التقييم | `property_type` | مستخدم | assetSubject — تطابق تام |
| 18 | الموقع | `property_location` | مستخدم | siteLocation «موقع الأصل» |
| 19 | رقم المخطط | `property_plan_number` | مستخدم | planNumber — تطابق تام |
| 20 | اسم المخطط | `property_plan_name` | غير موجود | رقم المخطط موجود، اسمه غير موجود |
| 21 | رقم القطعة | `property_plot_number` | مستخدم | plotNumber — تطابق تام |
| 22 | رقم البلك | `property_block_number` | غير موجود | مذكور ضمن نص قائمة تحقق فقط، بلا حقل مستقل |

### الحدود

| # | الحد | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|---|
| 23 | الشمالي | الوصف | `boundary_north_description` | جزئي | اسم الحد موجود (northBoundary)، لا حقل «وصف» عام منفصل |
| 24 | الشمالي | الطول | `boundary_north_length` | مستخدم | northLength — تطابق تام |
| 25 | الشمالي | النوع | `boundary_north_type` | غير موجود | نوع الحد غير مصنّف كحقل مستقل |
| 26 | الجنوبي | الوصف | `boundary_south_description` | جزئي | southBoundary اسم فقط، لا «وصف» منفصل |
| 27 | الجنوبي | الطول | `boundary_south_length` | مستخدم | southLength — تطابق تام |
| 28 | الجنوبي | النوع | `boundary_south_type` | غير موجود | |
| 29 | الشرقي | الوصف | `boundary_east_description` | جزئي | eastBoundary اسم فقط، لا «وصف» منفصل |
| 30 | الشرقي | الطول | `boundary_east_length` | مستخدم | eastLength — تطابق تام |
| 31 | الشرقي | النوع | `boundary_east_type` | غير موجود | |
| 32 | الغربي | الوصف | `boundary_west_description` | جزئي | westBoundary اسم فقط، لا «وصف» منفصل |
| 33 | الغربي | الطول | `boundary_west_length` | مستخدم | westLength — تطابق تام |
| 34 | الغربي | النوع | `boundary_west_type` | غير موجود | |

### أنظمة تحديد المواقع

| # | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|
| 35 | الإحداثيات | `geo_coordinates` | مستخدم | coordinatesDisplay |
| 36 | خط الطول | `geo_longitude` | مستخدم | mapLongitude |
| 37 | خط العرض | `geo_latitude` | مستخدم | mapLatitude |
| 38 | زوم الخريطة | `geo_map_zoom` | غير موجود | |
| 39 | زوم الصور الجوية | `geo_aerial_zoom` | غير موجود | |
| 40 | موقع الدبوس على الخريطة | `geo_map_pin` | مستخدم | mapCoords «الموقع على الخارطة (إحداثيات)» |

### معلومات المعاينة

| # | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|
| 41 | المعاين | `inspection_inspector` | مستخدم | partyFieldInspector / responsiblePersonName |
| 42 | التوقيع المعتمد | `inspection_authorized_signature` | مستخدم | sigApprover «توقيع — المعتمد» |
| 43 | تاريخ التقييم الفعلي (م) | `inspection_actual_valuation_date` | مستخدم | appraisalDate |
| 44 | تاريخ المعاينة - تاريخ الإيداع | `inspection_report_deposit_date` | جزئي | تاريخ المعاينة موجود، «تاريخ الإيداع» غير موجود |

### تفاصيل التشطيبات (الأضعف تغطية — 7%)

| # | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|
| 45 | نوع التشطيب | `finishing_type` | غير موجود | |
| 46 | الهيكل الإنشائي | `finishing_structure` | جزئي | structuralCondition «الحالة الإنشائية» أقرب مفهوم |
| 47 | الواجهة الشمالية | `finishing_facade_north` | جزئي | حقل «الواجهة» واحد عام فقط، بلا اتجاهات |
| 48 | الواجهة الجنوبية | `finishing_facade_south` | جزئي | نفس الملاحظة أعلاه |
| 49 | الواجهة الشرقية | `finishing_facade_east` | جزئي | نفس الملاحظة أعلاه |
| 50 | الواجهة الغربية | `finishing_facade_west` | جزئي | نفس الملاحظة أعلاه |
| 51 | أرضيات المداخل | `finishing_floors_entrance` | غير موجود | |
| 52 | أرضيات الغرف | `finishing_floors_rooms` | غير موجود | |
| 53 | أرضيات الأحواش | `finishing_floors_yards` | غير موجود | |
| 54 | أرضيات الاستقبال | `finishing_floors_reception` | غير موجود | |
| 55 | نوع النوافذ | `finishing_window_type` | غير موجود | |
| 56 | الأبواب الخارجية | `finishing_external_doors` | غير موجود | |
| 57 | الأبواب الداخلية | `finishing_internal_doors` | غير موجود | |
| 58 | نوع العزل | `finishing_insulation_type` | غير موجود | |
| 59 | نوع الأسقف | `finishing_ceiling_type` | غير موجود | |
| 60 | جبس بالسقف | `finishing_gypsum_ceiling` | غير موجود | |
| 61 | حائط مزدوج | `finishing_double_wall` | غير موجود | |
| 62 | تكييف مركزي | `finishing_central_ac` | غير موجود | |
| 63 | تكييف منفصل | `finishing_split_ac` | غير موجود | |
| 64 | تكييف شباك | `finishing_window_ac` | غير موجود | |
| 65 | تكييف صحراوي | `finishing_desert_ac` | غير موجود | |
| 66 | العقار مؤثث | `finishing_furnished` | غير موجود | |
| 67 | العقار جاهز للسكن | `finishing_ready_for_living` | غير موجود | |
| 68 | يوجد مصعد | `finishing_elevators_count` | مستخدم | hasElevator — تطابق تام (كنعم/لا لا كعدد) |
| 69 | عدد أدوار المباني | `finishing_floors_count` | مستخدم | buildingFloors — تطابق تام |
| 70 | عدد المداخل | `finishing_entrances_count` | غير موجود | |
| 71 | عدد المسابح | `finishing_pools_count` | جزئي | hasPool نعم/لا فقط، لا عدد |
| 72 | عدد الجاكوزي | `finishing_jacuzzi_count` | غير موجود | |
| 73 | عدد الملحق | `finishing_annexes_count` | جزئي | annexTotal مساحة وليس عددًا |

### المرفقات

| # | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|
| 74 | صور العقار | `attachment_property_photos` | مستخدم | photoMainFacade/Entrance/Interior/Surroundings |
| 75 | مستندات | `attachment_documents` | مستخدم | مجموعة propertyDocumentsFields |
| 76 | شهادة/تقرير التقييم | `attachment_valuation_report` | مستخدم | reportFileName / certificateNumber |
| 77 | صور جوية | `attachment_aerial_photos` | غير موجود | |
| 78 | خريطة | `attachment_map` | غير موجود | لا مرفق خريطة مستقل |
| 79 | صورة قطعة الأرض | `attachment_plot_image` | غير موجود | |
| 80 | صورة المخطط | `attachment_plan_image` | مستخدم | planImageFileName / planPhoto |
| 81 | فيديو العقار | `attachment_property_video` | غير موجود | |
| 82 | عيوب العقار | `attachment_property_defects` | جزئي | «عيب ظاهر» ضمن تصنيفات الملاحظات فقط |
| 83 | مرفقات أخرى | `attachment_other` | مستخدم | otherDocumentFileNames |

### معلومات عامة

| # | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|
| 84 | عمر العقار | `general_property_age` | مستخدم | propertyAge |
| 85 | نوع الصك | `general_deed_type` | جزئي | deedStatus «حالة الصك» موجود، «نوع» لا |
| 86 | حالة البناء | `general_building_condition` | مستخدم | buildState — تطابق تام |
| 87 | حالة الإشغال | `general_occupancy_status` | مستخدم | occupancyState — تطابق تام |
| 88 | حدود المعاينة | `general_inspection_scope` | غير موجود | |
| 89 | استخدام العقار | `general_usage_type` | مستخدم | propertyUsage — تطابق تام |
| 90 | المنسوب | `general_elevation` | غير موجود | |
| 91 | نسبة اكتمال المبنى | `general_completion_pct` | غير موجود | |
| 92 | نوع التشطيب للمبنى | `general_building_finishing` | غير موجود | |
| 93 | هل تم عمل الرفع المساحي | `general_survey_done` | جزئي | حالة مرحلة الرفع المساحي موجودة، لا كسؤال نعم/لا مباشر |
| 94 | ملاحظات الرفع المساحي | `general_survey_notes` | مستخدم | surveyNotes — تطابق تام |
| 95 | هل تم استلام المفاتيح | `general_keys_received` | مستخدم | keysReceived |
| 96 | هل يوجد محضر إخلاء أو عقود إيجار | `general_eviction_or_leases` | جزئي | الإيجار موجود، «محضر إخلاء» غير موجود |
| 97 | ملاحظات محضر الإخلاء والعقود | `general_eviction_lease_notes` | غير موجود | |
| 98 | تم الوقوف عن طريق | `general_inspection_access_method` | جزئي | siteConfirmed «تأكيد الوقوف على الموقع» أقرب مفهوم |

### ميزات الموقع (0% مستخدم)

| # | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|
| 99 | مجاور مسجد | `site_near_mosque` | جزئي | «مساجد» ضمن قائمة مرافق ثابتة |
| 100 | مجاور مراكز طبية | `site_near_medical` | جزئي | «مستشفيات» ضمن نفس القائمة |
| 101 | مجاور مرفق أمني | `site_near_security` | غير موجود | غير مدرج في قائمة المرافق |
| 102 | مجاور سوق | `site_near_market` | جزئي | «أسواق تجارية» ضمن نفس القائمة |
| 103 | مجاور حديقة | `site_near_park` | جزئي | «حدائق» ضمن نفس القائمة |
| 104 | مجاور مدرسة | `site_near_school` | جزئي | «مدارس» ضمن نفس القائمة |
| 105 | مجاور مرفق حكومي | `site_near_government` | غير موجود | غير مدرج في قائمة المرافق |
| 106 | مجاور طريق سريع | `site_near_highway` | جزئي | «طرق رئيسية» أقرب مفهوم |

### الخدمات

| # | القسم الفرعي | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|---|
| 107 | — | توفر مياه | `service_water_available` | جزئي | «ماء» ضمن قائمة خدمات ثابتة |
| 108 | — | توفر هاتف | `service_phone_available` | جزئي | «هاتف / اتصالات» ضمن نفس القائمة |
| 109 | — | توفر كهرباء | `service_electricity_available` | جزئي | «كهرباء» ضمن نفس القائمة |
| 110 | — | توفر صرف صحي | `service_sewage_available` | جزئي | «صرف صحي» ضمن نفس القائمة |
| 111 | عدادات الكهرباء | نوع العداد | `service_electricity_meter_type` | مستخدم | meterType — تطابق تام |
| 112 | عدادات الكهرباء | عدد العدادات | `service_electricity_meter_count` | جزئي | رقم عداد واحد فقط (meterNumber)، لا عدّاد متعدد |
| 113 | عدادات الكهرباء | أرقام العدادات | `service_electricity_meter_numbers` | جزئي | نفس الملاحظة أعلاه |
| 114 | عدادات المياه | عدد العدادات | `service_water_meter_count` | جزئي | لا يوجد عداد مياه منفصل عن عداد الكهرباء |
| 115 | عدادات المياه | أرقام العدادات | `service_water_meter_numbers` | جزئي | نفس الملاحظة أعلاه |

### تحقق الصك والملاحظات (الأفضل تغطية بين الأقسام الكبيرة — 85%)

| # | القسم الفرعي | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|---|
| 116 | وجود ملحقات في المبنى | هل تم ذكر جميع الملاحظات عند عدم المطابقة | `building_annexes_notes_mentioned` | مستخدم | extra_0 |
| 117 | وجود ملحقات في المبنى | هل توجد ملاحظات فنية تؤثر على القيمة | `building_annexes_technical_notes_exist` | مستخدم | extra_1 / q_technical_notes_exists |
| 118 | وجود ملحقات في المبنى | هل توجد عوامل بيئية أو تنظيمية | `building_annexes_environmental_factors` | مستخدم | extra_2 / q_environmental_factors |
| 119 | خزانات المياه العلوية | هل يوجد إضافات غير مسجلة في الصك | `deed_unregistered_additions_exist` | مستخدم | extra_3 / q_unregistered_additions |
| 120 | السلالم | هل الصك ساري | `deed_is_valid` | مستخدم | deed_0 «هل الصك فعال» |
| 121 | السلالم | هل رقم القطعة مطابق للصك | `deed_plot_number_matches` | مستخدم | deed_1 — تطابق تام |
| 122 | السلالم | هل رقم المخطط مطابق للصك | `deed_plan_number_matches` | مستخدم | deed_2 / q_plan_match — تطابق تام |
| 123 | السلالم | هل القطعة فائض تنظيمي | `deed_regulatory_surplus` | مستخدم | deed_3 «زائدة تنظيمية» |
| 124 | السلالم | هل يوجد نزع | `deed_expropriation_exists` | مستخدم | deed_4 / q_expropriation |
| 125 | السلالم | هل الأرض موقوفة في الصك أو رخصة البناء | `deed_suspended` | مستخدم | deed_5 / q_land_waqf |
| 126 | السلالم | هل الأصل وقف أو انتفاع | `deed_endowment_or_benefit` | مستخدم | deed_6 / q_property_waqf |
| 127 | السلالم | هل تم التحقق من استخدام العقار | `deed_usage_verified` | مستخدم | deed_7 / q_property_use_verified |
| 128 | السلالم | هل تم الاستعلام من وزارة الزراعة | `deed_agriculture_ministry_checked` | مستخدم | deed_8 / q_agriculture_inquiry |
| 129 | السلالم | هل الصك مشترك | `deed_communal` | مستخدم | deed_9 / q_shared_deed «مشاع» |
| 130 | السلالم | في حال الصك المشترك: هل المساحة للعقار كامل أو جزء | `deed_communal_area_scope` | مستخدم | deed_10 |
| 131 | وجود ملحقات في المبنى | توضيح عدم المطابقة | `building_annexes_nonconformity_notes` | جزئي | لا حقل نص مستقل بهذا الاسم |
| 132 | وجود ملحقات في المبنى | توضيح الملاحظات الفنية | `building_annexes_technical_notes` | مستخدم | technical_notes_text |
| 133 | وجود ملحقات في المبنى | توضيح العوامل البيئية | `building_annexes_environmental_notes` | غير موجود | العلم Boolean موجود بلا حقل نص توضيحي |
| 134 | خزانات المياه العلوية | توضيح الإضافات غير المسجلة | `deed_unregistered_additions_notes` | غير موجود | نفس الملاحظة أعلاه |
| 135 | السلالم | توضيح اختلاف البيانات | `deed_discrepancy_notes` | مستخدم | assetDataVarianceNotes |

### الممر الخارجي (90%)

| # | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|
| 136 | هل يوجد بئر | `outer_well_exists` | مستخدم | comp_0 |
| 137 | هل يوجد غرفة كهرباء | `outer_electricity_room_exists` | مستخدم | comp_1 |
| 138 | هل يوجد أبراج كهرباء | `outer_electricity_towers_exist` | مستخدم | comp_2 |
| 139 | هل يوجد أبراج اتصالات | `outer_telecom_towers_exist` | مستخدم | comp_3 |
| 140 | هل يوجد مضخة دفاع مدني | `outer_civil_defense_pump_exists` | مستخدم | comp_4 |
| 141 | هل يوجد منقولات | `outer_movables_exist` | مستخدم | comp_5 / movables |
| 142 | هل يوجد مركبات | `outer_vehicles_exist` | مستخدم | comp_6 |
| 143 | هل يوجد معدات زراعية أو موجودات حيوية | `outer_agricultural_equipment_exists` | مستخدم | comp_7 |
| 144 | هل تم مطابقة مكونات العقار على الطبيعة مع التقرير والصك | `outer_components_match_deed_and_report` | مستخدم | comp_8 |
| 145 | ملاحظات المطابقة | `outer_match_notes` | جزئي | لا حقل نص مستقل بهذا الاسم |

### الأساسيات (الإشغال والإيجار — 88%)

| # | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|
| 146 | هل العقار مأهول بالسكان | `basic_occupied` | مستخدم | occ_0 «مأهول بالسكن» |
| 147 | هل يوجد عقد إيجار إلكتروني | `basic_electronic_lease_exists` | مستخدم | occ_4 |
| 148 | هل يوجد عقد إيجار ورقي | `basic_paper_lease_exists` | غير موجود | الإلكتروني فقط مغطّى |
| 149 | هل تم مطابقة رقم الصك بعقد الإيجار | `basic_deed_matches_lease` | مستخدم | occ_2 |
| 150 | هل عقد الإيجار ساري | `basic_lease_valid` | مستخدم | occ_3 / q_lease_active |
| 151 | هل يوجد عقد إيجار | `basic_lease_exists` | مستخدم | occ_1 / q_lease_exists |
| 152 | هل يوجد اتحاد ملاك | `basic_owners_association_exists` | مستخدم | occ_5 — تطابق تام |
| 153 | ملاحظات الإيجار والسكان | `basic_occupancy_notes` | مستخدم | occupancyRemarks |

### الاختبارات المطلوبة (88%)

| # | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|
| 154 | هل الصك مطابق للرفع المساحي | `required_test_survey_matches_deed` | مستخدم | survey_0 — تطابق تام |
| 155 | هل تم ذكر جميع الاختلافات في الرفع المساحي | `required_test_survey_discrepancies_mentioned` | مستخدم | survey_1 — تطابق تام |
| 156 | هل تم تطبيق تعليمات المركز | `required_test_survey_center_instructions_applied` | مستخدم | survey_2 |
| 157 | هل تم التوقيع وإرفاق إقرار صحة الموقع | `required_test_location_acknowledgment_signed` | مستخدم | survey_3 |
| 158 | هل يوجد تداخل في الأصل | `required_test_overlap_exists` | مستخدم | survey_4 / q_overlap |
| 159 | هل يوجد على الأصل صك مشترك | `required_test_joint_deed_exists` | مستخدم | survey_5 «مبنى مشترك» |
| 160 | هل تم ذكر المرجع المعتمد لاستخدام العقار | `required_test_usage_reference_mentioned` | مستخدم | survey_6 |
| 161 | ملاحظات الاختبارات | `required_test_notes` | غير موجود | |

### تقييم عام

> ملاحظة: أرقام الصفوف هنا (225–239) هي أرقام الصفوف الأصلية في ملف Excel، وليست متسلسلة مع الأقسام السابقة — الملف المصدر يحتوي فجوات في الترقيم بين الصف 161 والصف 225.

| # | القسم الفرعي | الحقل | field_key | الحالة | ملاحظة |
|---|---|---|---|---|---|
| 225 | — | مساحة المباني | `eval_building_area` | مستخدم | buildingsTotal |
| 226 | — | عدد أدوار المباني | `eval_floors_count` | مستخدم | buildingFloors |
| 227 | — | رأي المقيم العقاري | `eval_appraiser_opinion` | جزئي | evaluatorNotes «ملاحظات» موجود، لا حقل «رأي» مصنّف |
| 228 | — | غرض التقييم | `eval_purpose` | غير موجود | |
| 229 | — | أساس القيمة | `eval_value_basis` | مستخدم | valueBasis — تطابق تام |
| 230 | — | فرضية القيمة | `eval_value_hypothesis` | غير موجود | |
| 231 | الصيانة | العقار يحتاج إلى صيانة | `eval_needs_maintenance` | غير موجود | |
| 232 | الصيانة | وصف الصيانة | `eval_maintenance_description` | غير موجود | |
| 233 | الصيانة | تكلفة الصيانة | `eval_maintenance_cost` | غير موجود | |
| 234 | — | البيانات الختامية | `eval_closing_data` | مستخدم | closingNotes «ملاحظات ختامية» |
| 235 | — | المطابقة لرخصة البناء | `eval_building_permit_compliance` | غير موجود | |
| 236 | — | ملاحظات المطابقة لرخصة البناء | `eval_building_permit_notes` | غير موجود | |
| 237 | المنقولات | هل يوجد منقولات | `eval_movables_exist` | مستخدم | outer_movables_exist أيضًا يغطي نفس الفحص |
| 238 | المنقولات | وصف المنقولات | `eval_movables_description` | غير موجود | العلم Boolean موجود بلا وصف نصي |
| 239 | — | ملاحظات داخلية (لا تظهر للعميل) | `eval_internal_notes` | جزئي | internalNote موجود في سياق التعذرات فقط، لا عام |

---

## الخلاصة والتوصية

الفجوة الأكبر بوضوح هي قسم **تفاصيل التشطيبات** — 27 من أصل 29 حقلًا فيه إما غائب أو جزئي فقط. إذا كانت هذه البيانات مطلوبة لأغراض التقييم أو الرفع لمنصة إنفاذ، فهذا القسم يستحق الأولوية في أي عمل توسعة قادم لكتالوج الحقول.

الأقسام الثانوية للمتابعة: **معلومات العميل** (رقم الرخصة، تاريخها، بيانات التواصل المزدوجة) و**تقييم عام** (غرض التقييم، فرضية القيمة، بيانات الصيانة، المطابقة لرخصة البناء).

**نسخة تفاعلية قابلة للفلترة والبحث** من هذا التدقيق منشورة كـ Artifact: راجع الجلسة التي أنتجت هذا التقرير للحصول على الرابط.

**مصدر البيانات:** قراءة مباشرة لملف `docs/_حقول المقياس.xlsx` (176 صفًا، عمود `field_key` يخلو من أي تكرار حقيقي في المفاتيح — ما بدا تكرارًا للوهلة الأولى مثل «الوصف»/«الطول» أربع مرات هو فعليًا حقول مستقلة لكل جهة من حدود القطعة أو لكل نوع عدّاد).
