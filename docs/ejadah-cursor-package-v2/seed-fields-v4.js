// سجل حقول التقييم — الإصدار 4.0
// v3 + قرارات جلسة المجلس الاستشاري 2026-08-16 (القرارات 15–26 والحسومات ق-1..ق-15)
// مرجع القرارات الحاكم: review-decisions-log-v2.md (حتى القرار 26) · advisory-board-review-v1.md
// خاصية requiredWhen: بعض الحقول إلزامية شرطيًا (تُقرأ: required إذا تحقق الشرط) — منصوصة في الحقل.
//
// أنماط sourceKind: دور بشري · تلقائي من منصة خارجية · موروث · محسوب · نص ثابت · مشتق قابل للتحرير
// سلوك correction: تعديل مباشر · إرجاع للمصدر · اعتراض فقط · توليد أولي + تحرير حر

// بيانات تجريبية — أداة إدارة حقول التقييم
// 118 حقلاً مستخرجة من «حصر حقول التقييم ودراسة الحالة v2.0»
//
// ⚠️ هذه بيانات معاينة فقط. الأداة تبدأ فارغة في الإنتاج،
//    والحقول تُدار من داخلها. لا تُدمج هذه المصفوفة في مكوّنات الواجهة.

export const SEED_FIELDS = [
  // ═══ البيانات الأساسية ═══
  { label: "مساحة الأرض", section: "البيانات الأساسية", type: "رقم", unit: "م²", sourceKind: "موروث", sourceRef: "الصك (التفريغ المنظم) — الرفع المساحي للمطابقة، والاختلاف مرشح تعذر يفحصه دارس الحالة", responsible: ["أخصائي دراسة الحالة"], correction: "اعتراض فقط", tags: ["تقييم", "مساحية"], required: true },
  { label: "رقم الصك", section: "البيانات الأساسية", type: "نص", sourceKind: "موروث", sourceRef: "سجل العقار", responsible: ["أخصائي دراسة الحالة"], correction: "اعتراض فقط", tags: ["تقييم"], required: true },
  { label: "الاستخدام", section: "البيانات الأساسية", type: "قائمة اختيار", sourceKind: "موروث", sourceRef: "المستكشف الإلكتروني (ومن صك السجل العيني إن وُجد) + بند افتراض قائم", responsible: ["مقيم عقاري"], correction: "اعتراض فقط", tags: ["تقييم"], required: true },
  { label: "المدينة", section: "البيانات الأساسية", type: "قائمة اختيار", sourceKind: "موروث", sourceRef: "الصك أولًا — يُكمل من المستكشف عند النقص، والتعارض يحسمه المقيّم ويُدوَّن", responsible: ["أخصائي دراسة الحالة"], correction: "اعتراض فقط", tags: ["تقييم"], required: true },
  { label: "الحي", section: "البيانات الأساسية", type: "قائمة اختيار", sourceKind: "موروث", sourceRef: "الصك أولًا — يُكمل من المستكشف عند النقص (الصكوك القديمة قد تغفله)، والتعارض يحسمه المقيّم ويُدوَّن", responsible: ["أخصائي دراسة الحالة"], correction: "اعتراض فقط", tags: ["تقييم"], required: true },
  { label: "تاريخ التقييم", section: "البيانات الأساسية", type: "تاريخ", sourceKind: "محسوب", sourceRef: "تاريخ آخر اعتماد للقيمة — الأثر الرجعي: علم + تاريخ يدوي + مبرر إلزامي + سجل تدقيق", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["تقييم"], required: true },

  // ═══ إعدادات التقييم ═══
  { label: "نوع العقار", section: "إعدادات التقييم", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "مبدئي من المستندات وتوصيف العميل — يعتمده المعاين من الميدان (حاكم لكل الشرطيات)", responsible: ["معاين", "مقيم عقاري"], correction: "تعديل مباشر", tags: ["تقييم"], required: true },
  { label: "أساس القيمة المستخدم", section: "إعدادات التقييم", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["تقييم"], required: true },
  { label: "أساس التكلفة", section: "إعدادات التقييم", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "وحدة قياس التكلفة", section: "إعدادات التقييم", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "الأساليب المطبَّقة", section: "إعدادات التقييم", type: "اختيار متعدد", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["تقييم", "أسلوب السوق", "أسلوب التكلفة", "أسلوب الدخل"], required: true },
  { label: "اسم المقيّم العقاري", section: "إعدادات التقييم", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "مشرف القسم", responsible: ["مشرف القسم"], correction: "تعديل مباشر", tags: ["تقييم"], required: true },
  { label: "صلاحية تحرير التسويات", section: "إعدادات التقييم", type: "نعم/لا", sourceKind: "دور بشري", sourceRef: "مشرف القسم", responsible: ["مشرف القسم"], correction: "تعديل مباشر", tags: ["تقييم"], required: true },

  // ═══ بنك المقارنات ═══
  { label: "اعتماد المقارن", section: "بنك المقارنات", type: "نعم/لا", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["بنك المقارنات", "طريقة المقارنة"], required: true },
  { label: "الرقم المرجعي للمقارن", section: "بنك المقارنات", type: "نص", sourceKind: "محسوب", sourceRef: "تسلسل داخلي", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["بنك المقارنات", "محسوب"], required: true },
  { label: "نوع العقار المقارن", section: "بنك المقارنات", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "ق-3/5: قائمة مغلقة = نفس قائمة نوع العقار محل التقييم — لا نص حر (توحيد التجميع)", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: true },
  { label: "نوع العملية", section: "بنك المقارنات", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "ق-2: صفقة منفّذة (سعر حقيقي وقع) · عرض — حقل وصفي، لا قاعدة إشارة آلية (المقيّم يحدد النسبة والاتجاه، القرار 21)", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: true },
  { label: "تاريخ المقارن", section: "بنك المقارنات", type: "تاريخ", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: true },
  { label: "سعر المتر للمقارن", section: "بنك المقارنات", type: "مبلغ", sourceKind: "محسوب", sourceRef: "سعر العقار المقارن ÷ مساحة المقارن — مع تنبيه شذوذ (ق-3/د-1؛ كان دور بشري في v3)", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["بنك المقارنات", "محسوب"], required: false },
  { label: "سعر العقار المقارن", section: "بنك المقارنات", type: "مبلغ", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: true },
  { label: "مساحة المقارن", section: "بنك المقارنات", type: "رقم", unit: "م²", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: true },
  { label: "نسبة المساحة", section: "بنك المقارنات", type: "نسبة", sourceKind: "محسوب", sourceRef: "مساحة المقارن ÷ مساحة العقار", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["بنك المقارنات", "محسوب"], required: false },
  { label: "حي المقارن", section: "بنك المقارنات", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: true },
  { label: "مصدر المقارن", section: "بنك المقارنات", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: true },
  { label: "وصف المقارن", section: "بنك المقارنات", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: false },

  // ═══ التسويات ═══
  { label: "الأساس المعتمد في التسويات", section: "التسويات", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب السوق", "طريقة المقارنة"], required: true },
  { label: "تسوية شروط التمويل", section: "التسويات", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },
  { label: "تسوية ظروف السوق", section: "التسويات", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },
  { label: "تسوية نوع المقارن", section: "التسويات", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },
  { label: "مبرر التسوية", section: "التسويات", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["مبرر إلزامي"], required: true },
  { label: "مفتاح احتساب بند التسوية", section: "التسويات", type: "نعم/لا", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: true },
  { label: "السعر بعد التسويات التسلسلية", section: "التسويات", type: "مبلغ", sourceKind: "محسوب", sourceRef: "ضرب تسلسلي للبنود المفعّلة", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "طريقة المقارنة"], required: false },
  { label: "طريقة قياس تسوية المساحة", section: "التسويات", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: true },
  { label: "نسبة تسوية المساحة", section: "التسويات", type: "نسبة", sourceKind: "محسوب", sourceRef: "المضاعف أو الأمثال حسب طريقة القياس", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "طريقة المقارنة"], required: false },
  { label: "مفتاح احتساب تسوية المساحة", section: "التسويات", type: "نعم/لا", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: true },

  // ═══ عوامل الاختلاف ═══
  { label: "المساحة المثالية", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },
  { label: "الموقع", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },
  { label: "عامل الجذب للموقع", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },
  { label: "سهولة الوصول", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },
  { label: "عدد الشوارع", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },
  { label: "أطوال الشوارع", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },
  { label: "شكل القطعة", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },
  { label: "طبوغرافيا الأرض", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "معاين", responsible: ["مقيم عقاري"], correction: "إرجاع للمصدر", tags: ["طريقة المقارنة", "مساحية"], required: false },
  { label: "تنظيم البناء", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة", "هندسية"], required: false },
  { label: "الخدمات والبنية التحتية", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "معاين", responsible: ["مقيم عقاري"], correction: "إرجاع للمصدر", tags: ["طريقة المقارنة"], required: false },
  { label: "القيود والارتفاقات", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة", "قانونية"], required: false },
  { label: "حالة التطوير", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },
  { label: "عامل مضاف من المقيّم", section: "عوامل الاختلاف", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة"], required: false },

  // ═══ مخرجات المقارنة ═══
  { label: "مجموع نسب التسويات", section: "مخرجات المقارنة", type: "نسبة", sourceKind: "محسوب", sourceRef: "صافي نسب التسويات بإشاراتها", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "تنبيه منهجي"], required: false },
  { label: "القيمة بعد ضبط عوامل الاختلاف", section: "مخرجات المقارنة", type: "مبلغ", sourceKind: "محسوب", sourceRef: "السعر المسوّى × عوامل الاختلاف", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "الوزن النسبي للمقارن", section: "مخرجات المقارنة", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["طريقة المقارنة", "تنبيه منهجي"], required: true },
  { label: "القيمة بعد الوزن النسبي", section: "مخرجات المقارنة", type: "مبلغ", sourceKind: "محسوب", sourceRef: "القيمة المسوّاة × الوزن", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "قيمة المتر المرجّحة", section: "مخرجات المقارنة", type: "مبلغ", sourceKind: "محسوب", sourceRef: "مجموع القيم الموزونة", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "القيمة المرجّحة للعقار", section: "مخرجات المقارنة", type: "مبلغ", sourceKind: "محسوب", sourceRef: "قيمة المتر المرجّحة × المساحة", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  // ⛔ مُعطَّل في v3 — يناقض قاعدة «التقريب مرة واحدة على آخر رقم» (v3): لا تقريب قبل رأي القيمة النهائي.
  // { label: "عدد خانات التقريب", section: "مخرجات المقارنة", ... },
  { label: "قيمة أرض المبنى محل التقييم", section: "مخرجات المقارنة", type: "مبلغ", sourceKind: "محسوب", sourceRef: "مشتقة من مقارنات الأرض الفضاء", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "أسلوب التكلفة", "مدخل لأسلوب آخر"], required: false },
  { label: "قيمة العقار بأسلوب السوق", section: "مخرجات المقارنة", type: "مبلغ", sourceKind: "محسوب", sourceRef: "مخرج طريقة المقارنة", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "أسلوب السوق", "مدخل لأسلوب آخر"], required: false },
  { label: "تحليل التسويات", section: "مخرجات المقارنة", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب السوق"], required: false },

  // ═══ قيمة الأرض (طريقة المقاول) ═══
  { label: "سعر المتر المستورد من طريقة المقارنة", section: "قيمة الأرض", type: "مبلغ", sourceKind: "محسوب", sourceRef: "قيمة أرض المبنى محل التقييم", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "أسلوب التكلفة"], required: false },
  { label: "خصم تقييد الاستخدام", section: "قيمة الأرض", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "تنبيه منهجي"], required: false },
  { label: "مبرر تقييد الاستخدام", section: "قيمة الأرض", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["مبرر إلزامي"], required: false },
  { label: "حصة الشقة من الأرض", section: "قيمة الأرض", type: "رقم", unit: "م²", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "سعر المتر بعد الخصم", section: "قيمة الأرض", type: "مبلغ", sourceKind: "محسوب", sourceRef: "سعر المتر × (١ − خصم تقييد الاستخدام)", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "أسلوب التكلفة"], required: false },

  // ═══ بنود التكلفة المباشرة ═══
  { label: "مسطح القبو", section: "بنود التكلفة المباشرة", type: "رقم", unit: "م²", sourceKind: "دور بشري", sourceRef: "معاين", responsible: ["مقيم عقاري"], correction: "إرجاع للمصدر", tags: ["أسلوب التكلفة", "هندسية"], required: false },
  { label: "مسطح الدور الأرضي", section: "بنود التكلفة المباشرة", type: "رقم", unit: "م²", sourceKind: "دور بشري", sourceRef: "معاين", responsible: ["مقيم عقاري"], correction: "إرجاع للمصدر", tags: ["أسلوب التكلفة", "هندسية"], required: false },
  { label: "مسطح الدور الأول", section: "بنود التكلفة المباشرة", type: "رقم", unit: "م²", sourceKind: "دور بشري", sourceRef: "معاين", responsible: ["مقيم عقاري"], correction: "إرجاع للمصدر", tags: ["أسلوب التكلفة", "هندسية"], required: false },
  { label: "مسطح الأدوار المتكررة", section: "بنود التكلفة المباشرة", type: "رقم", unit: "م²", sourceKind: "محسوب", sourceRef: "مسطح الدور الأول × عدد الأدوار المتكررة", responsible: ["مقيم عقاري"], correction: "اعتراض فقط", tags: ["محسوب", "أسلوب التكلفة"], required: false },
  { label: "عدد الأدوار المتكررة", section: "بنود التكلفة المباشرة", type: "رقم", sourceKind: "دور بشري", sourceRef: "معاين", responsible: ["مقيم عقاري"], correction: "إرجاع للمصدر", tags: ["أسلوب التكلفة", "هندسية"], required: false },
  { label: "مسطح الملحق العلوي", section: "بنود التكلفة المباشرة", type: "رقم", unit: "م²", sourceKind: "دور بشري", sourceRef: "معاين", responsible: ["مقيم عقاري"], correction: "إرجاع للمصدر", tags: ["أسلوب التكلفة", "هندسية"], required: false },
  { label: "مساحة الشقة", section: "بنود التكلفة المباشرة", type: "رقم", unit: "م²", sourceKind: "دور بشري", sourceRef: "معاين", responsible: ["مقيم عقاري"], correction: "إرجاع للمصدر", tags: ["أسلوب التكلفة", "هندسية"], required: false },
  { label: "حصة المشترك من المبنى", section: "بنود التكلفة المباشرة", type: "رقم", unit: "م²", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "المواقف", section: "بنود التكلفة المباشرة", type: "مبلغ", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "السور", section: "بنود التكلفة المباشرة", type: "مبلغ", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "المسبح", section: "بنود التكلفة المباشرة", type: "مبلغ", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "التكييف المركزي", section: "بنود التكلفة المباشرة", type: "مبلغ", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "المصعد", section: "بنود التكلفة المباشرة", type: "مبلغ", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "تشجير وتنسيق الموقع", section: "بنود التكلفة المباشرة", type: "مبلغ", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "خزانات ومضخات", section: "بنود التكلفة المباشرة", type: "مبلغ", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "أعمال كهروميكانيكية", section: "بنود التكلفة المباشرة", type: "مبلغ", sourceKind: "دور بشري", sourceRef: "مكتب هندسي", responsible: ["مقيم عقاري"], correction: "إرجاع للمصدر", tags: ["أسلوب التكلفة", "هندسية"], required: false },
  { label: "بند تكلفة مخصص", section: "بنود التكلفة المباشرة", type: "مبلغ", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "تنبيه منهجي"], required: false },
  { label: "أساس تقدير البند", section: "بنود التكلفة المباشرة", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["مبرر إلزامي"], required: false },
  { label: "مجموع التكلفة المباشرة", section: "بنود التكلفة المباشرة", type: "مبلغ", sourceKind: "محسوب", sourceRef: "مجموع البنود المفعّلة", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "أسلوب التكلفة"], required: false },
  { label: "سعر المتر بعد غير المباشرة", section: "بنود التكلفة المباشرة", type: "مبلغ", sourceKind: "محسوب", sourceRef: "التكلفة الإجمالية ÷ المسطح", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "أسلوب التكلفة"], required: false },

  // ═══ التكاليف غير المباشرة ═══
  { label: "التصميم والإشراف الهندسي", section: "التكاليف غير المباشرة", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "مبرر إلزامي"], required: false },
  { label: "الترخيص والرسوم الحكومية", section: "التكاليف غير المباشرة", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "مبرر إلزامي"], required: false },
  { label: "إدارة المشروع", section: "التكاليف غير المباشرة", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "مبرر إلزامي"], required: false },
  { label: "توصيل الخدمات", section: "التكاليف غير المباشرة", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "مبرر إلزامي"], required: false },
  { label: "مخصص الطوارئ", section: "التكاليف غير المباشرة", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "مبرر إلزامي"], required: false },
  { label: "أرباح المطور والمخاطرة", section: "التكاليف غير المباشرة", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "مبرر إلزامي", "تنبيه منهجي"], required: false },
  { label: "المعدل السنوي للتمويل", section: "التكاليف غير المباشرة", type: "رقم", unit: "%", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "مالية"], required: false },
  { label: "مدة التنفيذ بالأشهر", section: "التكاليف غير المباشرة", type: "رقم", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "نسبة التمويل", section: "التكاليف غير المباشرة", type: "نسبة", sourceKind: "محسوب", sourceRef: "المعدل السنوي × (المدة ÷ ١٢) × ٥٠٪", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "مالية"], required: false },
  { label: "مجموع النسب غير المباشرة", section: "التكاليف غير المباشرة", type: "نسبة", sourceKind: "محسوب", sourceRef: "مجموع البنود المفعّلة", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "تنبيه منهجي"], required: false },
  { label: "التكلفة الإجمالية", section: "التكاليف غير المباشرة", type: "مبلغ", sourceKind: "محسوب", sourceRef: "المباشرة × (١ + غير المباشرة)", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "أسلوب التكلفة"], required: false },

  // ═══ العمر والإهلاك ═══
  { label: "العمر الفعلي", section: "العمر والإهلاك", type: "رقم", unit: "سنة", sourceKind: "دور بشري", sourceRef: "معاين", responsible: ["مقيم عقاري"], correction: "إرجاع للمصدر", tags: ["أسلوب التكلفة", "هندسية"], required: false },
  { label: "العمر الاقتصادي", section: "العمر والإهلاك", type: "رقم", unit: "سنة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },
  { label: "تمديد العمر", section: "العمر والإهلاك", type: "رقم", unit: "سنة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "مبرر إلزامي", "تنبيه منهجي"], required: false },
  { label: "التقادم الوظيفي", section: "العمر والإهلاك", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "مبرر إلزامي"], required: false },
  { label: "التقادم الخارجي", section: "العمر والإهلاك", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة", "مبرر إلزامي"], required: false },
  { label: "التقادم المادي", section: "العمر والإهلاك", type: "نسبة", sourceKind: "محسوب", sourceRef: "العمر الفعلي ÷ العمر الممتد", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "تنبيه منهجي"], required: false },
  { label: "مجموع التقادم", section: "العمر والإهلاك", type: "نسبة", sourceKind: "محسوب", sourceRef: "المادي + الوظيفي + الخارجي", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "تنبيه منهجي"], required: false },
  { label: "قيمة الإهلاك", section: "العمر والإهلاك", type: "مبلغ", sourceKind: "محسوب", sourceRef: "التكلفة الإجمالية × مجموع التقادم", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "قيمة المباني بعد الإهلاك", section: "العمر والإهلاك", type: "مبلغ", sourceKind: "محسوب", sourceRef: "التكلفة الإجمالية − قيمة الإهلاك", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "سعر متر المباني بعد الإهلاك", section: "العمر والإهلاك", type: "مبلغ", sourceKind: "محسوب", sourceRef: "قيمة المباني ÷ المسطح", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "ناتج أسلوب التكلفة — المباني دون الأرض", section: "العمر والإهلاك", type: "مبلغ", sourceKind: "محسوب", sourceRef: "قيمة المباني بعد الإهلاك", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "أسلوب التكلفة", "مدخل لأسلوب آخر"], required: false },
  { label: "القيمة مع الأرض للاسترشاد", section: "العمر والإهلاك", type: "مبلغ", sourceKind: "محسوب", sourceRef: "المباني + قيمة الأرض", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "تحليل التكلفة", section: "العمر والإهلاك", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["أسلوب التكلفة"], required: false },

  // ═══ رأي القيمة النهائي ═══
  { label: "الأسلوب المرجَّح", section: "رأي القيمة النهائي", type: "نص", sourceKind: "محسوب", sourceRef: "الأساليب المطبَّقة", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "القيمة الناتجة عن الأسلوب", section: "رأي القيمة النهائي", type: "مبلغ", sourceKind: "محسوب", sourceRef: "مخرج كل أسلوب", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "نسبة المشاركة", section: "رأي القيمة النهائي", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["تقييم", "تنبيه منهجي"], required: true },
  { label: "القيمة بعد المشاركة", section: "رأي القيمة النهائي", type: "مبلغ", sourceKind: "محسوب", sourceRef: "القيمة × نسبة المشاركة", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "مبرر نسبة المشاركة", section: "رأي القيمة النهائي", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["مبرر إلزامي"], required: true },
  { label: "مجموع نسب المشاركة", section: "رأي القيمة النهائي", type: "نسبة", sourceKind: "محسوب", sourceRef: "مجموع النسب — يجب أن يساوي ١٠٠٪", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب", "تنبيه منهجي"], required: false },
  { label: "القيمة المرجّحة", section: "رأي القيمة النهائي", type: "مبلغ", sourceKind: "محسوب", sourceRef: "مجموع القيم بعد المشاركة", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "نسبة خصم البيع القسري", section: "رأي القيمة النهائي", type: "نسبة", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["تقييم", "مالية"], required: false },
  { label: "القيمة بعد الخصم قبل التقريب", section: "رأي القيمة النهائي", type: "مبلغ", sourceKind: "محسوب", sourceRef: "القيمة المرجّحة × (١ − الخصم)", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
  { label: "عدد خانات التقريب النهائي", section: "رأي القيمة النهائي", type: "رقم", sourceKind: "دور بشري", sourceRef: "مقيم عقاري", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["تقييم"], required: false },
  { label: "الرأي النهائي للقيمة", section: "رأي القيمة النهائي", type: "مبلغ", sourceKind: "محسوب", sourceRef: "القيمة بعد الخصم مقرَّبة", responsible: ["مقيم مراجع", "المقيم المعتمد"], correction: "اعتراض فقط", tags: ["محسوب", "تقييم", "مالية"], required: true },
  { label: "الرأي النهائي كتابةً", section: "رأي القيمة النهائي", type: "نص", sourceKind: "محسوب", sourceRef: "تفقيط الرأي النهائي", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["محسوب"], required: false },
];

export const SEED_TAGS = [
  "تقييم", "مالية", "مساحية", "هندسية", "قانونية",
  "أسلوب السوق", "أسلوب التكلفة", "أسلوب الدخل",
  "طريقة المقارنة", "بنك المقارنات",
  "محسوب", "مبرر إلزامي", "مدخل لأسلوب آخر", "تنبيه منهجي",
];

export const SEED_ROLES = [
  "مشرف القسم", "أخصائي دراسة الحالة", "معاين",
  "مقيم عقاري", "مقيم مراجع", "المقيم المعتمد",
  "مكتب هندسي", "مراجع حكومي",
];

// ═══ إضافات v3 — قرارات 2026-08-12 ═══
export const SEED_FIELDS_V3_ADDITIONS = [
  // بنك المقارنات — الحقول المضافة اليوم
  { label: "إحداثيات المقارن", section: "بنك المقارنات", type: "إحداثيات", sourceKind: "دور بشري", sourceRef: "مدخل البيانات (من المنصة مكتبيًا) أو الميداني — تغذي خريطة المقارنات وحساب القرب", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: true },
  { label: "رقم الإعلان", section: "بنك المقارنات", type: "نص", sourceKind: "دور بشري", sourceRef: "من المنصة — للعروض فقط؛ جزء من الخلية المركبة المطبوعة (خريطة الترقيم قسم 12)", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: false },
  { label: "جوال المعلن", section: "بنك المقارنات", type: "نص", sourceKind: "دور بشري", sourceRef: "ق-12: يُطبع — مخصص للنشر بتصريح عقاري، للعروض فقط؛ جزء من الخلية المركبة المطبوعة", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: false },
  { label: "وصف السعر", section: "بنك المقارنات", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "ق-2: حد (سقف أعلى يحدّه البائع) · سوم (آخر سعر من راغب شراء) — يظهر عند نوع العملية=عرض فقط", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], requiredWhen: "نوع العملية = عرض", required: false },
  { label: "صورة العرض", section: "بنك المقارنات", type: "مرفق", sourceKind: "دور بشري", sourceRef: "لقطة الإعلان — تُحفظ إثباتًا ولا تُعرض في التقرير", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: false },
  { label: "بطاقة مصدر المقارن", section: "بنك المقارنات", type: "نص", sourceKind: "محسوب", sourceRef: "ميداني/مكتبي · حديث/مخزن · من معاملات سابقة — تظهر عند الاختيار", responsible: ["مقيم مراجع"], correction: "اعتراض فقط", tags: ["بنك المقارنات", "محسوب"], required: false },
  // نطاق العمل والمعاملة
  { label: "مستخدمو التقرير", section: "نطاق العمل", type: "اختيار متعدد", sourceKind: "دور بشري", sourceRef: "من سجل العملاء/الجهات — 0..ن، قد يشمل العميل؛ يشتق جملة حصر الاستخدام بثلاث حالات", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["تقييم"], required: false },
  { label: "رقم التكليف", section: "نطاق العمل", type: "نص", sourceKind: "دور بشري", sourceRef: "تكليف العميل لإجادة — رقمه مصدره العميل", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["تقييم"], required: false },
  { label: "رقم الطلب", section: "نطاق العمل", type: "نص", sourceKind: "موروث", sourceRef: "إنفاذ: مرجع القضية بالمحكمة · عملاء آخرون: مرجعهم أو لا شيء — ق-11: التطابق مع رقم الصك تحذير لا منع (قد يقع مصادفة)", responsible: ["أخصائي دراسة الحالة"], correction: "اعتراض فقط", tags: ["تقييم"], required: false },
  { label: "تاريخ المعاينة", section: "نطاق العمل", type: "تاريخ", sourceKind: "محسوب", sourceRef: "ق-10: ختم لحظة إتمام المعاينة في الموقع (لا لحظة الرفع — تُسجَّل منفصلة بالتدقيق)؛ آخر زيارة مكتملة", responsible: ["معاين"], correction: "اعتراض فقط", tags: ["تقييم", "محسوب"], required: true },
  // الأصل والعقار
  { label: "نوع الملكية", section: "الأصل محل التقييم", type: "قائمة اختيار", sourceKind: "مشتق قابل للتحرير", sourceRef: "من تفريغ الصك: رهن⟵مرهون · حصص⟵مشاع · بلا قيود⟵مطلقة · استثمار يدويًا بعقد", responsible: ["مقيم عقاري"], correction: "توليد أولي + تحرير حر", tags: ["تقييم", "قانونية"], required: true },
  { label: "هل توجد مبانٍ/إنشاءات يجب تقييمها؟", section: "إعدادات التقييم", type: "نعم/لا", sourceKind: "دور بشري", sourceRef: "سؤال وجوبي عند اختيار نوع العقار — نعم يفتح حصر الإنشاءات والتكلفة ولو كان النوع أرضًا (تعديل ق-3)", responsible: ["معاين", "مقيم عقاري"], correction: "تعديل مباشر", tags: ["تقييم", "أسلوب التكلفة"], required: true },
  { label: "حالة العقار", section: "الأصل محل التقييم", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "المعاين — للمباني فقط: ممتاز (جديد) · جيد · متهالك · قيد الإنشاء؛ يُحذف الحقل للأرض", responsible: ["معاين"], correction: "إرجاع للمصدر", tags: ["تقييم"], required: false },
  { label: "وصف المنقولات", section: "الأصل محل التقييم", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "الميداني — وصف حر لما رآه؛ الغياب يُدوَّن نفيًا", responsible: ["معاين"], correction: "إرجاع للمصدر", tags: ["تقييم"], required: false },
  { label: "الواجهات (٤ جهات)", section: "حدود وأطوال العقار", type: "نص ×4", sourceKind: "دور بشري", sourceRef: "المعاين — نوع الواجهة لكل جهة، إلزامي، للأراضي والمباني", responsible: ["معاين"], correction: "إرجاع للمصدر", tags: ["تقييم", "مساحية"], required: true },
  { label: "المرافق في منطقة العقار", section: "الخدمات والمرافق", type: "قائمة ×4", sourceKind: "دور بشري", sourceRef: "الميداني — القيم المعروضة: متوفر/غير متوفر؛ والحالة الثالثة 'لم يُجب' تقنية محفوظة (الفارغ ≠ غير متوفر — الوزن القانوني، ق1 خريطة الحقن)؛ للأرض بلا عدادات", responsible: ["معاين"], correction: "إرجاع للمصدر", tags: ["تقييم"], required: false },
  // المخرجات والمبررات المستحدثة
  { label: "مبرر استخدام طرق التقييم", section: "رأي القيمة النهائي", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "المقيّم — ذيل جدول الترجيح، أو جدول مستقل بالعنوان نفسه عند طريقة واحدة", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["مبرر إلزامي"], required: true },
  { label: "مبرر معامل التصفية/البيع القسري", section: "رأي القيمة النهائي", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "المقيّم — يُطبع تحت القيمة النهائية", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["مبرر إلزامي"], required: false },
  { label: "هل استُعين بأخصائي؟", section: "الافتراضات", type: "نعم/لا", sourceKind: "دور بشري", sourceRef: "لا (افتراضي) ⟵ بند نفي قياسي · نعم ⟵ توضيح إلزامي (الأخصائي، دوره، نتيجته) يحل محل النفي — IVS 101 1-20/ل", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["تقييم"], required: true },
  { label: "الافتراضات الخاصة (انتقاء)", section: "الافتراضات", type: "اختيار متعدد + إضافة", sourceKind: "دور بشري", sourceRef: "مكتبة بنود طبقة الشركة + إضافة حرة + بنود مرشحة للاشتقاق يقترحها النظام", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["تقييم", "قانونية"], required: true },
  { label: "صور العقار", section: "المرفقات", type: "مرفق متعدد", sourceKind: "دور بشري", sourceRef: "الميداني — مؤرخة آليًا؛ القياسي 6 للأرض و12 للمباني، 6 بالصفحة", responsible: ["معاين"], correction: "إرجاع للمصدر", tags: ["تقييم"], required: true },
];

// كيانات مستجدة (v3) — تُنمذج ولا تُختزل في حقول
export const SEED_ENTITIES_V3 = [
  "سجل العملاء (تسجيل مسبق إلزامي)",
  "كيان العقار + تفريغ الصك المنظم (الملاك وحصصهم، القيود، الحدود، المساحة) + نوع الصك (سجل عيني/تقليدي)",
  "العقار المجمع (صكوك متعددة لعقار واحد — قد تتفرق على أوامر عمل)",
  "بنك العقارات المشترك (روافد: ميداني · مكتبي · اقتراح آلي بالقرب الجغرافي)",
  "حصر المباني/الإنشاءات (الميداني — مصدر واحد يغذي المساحات والتكلفة والمكونات)",
  "سجل المقيمين (بيانات + تواقيع) وبيانات المنشأة (المعتمد + الختم + الترخيص/العضوية)",
  "قاموس المرفقات + مكتبة مستندات المعاملة (مستندات المعاملة ≠ مرفقات التقرير)",
  "دراسة الحالة (الإطار الجامع — التقييم مخرجها الأهم؛ دارس الحالة يطابق الصك/الطبيعة والاختلاف مرشح تعذر)",
];

// ═══════════════════════════════════════════════════════════════
// إضافات v4 — قرارات المجلس الاستشاري 2026-08-16 (القرارات 15–26)
// ═══════════════════════════════════════════════════════════════
export const SEED_FIELDS_V4_ADDITIONS = [
  // ── أساس/فرضية القيمة (القرار 15) — حقلان مستقلان ──
  { label: "فرضية القيمة", section: "إعدادات التقييم", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "القرار 15: مستقل عن الأساس — أعلى وأفضل استخدام · الاستخدام الحالي · التصفية المنظمة · البيع القسري؛ قاعدة توافق: عند أساس=قيمة التصفية تنحصر في (التصفية المنظمة/البيع القسري) — IVS 102 ف5-10", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["تقييم"], required: true },
  { label: "الغرض من التقييم", section: "نطاق العمل", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "يختاره المقيّم — أحيانًا إنفاذ قطاع خاص = قيمة سوقية لا تصفية (القرار §4ج-5)", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["تقييم"], required: true },
  { label: "وصف العقار", section: "الأصل محل التقييم", type: "نص طويل", sourceKind: "مشتق قابل للتحرير", sourceRef: "توليد أولي من بيانات العقار + تحرير حر للمقيّم (نمط مشتق قابل للتحرير — spec §2)", responsible: ["مقيم عقاري"], correction: "توليد أولي + تحرير حر", tags: ["تقييم"], required: false },

  // ── حدود/نطاق المعاينة (القرار 24 + ق-7) ──
  { label: "نطاق المعاينة", section: "نطاق العمل", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "القرار 24: كاملة (داخل وخارج) · خارجية فقط · مكتبية عن بُعد (خرائط/أقمار) — إلزامي على المعاين", responsible: ["معاين"], correction: "إرجاع للمصدر", tags: ["تقييم", "تنبيه منهجي"], required: true },
  { label: "وحدات لم تُعايَن", section: "نطاق العمل", type: "بنية متكررة (عدد + سبب)", sourceKind: "دور بشري", sourceRef: "القرار 24: عدد الوحدات/الشقق غير المعاينة وسبب كل حالة (إشغال بمستأجرين، تعذّر دخول…)", responsible: ["معاين"], correction: "إرجاع للمصدر", tags: ["تقييم"], required: false },
  { label: "سبب تقييد المعاينة", section: "نطاق العمل", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "القرار 24 + ق-7: إلزامي عند نطاق خارجية/مكتبية — يشرح لماذا تمّت بهذه القيود (تنبيه بمبرر)؛ يركّب نص التحفّظ ضمن الافتراضات", responsible: ["معاين"], correction: "إرجاع للمصدر", requiredWhen: "نطاق المعاينة ≠ كاملة", required: false },

  // ── جودة بنك المقارنات (ق-3) ──
  { label: "استخدام المقارن", section: "بنك المقارنات", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "ق-3/5: قائمة مغلقة = نفس قائمة الاستخدام للعقار محل التقييم — لا نص حر", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: true },
  { label: "مرجع الصفقة", section: "بنك المقارنات", type: "نص", sourceKind: "دور بشري", sourceRef: "ق-3: رقم/مرجع صفقة البورصة العقارية للمنفّذ — نظير رقم الإعلان للعروض", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], requiredWhen: "نوع العملية = صفقة منفّذة (اختياري)", required: false },
  { label: "وسم موثوقية المقارن", section: "بنك المقارنات", type: "قائمة اختيار", sourceKind: "دور بشري", sourceRef: "ق-3: عادي · شاذ · غير موثوق — يضعه المقيّم بمبرر؛ السجل يبقى لا يُحذف، يُستبعد من الاقتراحات أو يُميَّز", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: false },
  { label: "وسم المكرر", section: "بنك المقارنات", type: "نعم/لا + مبرر", sourceKind: "دور بشري", sourceRef: "ق-3: بشري لا آلي — النظام يقترح الاشتباه (نفس الموقع) ولا يدمج؛ يضعه أي ذي صفة. مبدأ: العقار قد يُباع مرات وكل بيعة معلومة قيّمة — المرفوض تسجيل نفس العملية مرتين", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["بنك المقارنات"], required: false },
  { label: "مبرر الوسم", section: "بنك المقارنات", type: "نص طويل", sourceKind: "دور بشري", sourceRef: "ق-3: إلزامي عند وضع وسم شاذ/غير موثوق/مكرر", responsible: ["مقيم عقاري"], correction: "تعديل مباشر", tags: ["بنك المقارنات", "مبرر إلزامي"], requiredWhen: "أي وسم مفعّل", required: false },

  // ── الإيداع (ق-6) ──
  { label: "رمز الإيداع", section: "الاعتماد والإصدار", type: "نص", sourceKind: "دور بشري", sourceRef: "ق-6: من شهادة الإيداع الصادرة من منصة قيمة بعد الرفع اليدوي — يُدخل يدويًا؛ خارج نطاق التجميد", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["تقييم"], required: false },
  { label: "شهادة الإيداع", section: "المرفقات", type: "مرفق", sourceKind: "دور بشري", sourceRef: "ق-6: صفحة شهادة الإيداع من قيمة — تُحفظ مستندًا وتدخل التقرير صفحةً مرفقة في النسخة النهائية", responsible: ["مقيم مراجع"], correction: "تعديل مباشر", tags: ["تقييم"], required: false },
];

// أدوار محدثة (v4): تمييز توزيع المعاملة عن إسناد المهام (ق-15أ)
export const SEED_ROLES_V4 = [
  // أطراف توزيع المعاملة (ق-9):
  "معاين", "مقيم عقاري", "مكتب هندسي", "أخصائي دراسة الحالة",
  // أدوار مساندة/مراجعة:
  "مقيم مراجع", "المقيم المعتمد", "مشرف القسم",
  // من إسناد المهام لا من توزيع المعاملة (ق-15أ): 
  "مراجع حكومي",
];

// كيانات محدثة (v4) — تصحيح غياب كيان المعاملة + آلة الحالات + إسناد المهام
export const SEED_ENTITIES_V4 = [
  "سجل العملاء (تسجيل مسبق إلزامي)",
  "المعاملة / أمر العمل (يرد من إنفاذ — حامل رقم الطلب/التكليف ومكتبة المستندات؛ أساس منطق العقار المجمع؛ أوامر العمل مستقلة إداريًا)",
  "كيان العقار + تفريغ الصك المنظم (الملاك وحصصهم، القيود، الحدود والأطوال، المساحة) + نوع الصك (سجل عيني/تقليدي)",
  "العقار المجمع (صكوك متعددة لعقار واحد — قد تتفرق على أوامر عمل؛ تقرير تقييم واحد جامع — ق-14)",
  "بنك العقارات المشترك (روافد: ميداني · مكتبي؛ الاقتراح الآلي بالقرب مؤجَّل — ق-15) + وسوم الجودة البشرية (شاذ/غير موثوق/مكرر)",
  "حصر المباني/الإنشاءات (الميداني — مصدر واحد يغذي المساحات والتكلفة والمكونات)",
  "سجل المقيمين + بيانات المنشأة المشتركة (المعتمد + الختم + التوقيع + الترخيص/العضوية — تُستهلك في كل المخرجات: تقييم/دراسة حالة/خطابات — القرار 25)",
  "قاموس المرفقات + مكتبة مستندات المعاملة (مستندات المعاملة ≠ مرفقات التقرير)",
  "دراسة الحالة (الإطار الجامع — التقييم مخرجها الأهم؛ دارس الحالة يطابق الصك/الطبيعة، والاختلاف مرشح تعذر)",
  "آلة حالات المعاملة (ق-9: إنفاذ ⟵ بيانات أولية ⟵ استعلام بورصة ⟵ توزيع على الأطراف الأربعة باعتمادياتها ⟵ إيداع قيمة ⟵ رفع حزمة إنفاذ؛ حالة المعاملة مشتقة من حالات الأطراف)",
  "إسناد المهام (منظومة أعم من توزيع المعاملة — تُسنِد مهامًا لأدوار كالمراجع الحكومي خارج سير المعاملة — ق-15أ)",
  "منظومة النصوص المعيارية (حزمة واحدة برقم نسخة واحد — القرار 23 المعدّل؛ المُصدَر يُجمَّد لقطةً عند الإصدار)",
];
