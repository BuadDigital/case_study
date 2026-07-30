# Pricing logic — التسعيرة والتسعير في النظام الحالي

> **آخر مراجعة:** 29 يوليو 2026  
> **النطاق:** كل منطق التسعيرة وأسعار أتعاب الأطراف وما يستهلكها أو يرتبط بها:
> الرفع المساحي، المعاينة الميدانية، المراجعة الحكومية، زيارة المحكمة، استلام
> المفاتيح، كشوف فوترة المكتب الهندسي، فوترة إنفاذ، الصرف، والملخص المالي.  
> **قاعدة هذا المستند:** السلوك الموصوف أدناه مشتق من الكود الحالي. المستند القديم
> `docs/الماليه/منطق-التسعيرة.md` يصف نموذج singleton سابقاً ولم يعد وصفه لبنية
> التسعيرة الحالية دقيقاً.

---

## جواب سريع: ما المقصود بـ «التسعيرة»؟

**التسعيرة** في المنتج الحالي هي مجموعة **جداول أسعار مسماة** (`PartyFeePricingTable`)
مقسّمة إلى ثلاث فئات:

1. `engineering-survey` — المكاتب الهندسية / الرفع المساحي، بسعر يعتمد على شريحة
   مساحة العقار.
2. `government-review` — المراجعون الحكوميون، وفيها سعر زيارة المحكمة وسعر استلام
   المفاتيح.
3. `field-inspector` — المعاينون الميدانيون المتعاونون، بسعر للفرد وسعر للمنشأة.

لكل فئة جدول افتراضي واحد (`IsActive = true`) ويمكن إسناد جدول بعينه لطرف محدد
(`AssigneeId`). عند نشوء استحقاق، يُحلّ الجدول المناسب ويُنسخ المبلغ إلى سجل مالي
مستقل. لا يبقى على السجل رابط إلى جدول التسعيرة الذي استُخدم؛ لذلك تعديل الجدول لاحقاً
لا يعيد تسعير السجلات القديمة.

مصادر التعريف والسلوك:

- `backend/RealEstateEval.Domain/PartyFeePricingTable.cs`
- `backend/RealEstateEval.Domain/PartyFeePricingTier.cs`
- `backend/RealEstateEval.Domain/PartyFeePricingAssignment.cs`
- `backend/RealEstateEval.Application/PartyFeePricingCategories.cs`
- `backend/RealEstateEval.Infrastructure/Services/PartyFeePricingService.cs`
- `backend/RealEstateEval.Domain/InspectorFeeLedger.cs`

---

## 1. قاموس المصطلحات — Arabic / English map

| المصطلح في الواجهة أو الكود | المعنى الفعلي |
|---|---|
| **التسعيرة** / fee pricing | إعداد جداول الأسعار الافتراضية والمخصصة للأطراف؛ الصفحة `fee-pricing` |
| جدول التسعير / pricing table | سجل مسمى من `PartyFeePricingTable` ينتمي إلى فئة واحدة |
| افتراضي للفئة / category default | الجدول ذو `IsActive = true`؛ fallback عند عدم وجود إسناد صريح، مع استثناء المكتب الهندسي الموضح لاحقاً |
| إسناد التسعيرة / pricing assignment | ربط `AssigneeId` بجدول واحد داخل الفئة عبر `PartyFeePricingAssignment` |
| سعر الجدول | المبلغ الذي حُلّ عند نشوء الاستحقاق ثم خُتم في `InspectorFeeLedger.AgreedFeeSar` |
| الأتعاب المتفق عليها / agreed fee | المبلغ المختوم على سجل الطرف؛ قد يكون من جدول أو إدخالاً يدوياً لمعاين موظف |
| الحسم / supervisor discount | `SupervisorDiscountSar` مع `DiscountReason`؛ ينقص من المتفق عليه |
| الصافي / net fee | `max(0, AgreedFeeSar - max(0, SupervisorDiscountSar))` |
| تعديل التسعير | تسمية واجهة لحسم المشرف على بند مكتب هندسي؛ لا يغيّر جدول التسعيرة |
| خلاف تسعير / pricing dispute | حالة `disputed` بعد اعتراض المكتب على الحسم؛ ليست كيان تفاوض مستقل |
| أتعاب الزيارة | `GovernmentReviewFeeSar`؛ تُختم في `CourtVisitFeeCharge` عند إكمال مهمة تشغيلية `court_visit` |
| أتعاب استلام المفاتيح | `KeyReceiptFeeSar`؛ تُختم في `KeyReceiptFeeCharge` عند إنشاء ظرف بسيناريو المحكمة |
| أتعاب المعاملة / أتعاب الأطراف | سجلات `InspectorFeeLedger` للمعاينة والرفع والمسار القديم للمراجعة الحكومية |
| كشف فوترة / billing statement | `EngineeringBillingStatement` يجمع صافي بنود مكتب هندسي جاهزة؛ ليس جدول تسعيرة |
| فوترة إنفاذ / Enfaz billing | إيراد يدخله موظف المالية لكل عقار: دراسة حالة + رفع، مع VAT؛ لا يُقرأ من جداول التسعيرة |
| سعر التقييم | `evaluatorPrice` الذي يدخله المقيم العقاري؛ قيمة تقييم العقار وليست أتعاب طرف ولا تسعيرة |
| الملخص / التقارير المالية | تجميع لاحق للإيرادات والتكاليف من السجلات المختومة؛ لا يحل أسعاراً جديدة |

مصادر ألفاظ الواجهة:

- `packages/app-shared/src/prototype/settings-nav.ts`
- `apps/mfe-financial/src/components/FinancePartyFeePricing.tsx`
- `apps/mfe-case-study/src/components/fees/PartyFeesWorkspace.tsx`
- `apps/mfe-case-study/src/components/fees/EngOfficeFeesBillingTable.tsx`
- `apps/mfe-case-study/src/components/fees/CourtVisitFeesPanel.tsx`
- `apps/mfe-keys/src/components/KeyEnvelopeFeesPanel.tsx`
- `apps/mfe-financial/src/components/FinanceWorkspace.tsx`
- `apps/mfe-evaluator/src/extensions/party-appraisal-extensions.tsx`

---

## 2. نموذج بيانات التسعيرة

### 2.1 `PartyFeePricingTable`

**الجدول:** `financial."PartyFeePricingTables"`

| الحقل | المعنى |
|---|---|
| `Id` | GUID للجدول |
| `Name` | اسم العرض، مطلوب، حتى 128 حرفاً؛ لا يوجد unique constraint |
| `Category` | إحدى الفئات الثلاث، حتى 32 حرفاً |
| `IsActive` | هل هو الافتراضي للفئة |
| `GovernmentReviewFeeSar` | سعر زيارة/مراجعة حكومية بالريال |
| `KeyReceiptFeeSar` | سعر استلام المفاتيح بالريال |
| `FieldInspectorIndividualFeeSar` | سعر معاين متعاون فرد |
| `FieldInspectorOrganizationFeeSar` | سعر معاين متعاون منشأة |
| `UpdatedAtUtc` | آخر تعديل؛ لا يمثل تاريخ بدء سريان |
| `AreaTiers` | شرائح الرفع المساحي التابعة |
| `Assignments` | الأطراف المسند إليها الجدول |

يوجد unique partial index على `Category` عندما `IsActive = true`، ولذلك قاعدة البيانات
تسمح بجدول افتراضي واحد فقط لكل فئة. لا يوجد حقل عملة عام؛ العملة مثبتة دلالياً في
أسماء `*Sar` وفي الواجهة كـ `ر.س`. لا توجد حقول `EffectiveFrom` / `EffectiveTo`، ولا
رقم إصدار.

### 2.2 `PartyFeePricingTier`

**الجدول:** `financial."PartyFeePricingTiers"`

| الحقل | المعنى |
|---|---|
| `Id` | GUID للشريحة |
| `TableId` | FK إلى جدول التسعيرة، حذف Cascade |
| `SortOrder` | ترتيب الشريحة |
| `MaxAreaM2` | الحد الأعلى الشامل بالمتر المربع؛ `null` للشريحة الأخيرة المفتوحة |
| `FeeSar` | أتعاب الشريحة |

الفهرس `(TableId, SortOrder)` غير unique. الخدمة تعيد ترتيب وتطبيع الشرائح عند الحفظ
بدلاً من الاعتماد على قيد قاعدة بيانات.

### 2.3 `PartyFeePricingAssignment`

**الجدول:** `financial."PartyFeePricingAssignments"`

| الحقل | المعنى |
|---|---|
| `Id` | GUID للإسناد |
| `TableId` | FK إلى جدول التسعيرة، حذف Cascade |
| `Category` | نسخة من فئة الجدول |
| `AssigneeId` | معرّف التوزيع للطرف، مثل `eo-jeddah` |
| `UpdatedAtUtc` | وقت تحديث الإسناد |

القيد unique على `(Category, AssigneeId)` يضمن أن الطرف لا يحمل أكثر من جدول واحد
داخل الفئة. لا يوجد FK من `AssigneeId` إلى ملف مستخدم؛ الربط نصي.

### 2.4 DTOs

`PartyFeePricingDto` يجمع بيانات الجدول، الشرائح، `AssignedCount`، وقائمة
`AssignedAssigneeIds`. ملخص القائمة `PartyFeePricingTableSummaryDto` يعيد الاسم
والفئة والحالة وعدد المسندين. الإنشاء يستخدم
`CreatePartyFeePricingTableRequest(Category, Name, CopyFromTableId)`، والإسناد يستخدم
`SetPartyFeePricingAssignmentsRequest.AssigneeIds`.

المصادر:

- `backend/RealEstateEval.Application/Contracts/PartyFeePricingDto.cs`
- `backend/RealEstateEval.Infrastructure/Data/ApplicationDbContext.cs`
- `backend/RealEstateEval.Infrastructure/Data/Migrations/20260721140000_PartyFeePricingTables.cs`
- `backend/RealEstateEval.Infrastructure/Data/Migrations/20260721150000_AddPartyFeePricingCategory.cs`
- `backend/RealEstateEval.Infrastructure/Data/Migrations/20260722101800_AddPartyFeePricingAssignments.cs`

---

## 3. الفئات والأسعار وقواعد الاختيار

### 3.1 الرفع المساحي — `engineering-survey`

السعر يعتمد على مساحة العقار. البذرة الحالية:

| المساحة | السعر |
|---|---:|
| حتى 500 م² | 300 ر.س |
| 501–1000 م² | 450 ر.س |
| 1001–1500 م² | 900 ر.س |
| 1501–10000 م² | 1500 ر.س |
| أكثر من 10000 م² | 4000 ر.س |

المقارنة مع `MaxAreaM2` شاملة (`area <= max`). إذا كانت الشرائح فارغة تُعاد شرائح
البذرة. التطبيع يضمن شريحة واحدة على الأقل، حدوداً موجبة متزايدة، مبلغاً غير سالب،
وشريحة أخيرة مفتوحة. الحدود غير المتزايدة تُرفع إلى `previous + 1` بدلاً من رفض
الطلب.

استخراج المساحة في `InspectorFeeService.ResolvePropertyAreaM2Async`:

1. مساحة العقار المرتبط مباشرة بالمهمة إن أمكن تحليلها.
2. وإلا تحميل عقارات الـ PO.
3. إذا وُجدت مساحة واحدة صالحة تُستخدم.
4. إذا تعددت المساحات الصالحة تُستخدم **أكبر مساحة**.
5. يقبل المحلل نصوصاً مثل `1200` و`1,250.5` ويحذف `م²` / `م2` والمسافات؛ المساحة
   الصفرية أو غير القابلة للتحليل لا تُقبل.

وجود `AssigneeId` لمكتب هندسي بلا إسناد جدول صريح ينتج **لا سعر** (`null`) ولا يسقط
بصمت على الجدول الافتراضي. عند قبول مخرجات الرفع تتحول هذه النتيجة إلى خطأ:
`تعذر تحديد الأتعاب من جدول التسعير — راجع ضبط الأسعار.` الجدول الافتراضي لا يُستخدم
لهذه الفئة إلا عندما يكون `assigneeId` فارغاً، وهو ليس المسار الطبيعي لمكتب موزع.

المصادر:

- `backend/RealEstateEval.Application/Rules/EngineeringSurveyFeeRules.cs`
- `backend/RealEstateEval.Infrastructure/Services/PartyFeePricingService.cs`
- `backend/RealEstateEval.Infrastructure/Services/InspectorFeeService.cs`
- `backend/RealEstateEval.Application.Tests/InspectorFeeRulesTests.cs`

### 3.2 المراجعة الحكومية وزيارة المحكمة — `government-review`

يحمل جدول الفئة مبلغين:

- `GovernmentReviewFeeSar`: أتعاب الزيارة.
- `KeyReceiptFeeSar`: أتعاب استلام المفاتيح.

المراجع يصنّف دائماً `متعاون فرد`. سعر البذرة/الاحتياط لكليهما 350 ر.س.

**أتعاب الزيارة:** عند إكمال `OperationsTask.Type == "court_visit"` تنشئ
`OperationsTaskService` سجلاً واحداً `CourtVisitFeeCharge`. تختار صاحب الاستحقاق من
`CreditAssigneeId` أو `AssigneeId`، ثم تحل جدولاً مسنداً لهذا المعرّف، وإلا الجدول
الافتراضي للفئة. إذا لم يوجد سعر أو كان `<= 0` تستخدم 350 ر.س. القيد unique على
`OperationsTaskId` وفحص الوجود يجعلان الإنشاء idempotent.

**المسار القديم:** مهام workflow ذات `Kind == "government-review"` ما زالت تستطيع
إنشاء `InspectorFeeLedger` عند اكتمال دراسة الحالة، ويُحل مبلغها من الفئة نفسها.

المصادر:

- `backend/RealEstateEval.Application/Rules/GovernmentReviewFeeRules.cs`
- `backend/RealEstateEval.Infrastructure/Services/OperationsTaskService.cs`
- `backend/RealEstateEval.Domain/CourtVisitFeeCharge.cs`
- `backend/RealEstateEval.Infrastructure/Data/ApplicationDbContext.cs`

### 3.3 استلام المفاتيح

عند إنشاء `KeyEnvelope` بسيناريو `court` فقط:

1. تقرأ `KeyEnvelopesService` الجدول **الافتراضي النشط** لفئة
   `government-review`.
2. تستخدم `KeyReceiptFeeSar` إذا كان أكبر من صفر.
3. وإلا تستخدم `GovernmentReviewFeeSar` إذا كان أكبر من صفر.
4. وإلا تستخدم 350 ر.س.
5. تختم المبلغ في كل من `KeyEnvelope.FeeAmountSar` و`KeyReceiptFeeCharge.AmountSar`.

هذا المسار **لا يستعمل `PartyFeePricingAssignment`** ولا يمرر معرّف مراجع؛ أي تسعيرة
مخصصة لمراجع لا تؤثر في أتعاب استلام المفاتيح. حالات بند التحصيل `open` و`collected`.
حذف الظرف يحذف بند الأتعاب صراحةً؛ لا توجد علاقة FK من البند إلى الظرف في إعداد
النموذج.

المصادر:

- `backend/RealEstateEval.Infrastructure/Services/KeyEnvelopesService.cs`
- `backend/RealEstateEval.Domain/KeyReceiptFeeCharge.cs`
- `backend/RealEstateEval.Application.Tests/KeyEnvelopesServiceTests.cs`

### 3.4 المعاين الميداني — `field-inspector`

تصنيف الطرف:

1. `ServiceProvider` أو `ProcProvider.ProviderKind == Organization` → `متعاون شركة`.
2. `Freelance` أو `ProviderKind == Individual` أو `EmploymentType` يحتوي `متعاون`
   → `متعاون فرد`.
3. ملف معروف لا يحقق ذلك → `موظف`.
4. إذا لم يوجد ملف: fallback قديم يجعل `fi-ahmed` متعاوناً فرداً، والباقي موظفين.

المتعاون الفرد يأخذ `FieldInspectorIndividualFeeSar`، والمنشأة تأخذ
`FieldInspectorOrganizationFeeSar`. المعاين `موظف` **خارج التسعيرة**:
`ResolveDefaultFeeAsync` يعيد `null` ويبدأ السجل بمبلغ صفر حتى يدخله مسؤول العمليات
يدوياً. لا يحتوي النموذج الحالي على سعر موظف.

المصادر:

- `backend/RealEstateEval.Application/Rules/InspectorFeeRules.cs`
- `backend/RealEstateEval.Infrastructure/Services/InspectorFeeService.cs`
- `apps/mfe-financial/src/components/FinancePartyFeePricing.tsx`

### 3.5 خوارزمية اختيار الجدول

للمهمة التي تنتمي إلى فئة:

```text
إن كان assigneeId غير فارغ وله Assignment في الفئة
    استخدم الجدول المسند، سواء كان افتراضياً أم غير افتراضي
وإلا إن كانت الفئة engineering-survey وassigneeId غير فارغ
    لا سعر
وإلا
    استخدم IsActive للفئة
```

ثم يختار `ResolveFromDto` الحقل أو شريحة المساحة المناسبة. نوع مهمة غير معروف يعيد
`null`. تسوية `Category` غير الصالحة في API لا ترفضها؛
`PartyFeePricingCategories.Normalize` يحولها إلى `engineering-survey`.

المصدر: `backend/RealEstateEval.Infrastructure/Services/PartyFeePricingService.cs`.

---

## 4. دورة حياة جدول التسعيرة

### 4.1 البذر والإصلاح الذاتي

كل عملية list/get/create/activate/delete/assign/resolve تقريباً تبدأ بـ
`EnsureAllCategoriesSeededAsync`:

- يضمن وجود فئات `engineering-survey`, `government-review`, `field-inspector`.
- إذا وجدت جداول في فئة بلا جدول نشط، يرقّي أول جدول أبجدياً بالاسم.
- إذا كانت الفئة فارغة، ينشئ `افتراضي` بمعرّف ثابت وبقيم البذرة.
- عند ترحيل البيانات القديمة، تنقل migrations أحدث singleton قديم إلى الجداول الجديدة.

بالتالي بعض عمليات **القراءة** قد تكتب إلى قاعدة البيانات لتصحيح فئة ناقصة أو بلا
نشط.

### 4.2 الإنشاء والنسخ

- ينشأ الجدول باسم مقصوص إلى 128 حرفاً؛ الفراغ يصبح `افتراضي`.
- إذا كانت الفئة بلا جداول يصبح الجديد نشطاً؛ عادةً تكون الفئات مبذورة، فينشأ غير نشط.
- `CopyFromTableId` ينسخ القيم/الشرائح من المصدر. إن لم يوجد المصدر ينسخ من النشط ثم
  الأحدث داخل الفئة.
- الواجهة تمرر الجدول المحدد داخل الفئة كمصدر.
- الخدمة لا تتحقق أن `CopyFromTableId` ينتمي إلى الفئة المطلوبة؛ عميل API مباشر يستطيع
  طلب نسخ عابر للفئات، وقد ينسخ حقولاً صفرية أو غير مقصودة.

### 4.3 التعديل

`SaveAsync` لا يسمح بتغيير الفئة أو `IsActive` من DTO:

- الرفع المساحي: يستبدل كل الشرائح بعد التطبيع.
- المراجعة الحكومية: يحفظ الزيارة والمفاتيح بعد clamp إلى `>= 0`.
- المعاين: يحفظ الفرد والمنشأة بعد clamp إلى `>= 0`.
- يحدّث الاسم و`UpdatedAtUtc`.

لا توجد optimistic concurrency على جداول/شرائح/إسنادات التسعيرة، ولا يحمل DTO
row-version؛ آخر حفظ يصل قد يكتب فوق تعديل سابق.

### 4.4 التفعيل

تفعيل جدول:

1. يحمل الجدول.
2. يعطل كل نشط آخر في الفئة.
3. يجعل المطلوب نشطاً.
4. يحفظ التغييرات مرة واحدة.

الـ partial unique index يحمي قاعدة البيانات من وجود افتراضيين في الفئة.

### 4.5 الإسناد

`SetAssignmentsAsync` هو **replace** لا append:

- trim، حذف الفراغ، وإزالة التكرار case-insensitive من الطلب.
- إزالة إسناد هذه الأطراف من أي جدول آخر في الفئة.
- حذف كل إسنادات الجدول الهدف.
- إنشاء القائمة الجديدة وتحديث `UpdatedAtUtc` في حفظ واحد.
- قائمة فارغة تفك جميع الإسنادات عن الجدول.

### 4.6 الحذف والترقية

- لا يمكن حذف آخر جدول في الفئة؛ API يعيد `400`.
- حذف جدول غير نشط يحذف شرائحه وإسناداته بـ cascade.
- حذف الجدول النشط يختار الجدول التالي **أبجدياً بالاسم** في الفئة ويجعله نشطاً.
- الحذف والترقية ينفذان ضمن `SaveChanges` واحد حتى لا تترك العملية الناجحة الفئة بلا
  افتراضي.
- يوجد اختبار مباشر لهذا السلوك في
  `backend/RealEstateEval.Application.Tests/MultiStepTransactionTests.cs`.

### 4.7 ليست Versioning زمنية

الاحتفاظ بعدة جداول يسمح بتبديل افتراضي أو تخصيص طرف، لكنه ليس versioning زمنياً:
لا effective dates، لا رقم إصدار، لا تاريخ تفعيل، ولا سجل audit خاص بالتسعيرة. كما أن
السجل المالي لا يحفظ `PricingTableId`، لذلك لا يمكن إثبات جدول المصدر من البيانات
الحالية بعد الختم.

المصدر الرئيسي للدورة:
`backend/RealEstateEval.Infrastructure/Services/PartyFeePricingService.cs`.

---

## 5. متى وكيف تُطبّق الأسعار؟

### 5.1 المعاينة والمراجعة الحكومية القديمة

عند انتقال مهمة `case-study-property` إلى `completed`، يستدعي
`WorkflowTaskService`:

`InspectorFeeService.EnsureLedgersForPropertyAsync(propertyId)`

فتُنشأ سجلات ناقصة لمهام `field-inspection` و`government-review` فقط. لكل سجل:

- يحل نوع الطرف والجدول والسعر الحالي وقت الإنشاء.
- يختم السعر في `AgreedFeeSar`.
- يبدأ `BillingStatus = draft`.
- يضع `AccruedAtUtc`, `CreatedAtUtc`, `UpdatedAtUtc`.
- لا يعيد تسعير سجل موجود.

توجد أيضاً عملية backfill عند تحميل ملخص الأتعاب، لكنها لا تنشئ إلا للعقارات التي
اكتملت دراسة حالتها.

المصادر:

- `backend/RealEstateEval.Infrastructure/Services/WorkflowTaskService.cs`
- `backend/RealEstateEval.Infrastructure/Services/InspectorFeeService.cs`

### 5.2 الرفع المساحي

لا ينشأ استحقاق عند رفع المكتب للملفات وحده. عند قبول الأخصائي لمخرجات
`engineering-survey`:

1. يجب أن يكون submission في `submitted`.
2. يجب أن تكون المهمة `completed`.
3. يحل السعر من جدول المكتب المسند ومن مساحة العقار.
4. يجب أن يكون السعر `> 0`.
5. ينشأ/يحدث `InspectorFeeLedger` في نفس transaction التي تثبت `AcceptedAtUtc`.
6. من دون حسم يصبح `at-finance` مباشرة؛ مع حسم سابق يصبح `office-review`.
7. يضاف `InspectorFeeTransition` بسبب «استحقاق عند قبول الأخصائي...».
8. إعادة القبول لا تنشئ رسماً ثانياً إذا كان السجل مستحقاً ومبلغه موجباً.

المصادر:

- `backend/RealEstateEval.Infrastructure/Services/PartyTaskSubmissionService.cs`
- `backend/RealEstateEval.Infrastructure/Services/InspectorFeeService.cs`
- `backend/RealEstateEval.Domain/InspectorFeeLedger.cs`

### 5.3 ختم السعر وعدم الرجعية

كل المستهلكين يخزنون مبلغاً مستقلاً:

- `InspectorFeeLedger.AgreedFeeSar`
- `CourtVisitFeeCharge.AmountSar`
- `KeyReceiptFeeCharge.AmountSar`

لا يحسب العرض هذه المبالغ من جدول التسعيرة الحي. لذلك تغيير أو تفعيل أو حذف جدول يؤثر
في الاستحقاقات **القادمة** فقط. الرفع المساحي يستخدم السعر الحي وقت قبول الأخصائي،
لا وقت توزيع المهمة أو رفع المكتب.

---

## 6. الحسم، «التفاوض»، والصرف

### 6.1 الصافي

```text
NetFeeSar = max(0, AgreedFeeSar - max(0, SupervisorDiscountSar))
```

`FeeDiscountModal` يقيد الحسم في الواجهة بين صفر والمبلغ المتفق ويتطلب سبباً إذا كان
الحسم موجباً. الخادم يطبق `>= 0` ويتحقق من وجود السبب، لكنه لا يرفض صراحةً حسماً أكبر
من المتفق؛ الصافي فقط يُثبّت عند صفر.

### 6.2 من يستطيع تغيير المبالغ؟

- `PATCH /api/inspector-fees/{workflowTaskId}` يتطلب `manage-operations`.
- `AgreedFeeSar` لا يقبل التعديل إلا إذا كان `InspectorType == موظف`.
- الحسم والاستبعاد قابلان للتعديل في الحالات التي تصنفها
  `InspectorFeeBillingRules.IsEditableStatus`.
- للرفع المساحي، إضافة حسم تنقل البند إلى `office-review`; إزالة الحسم تعيده إلى
  `at-finance` في الحالات المدعومة.

المعنى الدقيق: **مسؤول العمليات** يعدل مبلغ سجل معاين الموظف؛ ليس للموظف نفسه حق
التعديل لمجرد كونه صاحب السجل.

### 6.3 خلاف تسعير المكتب الهندسي

المسار المنفذ هو workflow حالات، لا محرك تفاوض:

```text
سعر جدول بلا حسم → at-finance
حسم مشرف → office-review
موافقة المكتب → at-finance
اعتراض المكتب + سبب → disputed
حسم الخلاف بواسطة مسؤول العمليات → at-finance
```

`resolve-dispute` لا يحسب مبلغاً تفاوضياً جديداً تلقائياً. المبلغ يظل
`AgreedFeeSar - SupervisorDiscountSar` ما لم يعدل مسؤول العمليات الحسم عبر PATCH.
أثر الحوار المتاح هو `DiscountReason` وأسباب `InspectorFeeTransition`؛ لا يوجد جدول
Negotiation أو عروض أسعار متبادلة.

### 6.4 حالات أتعاب الأطراف

`draft`, `office-review`, `disputed`, `sup-review`, `at-finance`, `deferred`,
`in-statement`, `disb-req`, `disbursed`, `returned`, `inquiry`.

التسعيرة تحدد المبلغ الابتدائي فقط؛ بقية الحالات تدير الاعتماد والتجميع والصرف.

المصادر:

- `backend/RealEstateEval.Application/Rules/InspectorFeeRules.cs`
- `backend/RealEstateEval.Application/Rules/InspectorFeeBillingRules.cs`
- `backend/RealEstateEval.Domain/InspectorFeeBillingStatus.cs`
- `backend/RealEstateEval.Infrastructure/Services/InspectorFeeService.cs`
- `packages/app-shared/src/fees/FeeDiscountModal.tsx`
- `apps/mfe-case-study/src/components/fees/PartyFeeWorkflowTable.tsx`

---

## 7. الصلاحيات: من يدير ومن يقرأ؟

### 7.1 جداول التسعيرة نفسها

| الإجراء | الحماية الفعلية |
|---|---|
| فتح صفحة `/fee-pricing` من التنقل | صفحة `fee-pricing`؛ موجودة فقط لـ `cdo` في مصفوفة الصفحات |
| List / Get جدول عبر API | `[Authorize]` فقط؛ أي مستخدم مصادق يستطيع الطلب المباشر |
| Create / Save / Activate / Assign / Delete | سياسة `manage-system-config` |

في المصفوفة الحالية، `manage-system-config` يملكه `cdo` فقط (وكذلك هوية `CDO` أو
`Admin` التي تحل إلى super-admin). `general-manager` و`financial-officer` يملكان
`manage-financial` لكن **لا يملكان** `manage-system-config` ولا صفحة `fee-pricing`.
الواجهة تعرض تنبيه «عرض فقط — تعديل التسعيرة مقصور على المسؤول» إذا فُتح المكوّن دون
الصلاحية، لكن الوصول الطبيعي للصفحة أصلاً مقصور على `cdo`.

### 7.2 قراءة وإدارة السجلات الناتجة

| المجال | قراءة / إدارة |
|---|---|
| `InspectorFeeLedger` | الأطراف تقرأ سجلاتها فقط؛ أصحاب `manage-operations` والمالية يرون الأوسع. PATCH للمشرف/العمليات. انتقالات المكتب، المشرف، والمالية موزعة حسب الفعل |
| كشوف المكتب الهندسي | المالية تنشئ/تصدر/تقفل/ترحّل؛ المكتب يرى كشوفه الصادرة والمقفلة؛ مسؤول العمليات يرى الصادر وما بعده |
| أتعاب زيارة المحكمة | مسؤول العمليات يرى الجميع؛ الطرف غير المدير يُجبر على `CreditAssigneeId` الخاص به |
| أتعاب استلام المفاتيح | Controller كله يتطلب `read-key-data`؛ تعليم التحصيل يتطلب أيضاً `submit-party-work` |
| فوترة إنفاذ | القراءة `read-financial-data`; الحفظ والإصدار والتنزيل `manage-financial` |
| الملخص المالي | `manage-financial` |

تنبيه صلاحية حالي: زر «تأكيد التحصيل (المالية)» في واجهة المفاتيح يمر إلى endpoint
يحميه `submit-party-work` فوق `read-key-data`، بينما `financial-officer` لا يملك
`submit-party-work`. النص يقول «المالية»، لكن مصفوفة الصلاحيات لا تسمح لموظف المالية
وحده بتنفيذ الطلب.

المصادر:

- `backend/RealEstateEval.Infrastructure/Permissions/PlatformPermissionCatalog.cs`
- `backend/RealEstateEval.Application/Authorization/PlatformCapabilities.cs`
- `backend/services/financial/RealEstateEval.Financial.Api/Controllers/FinancialController.cs`
- `backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/InspectorFeesController.cs`
- `backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/EngBillingStatementsController.cs`
- `backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/OperationsTasksController.cs`
- `backend/services/operations/RealEstateEval.Operations.Api/Controllers/KeyEnvelopesController.cs`
- `backend/services/case-study/RealEstateEval.CaseStudy.Api/Controllers/EnfazBillingController.cs`
- `docs/USERS_ROLES_AND_TERMS.md`

---

## 8. API التسعيرة

الـ base route:

`/api/financial/v1`

| Method | Route | DTO / نتيجة | Authorization |
|---|---|---|---|
| GET | `/party-fee-pricing/tables?category=` | `PartyFeePricingTableSummaryDto[]`، حتى 100 | authenticated |
| GET | `/party-fee-pricing/{id}` | `PartyFeePricingDto` أو 404 | authenticated |
| POST | `/party-fee-pricing` | `CreatePartyFeePricingTableRequest` → DTO | `manage-system-config` |
| PUT | `/party-fee-pricing/{id}` | `PartyFeePricingDto` → DTO | `manage-system-config` |
| POST | `/party-fee-pricing/{id}/activate` | DTO | `manage-system-config` |
| PUT | `/party-fee-pricing/{id}/assignments` | `SetPartyFeePricingAssignmentsRequest` → DTO | `manage-system-config` |
| DELETE | `/party-fee-pricing/{id}` | 204 / 404 / 400 لآخر جدول | `manage-system-config` |

ملاحظات العقد:

- لا يوجد endpoint مستقل لـ `GET assignments`; قائمة المعرفات تأتي داخل DTO الجدول.
- `IPartyFeePricingService.GetActiveAsync` يبني DTO مدمجاً من الافتراضيات الثلاثة
  للتوافق القديم، لكن Controller الحالي لا يعرض route له.
- `Save` يتجاهل `request.Id`, `request.Category`, و`request.IsActive` لأغراض تغيير
  الهوية/الفئة/الحالة؛ المسار والكيان المخزن هما المرجع.
- عميل TypeScript في `packages/api-client/src/financial.ts` وwrapper في
  `apps/mfe-financial/src/lib/financial-api.ts`.

---

## 9. APIs المالية المرتبطة

هذه ليست CRUD للتسعيرة، لكنها تستهلك المبلغ المختوم أو تعرضه:

### أتعاب الأطراف

| Method / route | الغرض |
|---|---|
| `GET /api/inspector-fees` | الملخص والسجلات مع scoping للطرف |
| `GET /api/inspector-fees/{taskId}/transitions` | سجل انتقالات البند |
| `PATCH /api/inspector-fees/{taskId}` | المبلغ اليدوي للموظف، الحسم، الاستبعاد |
| `POST /api/inspector-fees/{taskId}/transition` | إجراء دورة الصرف |
| `POST /api/inspector-fees/batch-transition` | انتقال جماعي |
| `POST /api/inspector-fees/disbursement-batch` | إنشاء أمر صرف لطرف |

### كشوف المكتب الهندسي

| Method / route | الغرض |
|---|---|
| `GET /api/eng-billing-statements/ready-lines` | بنود `at-finance` / `deferred` |
| `GET /api/eng-billing-statements` | قائمة الكشوف scoped حسب الدور |
| `POST /api/eng-billing-statements` | إنشاء كشف |
| `POST /api/eng-billing-statements/{id}/issue` | مسودة → صادر |
| `POST /api/eng-billing-statements/{id}/close` | صادر → مصروف مع فاتورة وإيصال |
| `POST /api/eng-billing-statements/defer-lines` | ترحيل بنود لدورة لاحقة |

### المحكمة والمفاتيح

| Method / route | الغرض |
|---|---|
| `GET /api/operations-tasks/court-visit-fees` | تقرير أتعاب الزيارة |
| `GET /api/key-envelopes/fee-report` | تقرير استلام المفاتيح |
| `POST /api/key-envelopes/{id}/fee-collected` | تعليم بند الاستلام محصلاً |

### إنفاذ

| Method / route | الغرض |
|---|---|
| `GET /api/enfaz-billing/ready-pos-summary` | POs المكتملة القابلة للفوترة |
| `GET /api/enfaz-billing/{po}` | بنود PO |
| `PUT /api/enfaz-billing/{po}` | حفظ إدخال المالية اليدوي |
| `GET /api/enfaz-billing/tracking` | متابعة الإدخال |
| `POST /api/enfaz-billing/{po}/issue-invoice` | إصدار/استبدال رقم الفاتورة |
| `GET /api/enfaz-billing/{po}/invoice.pdf` | تنزيل PDF |
| `GET /api/enfaz-billing/{po}/properties/{propertyId}` | إيراد العقار |

---

## 10. واجهة المستخدم

### 10.1 صفحة الإعدادات `/fee-pricing`

المسار يربط `FeePricingView` بـ `FinancePartyFeePricing`.

أهم السلوك والتسميات:

- عنوان التنقل: **التسعيرة**.
- الفئات: **المكاتب الهندسية**، **المراجعين الحكوميين**،
  **المعاينين الميدانيين**.
- قائمة جداول لكل فئة مع badges: **افتراضي** وعدد المسندين.
- إجراءات: **إضافة**، **تعيين كافتراضي**، **إسناد**، **حذف**،
  **حفظ التسعيرة**.
- الرفع: جدول **شرائح المساحة** بأعمدة من/حتى/الأتعاب وإضافة/حذف شريحة.
- الحكومة: **أتعاب الزيارة — فرد** و**أتعاب استلام المفاتيح**.
- المعاين: **معاين — فرد** و**معاين — منشأة**، مع توضيح أن الموظف يدوي.
- نافذة الإسناد تعرض الأطراف المستخرجة من staff users و
  `DistributionAssigneeId`.
- زر الحذف يتعطل في الواجهة إذا لم يوجد إلا جدول واحد.
- عند إضافة جدول، الواجهة تطلب نسخه من الجدول المحدد حالياً.

المصادر:

- `apps/shell/src/components/views/FeePricingView.tsx`
- `apps/shell/src/components/views/PrototypePageView.tsx`
- `apps/mfe-financial/src/components/FinancePartyFeePricing.tsx`
- `packages/app-shared/src/prototype/settings-nav.ts`
- `packages/app-shared/src/prototype/constants.ts`

### 10.2 صفحة `/party-fees` — الأتعاب والصرف

الأدوار التي تملك الصفحة: `section-supervisor`, `field-inspector`,
`government-reviewer`, `engineering-office` إضافة إلى `cdo`.

- المعاين/المراجع: **عقاراتي وحالاتها**، **أتعاب المعاملة**،
  **أتعاب الزيارة** و**أتعاب استلام المفاتيح** للمراجع، **طلب صرف**،
  **المُعاد لي**.
- المكتب الهندسي: **تتطلب إجراءكم**، **جاهزة للفوترة**،
  **كشوف الفوترة الصادرة**.
- المشرف: **الأمور المالية**، **الحسم والمراجعة**، **كشوف الفوترة**،
  **أتعاب الزيارة**، **أتعاب استلام المفاتيح**.
- الجدول الهندسي يعرض **سعر الجدول**، **تعديل التسعير ومبرره**، **الصافي**،
  وموافقة/تحفظ المكتب.

المصادر:

- `apps/mfe-case-study/src/views/PartyFeesView.tsx`
- `apps/mfe-case-study/src/components/fees/PartyFeesWorkspace.tsx`
- `apps/mfe-case-study/src/components/field-inspection/InspectorFeesBillingTable.tsx`
- `apps/mfe-case-study/src/components/fees/EngOfficeFeesBillingTable.tsx`
- `apps/mfe-case-study/src/components/fees/EngOfficeBillingStatementsPanel.tsx`
- `apps/mfe-case-study/src/components/fees/CourtVisitFeesPanel.tsx`

### 10.3 صفحة `/financial` — التقارير المالية

`FinanceWorkspace` يعرض:

- **صرف الالتزامات**
- **فوترة المكتب الهندسي**
- **فوترة إنفاذ**
- **استعراض الأطراف**
- **التقارير**

صفحة التسعيرة ليست تبويباً هنا؛ هي إعداد مستقل للمسؤول. المالية تجمع وتدفع المبالغ
التي سبق ختمها، وتنشئ كشوف المكتب، وتدخل إيراد إنفاذ يدوياً.

المصادر:

- `apps/mfe-financial/src/components/FinanceWorkspace.tsx`
- `apps/mfe-financial/src/components/FinanceEngBillingStatements.tsx`
- `apps/mfe-financial/src/components/FinanceEnfazPoBilling.tsx`
- `apps/mfe-financial/src/components/FinancePartyDisburse.tsx`

### 10.4 إدارة المفاتيح

`KeyEnvelopeFeesPanel` يعرض:

- **تقرير أتعاب استلام المفاتيح**
- المبلغ وحالة **بانتظار التحصيل** / **محصّلة**
- **تأكيد التحصيل (المالية)**

يظهر داخل تجربة المفاتيح، ويعاد استخدامه في `PartyFeesWorkspace` للمراجع/المشرف.

---

## 11. مفاهيم مالية مرتبطة لكنها ليست «التسعيرة»

### 11.1 `InspectorFeeLedger` — المبلغ المطبق

هو سجل أتعاب property/task، وليس إعداد السعر. المفتاح هو `WorkflowTaskId`، ويحمل
الطرف والنوع والمتفق والحسم والحالة والاستبعاد وأمر الصرف وكشف المكتب ووقت الاستحقاق.
يملك optimistic concurrency (`xmin`) في EF، خلاف جداول التسعيرة.

### 11.2 كشف فوترة المكتب الهندسي

`EngineeringBillingStatement` يجمع بنود رفع مساحي جاهزة لنفس المكتب:

- كل line يخزن snapshot للصافي في `NetFeeSar`.
- لا يقبل بنداً مستبعداً أو غير `at-finance` / `deferred`.
- البند لا يدخل أكثر من كشف؛ `WorkflowTaskId` unique على lines.
- الإنشاء ينقل البنود إلى `in-statement`.
- الحالات: `draft → issued → closed`.
- الإقفال يتطلب رقم فاتورة محاسبية وإيصالاً كمرفق أو مرجع، ثم يجعل ledgers
  `disbursed`.
- المرجع `FN-CS-YYMMDD-NNN`، والعداد اليومي أقصاه 999.

التسعيرة تحدد المبلغ الأولي للـ ledger؛ الكشف يجمع الصافي لاحقاً ولا يعيد التسعير.

المصادر:

- `backend/RealEstateEval.Domain/EngineeringBillingStatement.cs`
- `backend/RealEstateEval.Infrastructure/Services/EngineeringBillingStatementService.cs`

### 11.3 فوترة إنفاذ — إيراد وارد

`PoEnfazRevenueLine` يحمل لكل عقار:

- `CaseStudyFeeSar` — دخل دراسة المعاملة.
- `SurveyFeeSar` — دخل الرفع.
- `IncludedInBilling`.

الموظف المالي يدخلها يدوياً بعد أن تصبح كل عقارات PO مكتملة أو ملغاة وفق مهامها.
الحساب الخلفي:

```text
Line = CaseStudyFeeSar + SurveyFeeSar
Subtotal = مجموع البنود المكتملة والمشمولة
VAT = round(Subtotal × 0.15, 2, AwayFromZero)
Total = Subtotal + VAT
```

لا يوجد استدعاء لـ `PartyFeePricingService` ولا علاقة بجدول المكتب الهندسي؛
`SurveyFeeSar` هنا **إيراد من إنفاذ**، بينما سعر شريحة الرفع **تكلفة/التزام للمكتب**.

المصادر:

- `backend/RealEstateEval.Domain/PoEnfazRevenueLine.cs`
- `backend/RealEstateEval.Infrastructure/Services/PoEnfazBillingService.cs`
- `apps/mfe-financial/src/components/FinanceEnfazPoBilling.tsx`

### 11.4 أتعاب الزيارة مقابل استلام المفاتيح

هما بندان مستقلان:

- `CourtVisitFeeCharge`: تكلفة تُستحق للمنفذ عند إكمال زيارة المحكمة.
- `KeyReceiptFeeCharge`: إيراد تحصيل من إنفاذ عند تسجيل ظرف المحكمة وصورته.

إنشاء الظرف لا ينشئ أتعاب زيارة، وإكمال الزيارة لا ينشئ أتعاب استلام. الاختبارات تثبت
الفصل في `OperationsTaskServiceTests` و`KeyEnvelopesServiceTests`.

### 11.5 سعر التقييم

`evaluatorPrice` مطلوب في إرسال المقيم العقاري ويعرض كـ **سعر التقييم** للأخصائي
للاسترشاد. لا يوجد مسار من هذا الحقل إلى `PartyFeePricingTable` أو
`InspectorFeeLedger`.

المصادر:

- `backend/RealEstateEval.Application/Rules/PropertyAppraisalSubmissionValidator.cs`
- `apps/mfe-evaluator/src/extensions/party-appraisal-extensions.tsx`
- `apps/mfe-case-study/src/components/po-intake/PropertyDetailAppraisalTab.tsx`

### 11.6 الملخص المالي

`FinancialReportService` لا يحل الأسعار؛ يجمع:

- تكاليف الأطراف من صافي `InspectorFeeLedger`.
- أتعاب الزيارة كتكلفة.
- إيراد إنفاذ + استلام المفاتيح كإيراد.
- هامش الربح = الإيراد - (تكاليف الأطراف الخارجية + أتعاب الزيارة).
- الالتزامات المعلقة من حالات ledgers غير المصروفة + زيارات `open`.

المصدر: `backend/RealEstateEval.Infrastructure/Services/FinancialReportService.cs`.

---

## 12. القيود والثوابت

1. ثلاث فئات فقط في الخدمة؛ قيمة فئة غير صالحة تتحول إلى `engineering-survey` بدلاً
   من رفضها.
2. جدول افتراضي واحد فقط لكل فئة، محمي بفهرس قاعدة بيانات.
3. لا يمكن حذف آخر جدول في فئة.
4. حذف الافتراضي يرقّي أول اسم أبجدياً في نفس الحفظ.
5. إسناد واحد كحد أقصى لكل `(Category, AssigneeId)`.
6. حذف الجدول يحذف الشرائح والإسنادات cascade.
7. مبلغ/حد سالب يطبّع إلى صفر أو إلى حد موجب متزايد؛ الطلب لا يُرفض غالباً.
8. الرفع يحتاج مساحة موجبة، سعراً موجباً، وإسناد جدول صريح للمكتب.
9. المعاين الموظف لا يأخذ سعراً من التسعيرة.
10. كل مبلغ يُختم مرة في سجل المستهلك؛ تغيير التسعيرة غير رجعي.
11. لا يحفظ أي مستهلك `PricingTableId` أو اسم/إصدار الجدول.
12. `AgreedFeeSar` للمتعاون لا يعدل عبر PATCH؛ المسموح هو الحسم.
13. الحسم الموجب يحتاج سبباً؛ الصافي لا يصبح سالباً.
14. بنود المكتب الهندسي ذات الحسم تحتاج موافقة/تحفظ المكتب قبل المالية.
15. زيارة المحكمة وظرف المفاتيح ينتجان بندين مختلفين وفريدين حسب المهمة/الظرف.
16. لا توجد effective dates، currency column، audit log للتسعيرة، أو optimistic
    concurrency على جداول التسعيرة.

---

## 13. حالات طرفية وفجوات مؤكدة

هذه ملاحظات على **السلوك الحالي** وليست قواعد عمل مقترحة:

1. **إسناد المكتب إلزامي عملياً:** العبارة «افتراضي للفئة» لا تعني fallback لمكتب
   هندسي له `AssigneeId`; من دون إسناد لا ينشأ سعر.
2. **المفاتيح تتجاهل الإسناد:** `KeyReceiptFeeSar` يؤخذ من الافتراضي الحكومي فقط،
   حتى لو كان للمراجع جدول مخصص.
3. **لا provenance:** السجلات المختومة لا تعرف أي جدول أو شريحة أنتجت المبلغ.
4. **لا concurrency للتسعيرة:** آخر حفظ يفوز. توجد `xmin` على ledgers والcharges
   والكشوف، لا على pricing tables/tiers/assignments.
5. **نسخ عابر للفئة ممكن من API:** `CopyFromTableId` لا يتحقق من تطابق الفئة.
6. **فئة غير صالحة لا تفشل:** تسقط إلى `engineering-survey`، ما قد يخفي خطأ عميل.
7. **GET قد يكتب:** ضمان البذور قد ينشئ/يفعل جداول أثناء list/get/resolve.
8. **الحسم فوق المتفق:** الواجهة تمنعه، لكن backend لا يرفضه صراحةً؛ الصافي يصبح صفر.
9. **نص زر تحصيل المفاتيح لا يطابق السياسة:** الواجهة تنسب التأكيد للمالية، لكن
   endpoint يحتاج `submit-party-work` الذي لا يملكه `financial-officer`.
10. **معاينة VAT في الواجهة:** `FinanceEnfazPoBilling` تستخدم
    `Math.round(subtotal * 0.15)` إلى ريال كامل، بينما backend يقرب إلى منزلتين
    (`AwayFromZero`). قد يختلف الإجمالي المعروض قبل الحفظ/إعادة التحميل عن الإجمالي
    المرجعي الخلفي عند وجود هللات.
11. **العقارات المحذوفة في فوترة إنفاذ:** `PoEnfazBillingService` يمر على
    `order.Properties` دون شرط `!IsRemoved`; قد تدخل عقارات محذوفة ناعماً في الجاهزية
    والعرض.
12. **تعليق area fallback لا يطابق التنفيذ حرفياً:** التعليق يقول
    `task property → sole property → max`، لكن التنفيذ بعد فشل العقار المباشر يأخذ
    مساحة واحدة إن وجدت وإلا أكبر مساحة من كل عقارات PO، ولا يفرض أن العقار «وحيد».
13. **اختبار الحذف يستخدم فئة غير رسمية:** `MultiStepTransactionTests` يستخدم
    `Category = "engineering"` ويثبت transaction فقط، لا validation الفئات الفعلية.
14. **لا endpoint للـ merged active DTO:** الخدمة تحتفظ بـ `GetActiveAsync` للتوافق،
    لكن Controller يعرض list/by-id فقط.

---

## 14. الاختبارات الموجودة

| الملف | ما يثبته |
|---|---|
| `backend/RealEstateEval.Application.Tests/InspectorFeeRulesTests.cs` | شرائح المساحة وحدودها، التطبيع، تحليل المساحة، تصنيف الأطراف، الصافي، حالات خلاف التسعير |
| `backend/RealEstateEval.Application.Tests/MultiStepTransactionTests.cs` | حذف الجدول النشط وترقية بديل في حفظ واحد |
| `backend/RealEstateEval.Application.Tests/OperationsTaskServiceTests.cs` | إنشاء أتعاب زيارة 350، idempotency، وصاحب استحقاق التنفيذ |
| `backend/RealEstateEval.Application.Tests/KeyEnvelopesServiceTests.cs` | إنشاء بند استلام، التحصيل، الحذف، وفصله عن أتعاب الزيارة |
| `backend/RealEstateEval.Application.Tests/PartyTaskSubmissionAcceptTests.cs` | قبول الرفع مع استحقاق موجود وidempotency مسار القبول |
| `backend/RealEstateEval.Api.IntegrationTests/FinancialApiWebApplicationFactory.cs` | stub لعقد خدمة التسعيرة في اختبارات API |

لا يظهر اختبار خدمة مباشر شامل لـ:

- اختيار جدول assignee مقابل الافتراضي لكل فئة.
- منع fallback للمكتب الهندسي غير المسند.
- CRUD/activation/assignment مع PostgreSQL والـ unique indexes.
- نسخ جدول عبر فئة مختلفة.
- عدم رجعية الأسعار بعد تعديل الجدول.
- تطابق VAT بين واجهة Enfaz والخادم.

---

## 15. خريطة الملفات

### التسعيرة

| الملف | الدور |
|---|---|
| `backend/RealEstateEval.Domain/PartyFeePricingTable.cs` | كيان الجدول |
| `backend/RealEstateEval.Domain/PartyFeePricingTier.cs` | شرائح المساحة |
| `backend/RealEstateEval.Domain/PartyFeePricingAssignment.cs` | إسناد الطرف |
| `backend/RealEstateEval.Application/PartyFeePricingCategories.cs` | الفئات والتطبيع |
| `backend/RealEstateEval.Application/Contracts/PartyFeePricingDto.cs` | عقود API |
| `backend/RealEstateEval.Application/Rules/EngineeringSurveyFeeRules.cs` | شرائح الرفع وتحليل المساحة |
| `backend/RealEstateEval.Application/Rules/GovernmentReviewFeeRules.cs` | تصنيف/احتياط الحكومة |
| `backend/RealEstateEval.Application/Rules/InspectorFeeRules.cs` | أنواع المعاين والصافي |
| `backend/RealEstateEval.Infrastructure/Services/PartyFeePricingService.cs` | CRUD، التفعيل، الإسناد، resolution |
| `backend/services/financial/RealEstateEval.Financial.Api/Controllers/FinancialController.cs` | endpoints |
| `apps/mfe-financial/src/components/FinancePartyFeePricing.tsx` | واجهة الإدارة |
| `packages/api-client/src/financial.ts` | عميل TypeScript |

### المستهلكون

| الملف | الدور |
|---|---|
| `backend/RealEstateEval.Infrastructure/Services/InspectorFeeService.cs` | ختم أتعاب workflow |
| `backend/RealEstateEval.Infrastructure/Services/OperationsTaskService.cs` | ختم زيارة المحكمة |
| `backend/RealEstateEval.Infrastructure/Services/KeyEnvelopesService.cs` | ختم استلام المفاتيح |
| `backend/RealEstateEval.Infrastructure/Services/EngineeringBillingStatementService.cs` | تجميع وصرف كشوف المكتب |
| `backend/RealEstateEval.Infrastructure/Services/PoEnfazBillingService.cs` | إيراد إنفاذ المنفصل |
| `backend/RealEstateEval.Infrastructure/Services/FinancialReportService.cs` | التجميع المالي |

---

## 16. مخطط التدفق

```mermaid
flowchart TB
  ADMIN["CDO / manage-system-config"] --> TABLES["PartyFeePricingTables<br/>3 categories"]
  TABLES --> ASSIGN["PartyFeePricingAssignments"]
  TABLES --> TIERS["Engineering area tiers"]

  ASSIGN --> RESOLVE["Resolve table by category + assignee"]
  TIERS --> RESOLVE
  TABLES --> RESOLVE

  RESOLVE -->|case-study completion| LEDGER["InspectorFeeLedger<br/>field / legacy government"]
  RESOLVE -->|specialist accepts survey| ENGLEDGER["InspectorFeeLedger<br/>engineering survey"]
  RESOLVE -->|court_visit completed| VISIT["CourtVisitFeeCharge"]
  TABLES -->|active government only<br/>court envelope created| KEY["KeyReceiptFeeCharge"]

  LEDGER --> NET["Agreed - discount = net"]
  ENGLEDGER --> NET
  NET --> DISB["Party disbursement"]
  ENGLEDGER --> STMT["EngineeringBillingStatement"]

  ENFAZ["Manual Enfaz revenue<br/>case study + survey + VAT"] --> SUMMARY["Financial summary"]
  KEY --> SUMMARY
  VISIT --> SUMMARY
  DISB --> SUMMARY
  STMT --> SUMMARY
```

---

## 17. خلاصة للمطوّر

- نقطة الإدارة: `/fee-pricing`، ويملكها `cdo` عبر `manage-system-config`.
- النموذج الحالي: جداول متعددة في ثلاث فئات، افتراضي واحد لكل فئة، وإسناد اختياري
  لكل طرف.
- الاستثناء الأهم: المكتب الهندسي ذو `AssigneeId` يحتاج إسناداً صريحاً؛ لا fallback.
- الاستحقاق يُختم على ledger/charge ولا يتغير رجعياً، لكن لا يحفظ مصدر الجدول.
- الرفع يُسعّر بالمساحة وقت قبول الأخصائي؛ المعاينة/المراجعة القديمة عند اكتمال دراسة
  الحالة؛ الزيارة عند إكمال `court_visit`; المفاتيح عند إنشاء ظرف المحكمة.
- كشوف المكتب الهندسي، فوترة إنفاذ، سعر التقييم، والملخص المالي مفاهيم مالية مرتبطة
  لكنها ليست جداول التسعيرة نفسها.
