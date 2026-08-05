# تقرير الفجوات — المطلوب مقابل المبني

> **التاريخ:** ٢٩ يوليو ٢٠٢٦
> **المرجع المطلوب:** `cursor_build_directive.md` · `users_module_spec.md` (v3) · `security_offline_spec.md`
> **مرجع الواقع:** فحص مباشر للكود (وليس نقلاً عن `pricing-logic.md`)
> **الطريقة:** فحص أربعة محاور على الكود القائم — كل بند بحكم صريح: **موجود** · **ناقص** · **يحتاج تعديل**، مع مسار الملف.

---

## ٠. الملخص التنفيذي

> **محدَّث ٢ أغسطس ٢٠٢٦** — النسب أدناه تعكس الكود الحالي وخطة §٦. الأقسام ١–٥ تحتها ما زالت تحتفظ بنص الفحص الأصلي (يوليو) وقد تُظهر بنوداً «ناقصة» أُنجزت لاحقاً؛ عند التعارض **يسود هذا الملخص و§٦**.

| الوحدة | الجاهزية | الخلاصة |
|---|---|---|
| التسعير (البنية + السلوك) | **~١٠٠٪** | ب١–ب٧ مُنجزة: لا بذرة/احتياط، ختم جدول، audit+concurrency، جمود المرتبط بأطراف، إخراج أتعاب المفاتيح من التسعيرة |
| البند المالي ودورة الصرف | **~١٠٠٪** (أ/ج + إيراد) | ج١–ج٩ مبنية؛ `PartyBillingStatement`؛ تفكيك ق٧؛ دورة إيراد إنفاذ MVP (إصدار→تحصيل + مفاتيح + تقادم)؛ `DisbursementBatch` متقاعد (410) |
| المصادقة | **~٧٠٪** | كلمة المرور والجلسات والقفل ومعدل الطلبات وHTTPS وبوابة الإنتاج — **ما زال ناقصاً:** OTP · الدخول بالجوال · أجهزة/WebAuthn · استعادة كلمة المرور |
| المستخدمون | **~٨٠٪** | قائمة وإنشاء و`PATCH` وفك قفل وتوحيد ملف (`RoleId` · جوال · مدينة · حالة بأربع قيم) وتدقيق عام — **ما زال ناقصاً:** دعوات · أجهزة · OTP · دخول بالجوال (مؤجّل د١–٣) |
| الإعدادات العامة (٦ تبويبات) | **~٩٥٪** | شركة · مقيم · أصول · تسعير · محاكم · مهل · اتصالات (`IOtpDeliveryService` + SMTP/SMS + اختبار إرسال) — دخول OTP الكامل مؤجّل د١–٣ |
| الصور (EXIF) | **~١٠٠٪** | مسار المعالجة + `photo_metadata` + مقارنة مسافة (>٥٠٠م ⇒ «خارج نطاق العقار») + «موقع غير متاح» — للأخصائي عند المراجعة فقط |
| العمل دون اتصال (مرحلة ٢) | **~١٠٠٪** | طابور outbox مشفّر + interceptor + prefetch + ظروف/إسناد/مناولة مفاتيح + Background Sync + لوحة مشرف «ظروف معلّقة» |

**أهم خمس مفاجآت في الفحص** — الخمس **مُعالجة** الآن، وتبقى هنا للسياق التاريخي:

1. ~~لا يمكن تعديل مستخدم~~ — **مُنجزة (أ٤)**: `PATCH /api/users/{id}` + `POST {id}/unlock` + شاشة التعديل + `StaffUserUpdateTests`.
2. ~~الدور ليس عموداً~~ — **مُنجزة (أ٣)**: `UserProfile.RoleId` عمود صريح، ومطابقة المسمى بقيت لتوافق البذر فقط.
3. ~~بند «خلاف تسعير» يظهر للمالية~~ — **مُنجزة (ج١)**: `hideDisputed` في القائمة والمجاميع، واستثناؤه من مجاميع الملخص المالي ومن سجل الانتقالات للمالية.
4. ~~HTTPS غير مُعدّ~~ — **مُنجزة (أ١)**: TLS عند nginx (`:443` + شهادة المضيف + `308` من `:80`) و`X-Forwarded-Proto`، و`login-username` يرجع 404 في الإنتاج باختبار تكامل.
5. ~~مهلة التسليم تُعاد حسابها~~ — **مُنجزة (أ٥)**: `UpdateHeaderAsync` لا يعيد حساب `DueDateAt`؛ الختم عند الاستلام فقط.

---

## ١. وحدة المستخدمين

### موجود

| البند | الموضع |
|---|---|
| ASP.NET Identity في schema `identity` | `20260514092140_InitialIdentity` · `20260617145650_SplitDatabaseSchemas` |
| `ApplicationUser` (يضيف `DisplayName` فقط فوق IdentityUser) | `backend/RealEstateEval.Domain/ApplicationUser.cs:5` |
| `UserProfile`: `ContractType` · `DistributionAssigneeId` · `ReviewerCityCoverageJson` · `PermissionLevel` · `Status` | `backend/RealEstateEval.Domain/UserProfile.cs:3` |
| `HrEmployeeProfile`: `EmploymentType` · `Department` · `Section` · `NationalId` · `JoinDate` | `backend/RealEstateEval.Domain/HrEmployeeProfile.cs:3` |
| `ProcServiceProviderProfile`: `Iban` · `VatRegistration` · `CommercialRegistration` · `ProviderKind` | `backend/RealEstateEval.Domain/ProcServiceProviderProfile.cs:3` |
| عشرة أدوار (kebab-case) + ١٢ صلاحية + ٢٨ صفحة، مكرّرة على الجهتين | `PlatformPermissionCatalog.cs:6-134` · `packages/types/src/navigation.ts:2-79` |
| القسم يُشتق من الدور عند الإنشاء | `UserRegistrationService.cs:485-552` (`StaffRoleDefaults.For`) |
| قائمة المستخدمين + إنشاء + حذف | `apps/mfe-settings/src/views/users/UsersOrganizationView.tsx` |
| ملف المستخدم (عرض فقط) + ملفي الشخصي | `UserProfileModal.tsx` · `UserProfileContent.tsx` · `ProfileView.tsx` |
| صلاحيات الحقول: حقل ← دور ← شاشات ← `input/view` + `required` | `packages/app-shared/src/prototype/field-dictionary/types.ts:36` |
| سجل تدقيق حقيقي بـ before/after — **للمحاكم فقط** | `CourtAuditLog.cs:4` · يُكتب من `CourtsService.cs:631` |

### ناقص

| البند | الملاحظة |
|---|---|
| جدول مستخدمين موحّد بحقول المواصفة | مبعثر على أربعة كيانات؛ والناقص فعلياً: `mobile` كمعرّف دخول · `city` · `avatar` · `has_compensation` · `fee_value` · `iban` للموظف الداخلي |
| `status` بأربع قيم | `UserStatus` فيه `Active`/`Inactive` فقط — لا `pending_activation` ولا `locked` (القفل في `LockoutEnd` من Identity) |
| **تعديل مستخدم** | لا endpoint أصلاً: `UsersController.cs:27-90` = `GET /` · `GET /organization` · `POST /` · `DELETE /{id}` · `DELETE /registered` |
| `invitations` | غير موجود. البديل الحالي: الإنشاء يُرجع **كلمة مرور مؤقتة نصاً** في الاستجابة (`UserRegistrationService.cs:294,464`) وتُعرض مرة واحدة في الشاشة (`UsersOrganizationView.tsx:313`) |
| `devices` | غير موجود. أقرب قالب بنيوي جاهز: `RefreshToken.cs:7` (فيه `SessionId` · `TokenHash` · `ExpiresAtUtc` · `RevokedAtUtc` · `RevokedReason`) |
| `audit_log` عام | لا يوجد. شاشة «سجل التدقيق» **localStorage بسقف ٢٠٠ سطر** وبلا before/after (`packages/app-shared/src/audit/audit-log-store.ts:12`) ومخفية خلف feature flag |
| شاشة الدعوة/وضع كلمة المرور · استعادة كلمة المرور | لا مسار ولا معرّف صفحة ولا مكوّن |
| سجل الأعمال · التبويب المالي في الملف | لا شيء منهما |
| دور «منسق العمليات» | غير موجود (أُزيل دور منسق التقييم بالكامل) |

### يحتاج تعديل

| البند | الحالي | المطلوب |
|---|---|---|
| اشتقاق الدور | مطابقة نص عربي حرفياً لـ `JobTitle`؛ عدم المطابقة ⇒ دور `null` وصلاحية واحدة | عمود `role` صريح (enum) |
| أسماء الأدوار | `case-specialist` · `real-estate-appraiser` · `financial-officer` | v3 يسميها `case_study_specialist` · `real_estate_evaluator` · `finance` — **قرار: نعتمد أسماء الكود أو نعيد التسمية؟** |
| `engineering-office` | غير قابل للإنشاء من شاشة المستخدمين (خارج `CreatableStaffRoleIds`) | المواصفة: شاشة تسجيل واحدة لجميع الأدوار |
| مدير النظام | ليس دوراً؛ يتحقق عملياً بـ `cdo` أو Identity role `Admin` | يحتاج حسماً — هو الفاعل في كل مسار في المواصفة |

---

## ٢. المصادقة والأمان

### موجود — وأقوى من المتوقع

| البند | القيمة الحالية | مقابل المواصفة |
|---|---|---|
| قفل الحساب | ٥ محاولات ← ١٥ دقيقة (`DependencyInjection.cs:84-95`) | **مطابق تماماً** لـ security §١.٣ |
| سياسة كلمة المرور | ١٢ حرفاً + رقم + حالتان + رمز | أقوى من المطلوب |
| JWT | ١٥ دقيقة (`JwtTokenService.cs:15`) | — |
| Refresh token | ١٢ ساعة · مخزَّن SHA-256 · تدوير كل استخدام · إعادة الاستخدام تقتل عائلة الجلسة (`AuthSessionService.cs:28-89`) | يخدم قاعدة «إنهاء الجلسات عند التعطيل» — يُعاد فحص `Status == Active` عند كل تجديد (`:216`) |
| حد معدل الطلبات على مسارات الدخول | ١٠ طلبات/٦٠ ثانية إنتاجاً (`RateLimitingExtensions.cs:34-39`) | يخدم «٣ طلبات رمز/ساعة» جزئياً |
| رؤوس الأمان + HSTS | CSP · `X-Frame-Options: DENY` · HSTS سنة (`SecurityHeadersMiddleware.cs:41-99`) | — |

### ناقص كلياً

بحث في المستودع كله عن `otp` · `webauthn` · `passkey` · `fingerprint` · `twilio` · `sms` · `IEmailSender` · `smtp` — **لا نتيجة في الكود، فقط في ملفات المواصفة**.

- OTP بأي قناة · مزوّد رسائل · إرسال بريد
- WebAuthn/Passkeys · جدول `devices` · بصمة الجهاز
- **قاعدة الأربع ساعات** (تستلزم `devices.last_verified_at`)
- الدخول بالجوال: `PasswordLoginRequest` يقبل `Username` + `Password` فقط، و`PhoneNumber` لا يُستخدم في البحث ولا يُملأ عند الإنشاء
- استعادة كلمة المرور
- تدقيق الدخول والخروج والمحاولات الفاشلة

### يحتاج تعديل

- **معرّف الدخول:** الشاشة تطلب البريد (`apps/shell/src/app/login/page.tsx`) وترسله في حقل `username` لأسباب توافق. التحويل إلى الجوال = تغيير كاسر يمس البذرة (١١ مستخدماً) والشاشة والخدمة.
- **HTTPS:** لا `Kestrel` في أي `appsettings`، لا شهادة، لا `443` في `infra/`، و`infra/nginx.conf:56` = `listen 80;`. الثابت الأول في التوجيه §٦ غير محقق فعلياً.
- **مسار dev خطر:** `POST /api/auth/login-username` يدخل **بلا كلمة مرور** (مقيّد بـ `IsDevelopment() && Auth:EnableDevLogin` — `AuthController.cs:67,119`). يجب التأكد أنه لا يُفعّل إنتاجاً.

---

## ٣. التسعير — التعديلات الأربعة وفجوات §١٣

البنية القائمة مطابقة لما وصفه `pricing-logic.md`: ٧ endpoints تحت `/api/financial/v1` + عميل TS + شاشة إدارة كاملة (`FinancePartyFeePricing.tsx`) + فهرس فريد جزئي على الافتراضي + ترقية أبجدية عند حذف النشط. **لا يُعاد بناؤها.**

### م١ — حذف كل قيم البذرة والاحتياط

| الموضع | القيم |
|---|---|
| `Rules/EngineeringSurveyFeeRules.cs:11-30` | حدود ٥٠٠/١٠٠٠/١٥٠٠/١٠٠٠٠ وأتعاب ٣٠٠/٤٥٠/٩٠٠/١٥٠٠/٤٠٠٠ |
| نفس الملف `:48-52` | `NormalizeTiers([])` **يستبدل الفراغ بالبذرة كاملة** — أخطر نقطة: جدول فارغ يُنتج أسعاراً |
| `Rules/GovernmentReviewFeeRules.cs:11-16` | `FallbackFeeSar = 350` |
| `Services/KeyEnvelopesService.cs:20` | `DefaultKeyReceiptFeeSar = 350` |
| `Rules/InspectorFeeRules.cs:16-17` | **٤٠٠ للمعاين المتعاون فرداً و٥٠٠ للمنشأة** — لم يذكرها التوجيه صريحاً لكن قاعدة «لا بذرة» تشملها |
| `PartyFeePricingService.cs:107-133` · `:440-459` | إنشاء الجدول والبذر يعيدان كل الاحتياطات |
| `PartyFeePricingService.cs:476-489` · `:570-593` | **بديل صامت:** سعر المفاتيح إذا كان صفراً يُستبدل بسعر الزيارة |
| `OperationsTaskService.cs:690-726` | يفرض ٣٥٠ **مرتين** (عند null وعند `<= 0`) ⇒ زيارة المحكمة لا يمكن أن تفشل لنقص سعر |
| `KeyEnvelopesService.cs:1007-1020` | سلسلة: سعر المفاتيح ← سعر الزيارة ← ٣٥٠ |
| `InspectorFeeService.cs:49-82` | `?? 0m` ثم إنشاء البند بلا خطأ (معاينة ومراجعة حكومية) |
| ٥ ملفات migration | تحمل نفس الأرقام (بذر تاريخي — تحتاج سياسة صريحة) |

الرسالة الصريحة `تعذر تحديد الأتعاب من جدول التسعير — راجع ضبط الأسعار.` موجودة في موضع **واحد فقط**: `InspectorFeeService.cs:126`. التعميم المطلوب يشمل: الزيارة · المعاينة · المراجعة الحكومية · وأي شريحة فارغة.
لا مرآة TS للأرقام (الواجهة تبدأ بحد ٥٠٠ وأتعاب صفر — `FinancePartyFeePricing.tsx:88-109`).

### م٢ — إخراج أتعاب المفاتيح من التسعيرة

`KeyReceiptFeeSar` في ٨ مواضع: الكيان (`PartyFeePricingTable.cs:16`) · DTO خلفي وأمامي · الخدمة (٥ مواضع) · `ApplicationDbContext.cs:766` · ٣ migrations · حقل في الشاشة (`FinancePartyFeePricing.tsx:729-778`).

الختم يحدث لسيناريو `court` فقط في `KeyEnvelopesService.cs:271-297` ويكتب في **مكانين**: `KeyEnvelope.FeeAmountSar` و`KeyReceiptFeeCharge.AmountSar`.

**ما ينكسر إذا أُزيل الختم وبقي التسجيل مؤشر استحقاق:**
- `/api/key-envelopes/fee-report` يرجع فارغاً (إلا احتياط `FeeAmountSar` القديم — `:63-82`)
- `/fee-collected` يرد `بند الأتعاب غير موجود لهذا الظرف`
- `KeyEnvelopeFeesPanel` يفرغ
- **`FinancialReportService.cs:91-140` يفقد بند إيراد «أتعاب استلام مفاتيح»** — يدخل حساب الربح
- توست `RegisterKeyEnvelopeModal.tsx:409` ودلالة `FeeGenerated` يصبحان مضلّلين ⇒ يُستبدل بعلم غير مالي واضح الاسم
- تحتاج **سياسة صريحة للسجلات التاريخية**

### م٣ — الجدول المرتبط بأطراف لا يُعدَّل

`SaveAsync` (`PartyFeePricingService.cs:141-180`) يحمّل الجدول بالمعرّف ويعدّله في مكانه **بلا أي استعلام عن الإسنادات**؛ ولجداول الرفع **يحذف كل الشرائح ويُدخل بدائل** (`:503-525`). المعرّف نفسه يبقى مربوطاً بكل الأطراف.
`CreateAsync` ينسخ القيم والشرائح لكن **لا ينسخ الإسنادات** (`:85-134`) — يجب تحديد سلوك إعادة الربط الذرّي.

### م٤ — حوافز الموظف والمراجع الحكومي

المسار الحالي للموظف: تصنيف افتراضي `موظف` (`InspectorFeeService.cs:1310-1335`) ← الحل يعيد null (`PartyFeePricingService.cs:337`) ← بند بصفر ← تعديل يدوي بـ `PATCH` مقصور على `InspectorType == موظف` (`InspectorFeeService.cs:364-381`) بصلاحية `manage-operations`.

غير موجود إطلاقاً: نوع جدول `flat` · مبلغ يديره المشرف · `has_compensation` · `incentive_suspensions` · علم إيقاف على البند. (`PartyFeePricingTable` بلا مميّز نوع تسعير.)

المراجع الحكومي: `متعاون فرد` **دائماً وبلا شرط** (`InspectorFeeService.cs:1302-1308`).
حقل مبلغ الزيارة عند إنشاء المهمة: **غير موجود** في ثلاثة مواضع — `OperationsTaskDtos.cs:124-153` · `packages/api-client/src/operations-tasks.ts:100-112` · `CreateOperationsTaskModal.tsx:420-432`. المبلغ يُحل عند **الإكمال** لا الإنشاء.

### فجوات §١٣ — كلها مؤكَّدة

| # | الحالة | الإغلاق |
|---|---|---|
| ف١ | لا `PricingTableId` في أي مستهلك (`InspectorFeeLedger` · `CourtVisitFeeCharge` · `KeyReceiptFeeCharge`) | عمود + ختم مع المبلغ |
| ف٢ | لا audit للتسعيرة؛ والخدمة **لا تستقبل معرّف فاعل** ⇒ تغيير توقيعات | القالب الجاهز: `CourtAuditLog` + نمط `CourtsService.cs:624-640` |
| ف٣ | لا row-version على الجداول/الشرائح/الإسنادات؛ وهي غائبة عن `20260729104156_AddOptimisticConcurrencyTokens` | القدوة: `ApplicationDbContext.cs:345,638,653` — وتحديث `OptimisticConcurrencyConfigurationTests` |
| ف٤ | `PartyFeePricingCategories.Normalize:9-13` يحوّل أي قيمة خاطئة إلى `engineering-survey` — موضعان: القائمة والإنشاء | ٤٠٠ من `FinancialController.cs:37-55` |
| ف٥ | `CreateAsync` لا يتحقق من فئة المصدر، وإذا لم يجده **ينسخ من جدول آخر بصمت** (`:97-102`) | رفض المصدر المفقود والفئة المختلفة |

### بند لكل صك — أكبر تغيير هيكلي

المفتاح الحالي لـ `InspectorFeeLedger` هو **`WorkflowTaskId` كمفتاح أساسي** (`InspectorFeeLedger.cs:8` · `ApplicationDbContext.cs:345`)، ولا يوجد `transaction_id` ولا `deed_id` ولا `user_id`.
`ResolvePropertyAreaM2Async` (`InspectorFeeService.cs:995-1035`): عقار المهمة ← عقارات أمر العمل ← إن تعددت المساحات الصالحة **تُستخدم أكبر مساحة**. أي أن معاملة متعددة الصكوك تُسعَّر بأكبر عقار، لا ببند لكل صك.
البيانات متاحة (`WorkflowTask.PropertyId` تُنسخ للمهام الفرعية — `WorkflowTaskService.cs:1150-1165`؛ و`WorkOrderProperty.DeedNumber` موجود)، لكن المهام على مستوى الـ PO تحتاج **تفكيكاً صريحاً لصفوف عقارات**. التوصية: معرّف صف مستقل + فهرس فريد على الثلاثية، لا جعل الثلاثية مفتاحاً أساسياً.

### اختبارات تنكسر بالتعديلات

`InspectorFeeRulesTests` (الشرائح و٣٥٠ و٤٠٠/٥٠٠) · `KeyEnvelopesServiceTests` (٣٥٠ والبند والتحصيل والحذف) · `OperationsTaskServiceTests` (٣٥٠ والـ idempotency) · `FinancialReportServiceTests` (إيراد المفاتيح) · `OptimisticConcurrencyConfigurationTests` · و`MultiStepTransactionTests` احتمالاً.
**لا يوجد `PartyFeePricingServiceTests` إطلاقاً** — لا اختبار لاختيار الجدول ولا للإسناد ولا لمنع الاحتياط.

---

## ٤. البند المالي ودورة الصرف

### موجود

١١ حالة (`InspectorFeeBillingStatus.cs:8-37`) و١١ انتقالاً بمصفوفة فاعلين حقيقية (`InspectorFeeBillingRules.cs:29-172` + `InspectorFesController.cs:159-179`). الخريطة إلى حالات المواصفة:

| المواصفة | الحالي |
|---|---|
| `ready_for_billing` | `at-finance` |
| `pending_approval` | `office-review` |
| `dispute` | `disputed` |
| `included` | `in-statement` |
| `paid` | `disbursed` |
| `suspended` | `suspended` (حالة مستقلة عن `ExcludedFromBatch`) |

زائد عن المواصفة (يُقرَّر إبقاؤه أو دمجه): `draft` · `sup-review` · `deferred` · `disb-req` · `returned` · `inquiry`.

الكشوف مبنية بالكامل: `draft → issued → closed`، والإقفال يطلب **رقم فاتورة + إيصال (مرفق أو مرجع)** (`EngineeringBillingStatementService.cs:349-368`)، والرقم المرجعي `FN-CS-YYMMDD-NNN` **ذرّي فعلاً على Postgres** عبر `INSERT … ON CONFLICT DO UPDATE … RETURNING` بسقف ٩٩٩/يوم (`:628-661`).
الترحيل مبني (`defer-lines`) بصلاحية المالية، والسبب مكتوب داخلياً ثابتاً ولا يُعرض للطرف — مطابق لقاعدة v3 §٨.٤.
عرض الطرف الخارجي مبني ويُنطَّق بـ `DistributionAssigneeId` والـ API يُجبر غير المالية/العمليات على معرّفه (`InspectorFeesController.cs:42-48`).

### ناقص

`paid_amount` · `deed_id` · `net_amount` مخزَّناً (يُحسب) · سجل الأعمال · التبويب المالي في الملف. (`discount_flags` مُنجز — انظر ج٤)

مُنجز من هذه القائمة: `suspended` كحالة حقيقية · `supervising_department` · `pricing_table_id` · بطاقة «موقوف» في ملخص المشرف.

### يحتاج تعديل — ثلاثة خروق للقواعد الصارمة

1. **«خلاف تسعير لا يظهر للمالية إطلاقاً» مخروق.** الاستثناء يعمل على توليد الكشف فقط (`EngineeringBillingStatementService.cs:32-47` يقبل `at-finance` و`deferred` فقط)، لكن `GET /api/inspector-fees` بلا فلتر (`InspectorFeesController.cs:32-57`) و`finance-queue-stats.ts:22-30` **لا يستثني `disputed`**. المطلوب: الاستثناء على مستوى كل استعلام مالي.
2. **«المشرف المخوَّل = مشرف قسم المعاملة» غير مطبَّق.** الخصم وحسم الخلاف والاعتماد كلها بصلاحية `manage-operations` العامة، و`section-supervisor` يملكها **بلا تقييد قسم** (`PlatformPermissionCatalog.cs:113-116`). ولا يوجد عمود قسم على أي سجل مالي، ولا ربط قسم على أمر العمل (الفصل بين دراسة الحالة والتقييم اليوم فصل schema وخدمات، لا عمود).
3. **مسار الموظف «يُبلَّغ فقط» غير موجود.** أي خصم على بند رفع مساحي يدفعه إلى `office-review` دائماً (`InspectorFeeService.cs:417-435`)، ومسار المعاينة/المراجعة يمر بـ `draft → sup-review` وهو مسار ثالث لا يقابل أياً من مساري المواصفة.

بالإضافة: الكشوف **مقصورة حرفياً** على `engineering-survey` (`:16,39,148,466` والخطأ «كشف الفوترة للمكتب الهندسي يقبل بنود الرفع المساحي فقط.») — لا تخدم المعاين ولا المراجع اليوم، وهما يمرّان بـ `DisbursementBatch`. وعدّاد مهام العمليات `OperationsTaskSequence` **قراءة-تعديل-كتابة غير آمن تحت التزامن** (`OperationsTaskService.cs:1050-1076`) خلافاً لعدّاد الكشوف.

---

## ٥. الصور والعمل دون اتصال والإعدادات

### الصور — أخطر فجوة تشغيلية

| المطلوب | الواقع |
|---|---|
| استخراج EXIF قبل الضغط | **مُنجز** — `exifr` في `process-evidence-photo.ts` قبل أي تحويل |
| تخزين الإحداثيات ووقت التصوير | **مُنجز** — `PhotoMetadata` + `UploadAttachmentRequest.PhotoMetadata` لنطاقات أدلة الصور |
| JPEG · ١٦٠٠px · ٨٠٪ · سقف ١MB · لا نسخة أصلية | **مُنجز** — ضغط على الجهاز ثم ختم؛ المستندات (PDF) بلا ضغط |
| تحويل HEIC | **مُنجز** — `heic2any` → JPEG قبل الضغط |
| الشريط المطبوع: صك + إحداثيات + وقت | **مُنجز** على معاينة الميدان (صك + إحداثيات EXIF/درافت + وقت) |
| مقارنة المسافة / علم الإحداثيات | **مُنجز** — `PhotoLocationRules` (&gt;٥٠٠م ⇒ `outside_property` · بلا GPS ⇒ `location_unavailable`)؛ يظهر للأخصائي في تبويب المعاينة |

الترتيب المطلوب (EXIF ← HEIC ← ضغط ← وسم ← رفع) مُطبَّق على معاينة الميدان وإثبات المفاتيح (صور).

### العمل دون اتصال (مرحلة ٢ — لكن البنية تُهيَّأ الآن)

موجود:
- `packages/offline-client` — IndexedDB مشفّر (outbox / drafts / prefetch / attachments)
- `OfflineSyncCoordinator` — مزامنة عند العودة للاتصال + أيقونة طابور في الشريط + تنبيه معلّق > ساعتين
- `installOfflineWriteInterceptor` — اعتراض حفظ/إرسال معاينة ميدان ومراجعة حكومية + إنشاء ظرف مفاتيح عند انقطاع الشبكة
- استعادة مسودات من الطابور عند فتح المهمة (`loadQueuedDraftPayload`)
- رفع مرفقات مع طابور محلي (`uploadAttachmentWithOfflineFallback`) بما فيها مرفقات ظرف المفاتيح
- `FieldOfflinePrefetch` — مهام + PO + submissions + تلميحات وثائق أساسية في prefetch مشفّر
- مسح الطابور عند 401/403

موجود أيضاً: Background Sync (ejada-offline-sync) · لوحة مشرف ield-sync-board مع heartbeat من الأجهزة.
مُنجز أيضاً: طابور إسناد وتأكيد الإسناد ومناولة وتأكيد المناولة مع ربط معرّف الظرف المحلي بعد المزامنة.

### الإعدادات العامة (٦ تبويبات §٤أ)

| التبويب | الحالة |
|---|---|
| ١ بيانات الشركة | **موجود** — `OrganizationSettings` + شاشة `organization-settings` |
| ٢ المقيم المعتمد | **موجود** — ضمن إعدادات المنظمة |
| ٣ الهوية والأصول | **موجود** — ختم/توقيع/ترويسة من الإعدادات |
| ٤ التسعير | **موجود** (`fee-pricing`) |
| ٥ الاتصالات | **موجود** — مزوّد OTP قابل للاستبدال (`dev-log`/`sms`/`email`) + SMTP/SMS config + اختبار إرسال؛ دخول OTP الكامل مع الدعوات مؤجّل د١–٣ |
| ٦ ضبط النظام | **موجود جزئياً** — محاكم + أنواع تعذّر + مهل SLA؛ عدّادات متفرقة حسب الوحدة |

**المهل:** قابلة للتعديل من إعدادات المنظمة وتُختم عند استلام أمر العمل؛ الجارية **لا تُعاد حسابها** عند تحديث الترويسة (أ٥).

---

## ٦. خطة العمل بالأولوية

### أ — أساسات تحجب غيرها (تُنفَّذ أولاً)

| # | العمل | لماذا أولاً |
|---|---|---|
| أ١ | HTTPS فعلياً + `login-username` معطّل إنتاجاً — **مُنجزة**: TLS عند nginx لا Kestrel (الحاويات لا ترى المفتاح)، وبوابة الإنتاج مغطاة بـ`IdentityApiDevGateTests` | الثابت الأول · شرط WebAuthn · وثغرة مسار dev |
| أ٢ | `audit_log` عام + خدمة كتابة موحّدة — **مُنجزة**: `AuditLog` + `IAuditLogWriter` + schema `audit` + واجهة قراءة + ربط تحولات الأتعاب (`FEE_BILLING_TRANSITION` من `InspectorFeeService`) | «كل تحول حالة مالي ⇒ audit_log» لا استثناء · ويطلبه كل بند تال |
| أ٣ | توحيد المستخدم — **مُنجزة**: عمود `role` · `mobile` · `city` · `avatar` · `has_compensation` · `status` بأربع قيم · `fee_value` · بيانات فوترة | كل شاشات §٤ تعتمد عليه |
| أ٤ | `PATCH /api/users/{id}` + شاشة تعديل — **مُنجزة** | لا يمكن تنفيذ v3 §٦.٢ ولا §١١ بدونه |
| أ٥ | طبقة حفظ واحدة على الواجهة (repository) تُمرّر عبرها كل الكتابات + تثبيت `DueDateAt` المحسوب عند الاستلام — **مُنجزة** | قاعدة التوجيه للمرحلة ٢ — تكلفتها ترتفع كثيراً لاحقاً |

### ب — التسعير (تعديل سلوك على بنية قائمة — أسرع مكسب)

| # | العمل |
|---|---|
| ب١ | حذف كل قيم البذرة والاحتياط + تعميم الخطأ الصريح + `NormalizeTiers([])` يفشل — **مُنجزة**: لا بذور runtime، و`PricingErrors.FeeUnresolved` عند غياب السعر، وحذف ثابت ٣٥٠ الميت |
| ب٢ | إضافة `pricing_table_id` للمستهلكين وختمه مع المبلغ — **مُنجزة**: مستهلكان لا ثلاثة، لأن ب٥ أخرجت أتعاب المفاتيح من التسعيرة فلم يبق لها مبلغ يُنسب إلى جدول |
| ب٣ | audit + row-version على الجداول والشرائح والإسنادات + إضافتها لاختبار الـ concurrency — **مُنجزة** |
| ب٤ | رفض الفئة غير الصالحة بـ ٤٠٠ + رفض النسخ عابر الفئة والمصدر المفقود — **مُنجزة**: `Require`/`IsValid` + اختبار تكامل ٤٠٠ + رفض النسخ من flat |
| ب٥ | إخراج أتعاب المفاتيح من التسعيرة — **مُنجزة**: `KeyReceiptFeeSar` أُزيل، والاستحقاق بـ`RevenueEntitlementAtUtc`، والسجلات التاريخية read-only |
| ب٦ | جعل الجدول المرتبط بأطراف غير قابل للتعديل (نسخة جديدة + إعادة ربط ذرّية) — **مُنجزة** |
| ب٧ | `PartyFeePricingServiceTests` — **مُنجزة**: تغطية الاختيار والنسخ والاحتياط والجمود + اختبارات حوافز flat والاستحقاق بدون سعر |

### ج — البند المالي

| # | العمل |
|---|---|
| ج١ | استثناء `disputed` من **كل** استعلام مالي (لا الكشف فقط) — **مُنجزة**: القائمة والمجاميع، ومجاميع الملخص المالي (`CompletedCaseStudyLedgers`)، وسجل الانتقالات للمالية |
| ج٢ | `supervising_department` على البند + تخويل الخصم والحسم بمشرف ذلك القسم — **مُنجزة** |
| ج٣ | `suspended` كحالة مستقلة عن `ExcludedFromBatch` + استثناؤها من الكشف + بطاقة وبطاقة فلتر — **مُنجزة**: حالة `suspended` بإجراءي `suspend`/`lift-suspension` لمشرف القسم، و`PreSuspensionStatus` يعيد البند لحيث أُوقِف، وخارج الكشف والصرف والمجاميع المالية، وقسم «الموقوفة» في شاشة المشرف |
| ج٤ | `discount_flags`: وسم الأخصائي ← اعتماد المشرف — **مُنجزة**: كيان `DiscountFlags` + إنشاء وسم بدون أثر مالي حتى الاعتماد، والاعتماد يطبّق الخصم على السجل (موظف ⇒ `at-finance`، معاينة هندسية ⇒ `office-review`) بنطاق مشرف القسم، وواجهات مالية `discount-flags` |
| ج٥ | مسار الموظف: خصم ⇒ جاهز مباشرة بإبلاغ، وحظر `disputed` عليه بنياناً — **مُنجزة**: خصم المشرف ⇒ `at-finance` + إشعار، وحظر `office-dispute`/`resolve-dispute` على نوع موظف |
| ج٦ | حوافز الموظف: جدول `flat` يديره المشرف + `incentive_suspensions` — **مُنجزة**: `PricingKind`/`ManagedBy`/`FlatAmountSar`، استحقاق من الجدول المُسند عند `HasCompensation`، و`IncentiveSuspensions` يوقف البنود عبر حالة ج٣ `suspended` |
| ج٧ | المراجع الحكومي بنمطين + حقل مبلغ الزيارة عند **إنشاء** مهمة `court_visit` (٣ ملفات) — **مُنجزة**: موظف بلا أتعاب زيارة، متعاون بمبلغ عند الإنشاء (`AgreedVisitFeeSar`) يُختم عند الإكمال، وتصنيف من عقد الملف، وواجهات DTO/`operations-tasks`/`CreateOperationsTaskModal` |
| ج٨ | بند لكل صك: فهرس فريد على `(transaction, deed, user)` + تفكيك مهام مستوى الـ PO — **مُنجزة**: `Id` مستقل + فهرس فريد؛ مهام بلا `PropertyId` ⇒ صف لكل عقار بمساحته؛ `NetFeeSar`/`PaidAmountSar` |
| ج٩ | تعميم الكشوف (أو كشوف موازية) للمعاين والمراجع + تأمين `OperationsTaskSequence` — **مُنجزة**: `PartyBillingStatement` (إعادة تسمية من Engineering) يقبل المعاينة/المراجع/الرفع، و`POST disbursement-batch` يرد 410، وAPI `/api/party-billing-statements` (+ alias قديم)، وعدّاد مهام تشغيلية ذري؛ جدول `DisbursementBatches` يبقى للتراث `disb-req` فقط |
| إيراد إنفاذ | **مُنجزة (MVP)**: فاتورة `issued`/`partially_collected`/`collected` + تحصيل + بنود `KeyFeeSar` عند الاستحقاق؛ التقارير من المحصّل فقط؛ لا إيراد من استحقاق بلا مبلغ |

### د — المستخدمون والشاشات

| البند | الحالة |
|---|---|
| تدرج أعمدة القائمة · إعادة دعوة · آخر دخول | **جزئي (شاشات)**: أعمدة متدرجة حسب الصلاحية/الدور · CTA «إعادة دعوة» · `LastLoginAtUtc` + ختم عند إصدار جلسة جديدة |
| سجل الأعمال + التبويب المالي (`has_compensation`) | **جزئي (شاشات)**: تبويبات الملف؛ السجل/المالية من بنود الأتعاب (نافذة على وحدة المالية) |
| شاشة الإعدادات (شركة · مقيم · أصول · اتصالات · مهل) | **مُنجزة (شاشات+API)**: `OrganizationSettings` + صفحة `organization-settings` |
| المهل قابلة للتعديل مع تثبيت الجارية | **مُنجزة**: إعدادات SLA → `WorkOrderService` عند الإنشاء؛ الجارية لا تُعاد حسابها (أ٥)؛ الواجهة تقرأ الكاش |
| `invitations` · `devices` · OTP · الدخول بالجوال | **مؤجّل** — مراحل د ١–٣ |

### هـ — الصور

استخراج EXIF قبل أي معالجة + `photo_metadata` + ضغط ١٦٠٠/٨٠٪/١MB + تحويل HEIC + استثناء المستندات من الضغط، وإصلاح ترتيب الوسم ليأتي بعد التصغير — **مُنجزة**. مقارنة المسافة/العلم (مرحلة ٢) — **مُنجزة**: `distance_m`/`flag` عند الرفع، وشارات المراجعة للأخصائي.

---

## ٧. قرارات مطلوبة قبل الكود

| # | القرار |
|---|---|
| ١ | **مدير النظام:** دور صريح جديد أم `cdo` هو هو؟ (يمس ١٢ صلاحية و٢٨ صفحة) |
| ٢ | **أسماء الأدوار:** نعتمد أسماء الكود (`case-specialist` · `real-estate-appraiser` · `financial-officer`) أم نعيد التسمية لأسماء v3؟ |
| ٣ | **الدخول بالجوال:** موعد التحويل، ومصير البذرة الحالية (١١ مستخدماً بالبريد) |
| ٤ | **أتعاب المفاتيح:** ماذا يحدث للـ `KeyReceiptFeeCharge` التاريخية ولبند الإيراد في الملخص المالي بعد الإزالة؟ |
| ٥ | **الحالات الست الزائدة** (`draft` · `sup-review` · `deferred` · `disb-req` · `returned` · `inquiry`): تُبقى كامتداد معتمد أم تُدمج في آلة المواصفة؟ |
| ٦ | **الكشوف:** تُعمَّم للمعاين والمراجع أم يُبقى مسار `DisbursementBatch` لهم؟ وهل يتقاسمون عدّاد `FN-CS`؟ |
| ٧ | **بند لكل صك:** هل نغيّر مفتاح `InspectorFeeLedger` الآن أم نضيف فهرساً فريداً ونؤجل تفكيك مهام الـ PO؟ |
| ٨ | **٤٠٠/٥٠٠ للمعاين المتعاون:** تُحذف كبقية البذرة (فهم قاعدة «لا بذرة») — تأكيد مطلوب |
| ٩ | **صلاحية `submit-party-work` لموظف المالية** — الخطأ الموثّق في زر «تأكيد التحصيل (المالية)» |
