repo: BuadDigital/case_srudy
branch: main
path: apps/mfe-case-study

## Last sync
date: 2026-07-27T09:48:00Z
tree: cd53f44933d2

### Updated in this project
- السايدبار طوبق مع البنية الحقيقية في المستودع (AppShell.tsx + constants NAV + active-transactions + system-settings-nav + orphan-screens-nav): «المهام» نُقلت داخل قسم دراسة الحالة، «التقارير المالية» نُقلت تحت «عام ← إعدادات النظام»، أُضيفت مجموعة «إعدادات النظام» المنسدلة (طلبات التقييم، التقارير المالية، قاموس الحقول المركزي، دليل الشاشات، المستخدمون، التسعيرة، سجل التدقيق) وتحتها «جميع حقول النظام» (علاقة المستخدم بالمعلومة، المحاكم والدوائر، أنواع التعذرات)، وأُضيفت مجموعة «الشاشات اليتيمة» (مكاتب الرفع، المراجعة الحكومية). أُزيلت «مؤشرات الأداء» و«المراجعة الحكومية» من المعاملات النشطة لعدم وجودهما في البنية الرسمية.
- تبويب «دراسة الحالة» بُني كاملاً من مكوّنات case-study بالمستودع: حلقات تقدّم الأطراف (CaseStudyPartyProgressRings/ProgressDonut) + مستند التقرير المُصغّر بعلامة EJADAH (CaseStudyReportDocument/report-render.ts) مبنياً تلقائياً من الإجابات المعتمدة + بيانات النظام، مع بطاقة حالة وأزرار فتح/تحميل.
- مساحة عمل نموذج الدراسة (CaseStudyForm): 5 خطوات، جدول المصفوفة (CaseStudyMatrixTable) بأعمدة إجابات الأطراف (معاين/مكتب/مقيم/مراجع) وإجابة معتمدة نعم/لا مع أزرار «اعتماد إجابة الأطراف» عند الإجماع وتظليل التعارض، ملاحظات الأقسام، عدّاد الكهرباء، اشتراك اتحاد الملاك، قسم الرفع لإنفاذ للأخصائي، والاعتماد/معاينة التقرير وطباعته. الأسئلة والعناوين والأطراف من property-fields-catalog وcase-study-info-roles-data.

## Sync history
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
