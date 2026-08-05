repo: BuadDigital/case_srudy
branch: main
path: apps/mfe-case-study

## Last sync
date: 2026-08-02T06:40:29Z
tree: 2fbc63ba3fa1

### Updated in this project
- أُضيفت شاشة «تسجيل الدخول» (LoginPage) كبوابة تغطّي التطبيق عند التحميل، مبنية من apps/shell/src/app/login/page.tsx: بطاقة بحدّ ذهبي جانبي، شعار إجادة (EjadaLogo onLight — كحلي #102B4E + ذهبي #A4906F مضمّن SVG)، وسم «نظام دراسة الحالة»، عنوان + وصف، صندوق خطأ (بحدّ danger)، حقلا البريد وكلمة المرور (dir=ltr)، وزر «دخول» يتعطّل حتى تُملأ الحقول. رسائل التحقق مطابقة للمستودع («اكتب البريد الإلكتروني»/«اكتب كلمة المرور»). نجاح الدخول يخزّن ejadaLoggedIn في sessionStorage ويظهر توست «تم تسجيل الدخول !»؛ زر «تسجيل الخروج» في قائمة المستخدم يمسح المفتاح ويعيد البوابة.

## Sync history
- 2026-07-28T10:12:00Z — أُضيفت شاشة «استعلام بورصة» (BourseInquiryView) داخل Case Study.html من PoPropertyBourseForm.tsx + property-bourse-validation.ts + po-intake-data.ts.
- 2026-07-27T09:48:00Z — السايدبار طوبق مع البنية الحقيقية، وتبويب «دراسة الحالة» ومساحة عمل النموذج بُنيا كاملاً من مكوّنات case-study.
- 2026-07-26T10:21:25Z — تبويب «معاينة العقار» أُعيد بناؤه من FieldInspectionWorkBody (عرض للاطلاع + وضع إدخال).
- 2026-07-26T09:58:20Z — تبويب معاينة العقار (نسخة استرشادية أولى من FieldInspectionAdvisoryPanel).

## Screen map
| الشاشة/التبويب | ملفات المصدر |
|---|---|
| السايدبار (التنقل الرئيسي) | apps/shell/src/components/views/AppShell.tsx; packages/app-shared/src/prototype/constants.ts (NAV/ROLES/PAGE_TITLES), active-transactions.ts, system-settings-nav.ts, system-fields-nav.ts, settings-nav.ts, orphan-screens-nav.ts; packages/types/src/navigation.ts, case-study-nav.ts; party-task-pages.ts |
| تفاصيل العقار — ترويسة وتبويبات | apps/mfe-case-study/src/components/po-intake/PropertyDetailHero.tsx, PoPropertyDetailTabs.tsx |
| تبويب معاينة العقار | apps/mfe-case-study/src/components/field-inspection/FieldInspectionWorkBody.tsx, FieldInspectionAdvisoryPanel.tsx, src/lib/prototype/inspector-workspace-data.ts |
| تبويب دراسة الحالة (التقرير) | apps/mfe-case-study/src/components/po-intake/PropertyDetailCaseStudyReport.tsx, components/case-study/CaseStudyReportDocument.tsx, CaseStudyPartyProgressRings.tsx, CaseStudyProgressDonut.tsx, lib/prototype/case-study-report-model.ts, case-study-report-render.ts, case-study-party-progress.ts |
| نموذج/مساحة عمل دراسة الحالة | apps/mfe-case-study/src/components/case-study/CaseStudyForm.tsx, CaseStudyMatrixTable.tsx, case-study-matrix-utils.ts, CaseStudyInfathSpecialistSection.tsx, CaseStudyApprovalSection.tsx, lib/prototype/case-study-form-data.ts, case-study-question-catalog.ts, case-study-party-answers.ts; packages/app-shared/src/prototype/property-fields-catalog.ts; apps/mfe-settings/src/lib/prototype/case-study-info-roles-data.ts |
| شاشة استعلام بورصة (renderBourse) | apps/mfe-case-study/src/views/BourseInquiryView.tsx; components/po-intake/PoPropertyBourseForm.tsx, PoPropertyBoundariesEntrySection.tsx; lib/domain/po-intake/property-bourse-validation.ts; lib/prototype/po-intake-data.ts |
| شاشة تسجيل الدخول (loginGate) | apps/shell/src/app/login/page.tsx; apps/shell/src/components/views/EjadaLogo.tsx |
