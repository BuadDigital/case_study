using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Platform.Infrastructure.Data;

/// <summary>Default valuation reference lists — source: settings v2.dc.html VAL_LISTS / REF_DEFAULTS.</summary>
internal static class ValuationListsSeed
{
    internal const string DefaultIvsDate = "31 يناير 2025";
    internal const int DefaultPhotoPagesLand = 1;
    internal const int DefaultPhotoPagesBuilt = 2;

    internal static Dictionary<string, List<ValuationListItemDto>> Defaults() => new()
    {
        [ValuationListIds.Purposes] = Purposes(),
        [ValuationListIds.ValueBases] = ValueBases(),
        [ValuationListIds.Premises] = Premises(),
        [ValuationListIds.Methods] = Methods(),
        [ValuationListIds.Comparables] = Comparables(),
        [ValuationListIds.Facades] = Facades(),
        [ValuationListIds.BoundaryTypes] = BoundaryTypes(),
        [ValuationListIds.Glossary] = Glossary(),
        [ValuationListIds.IvsStandards] = IvsStandards(),
        [ValuationListIds.Attachments] = Attachments(),
    };

    private static ValuationListItemDto Row(
        string listId, int i, string key, string name, int usage, params string[] cells) =>
        new()
        {
            Id = $"{listId}-{key}",
            Key = key,
            Name = name,
            Cells = cells,
            IsEnabled = true,
            DefaultName = name,
            Usage = usage,
            SortOrder = i,
            IsSystemDefault = true,
        };

    private static List<ValuationListItemDto> Purposes()
    {
        var i = 0;
        return
        [
            Row(ValuationListIds.Purposes, ++i, "auction_liquidation", "البيع بالمزاد العلني لغرض التصفية", 96, "قيمة التصفية"),
            Row(ValuationListIds.Purposes, ++i, "estate_liquidation", "تصفية التركات", 71, "قيمة التصفية"),
            Row(ValuationListIds.Purposes, ++i, "sale", "البيع", 27, "القيمة السوقية"),
            Row(ValuationListIds.Purposes, ++i, "purchase", "الشراء", 17, "القيمة السوقية"),
            Row(ValuationListIds.Purposes, ++i, "financing", "التمويل والرهن العقاري", 38, "القيمة السوقية"),
            Row(ValuationListIds.Purposes, ++i, "financial_reporting", "التقارير المالية", 12, "القيمة العادلة"),
            Row(ValuationListIds.Purposes, ++i, "litigation", "التقاضي وفض النزاعات", 9, "القيمة السوقية"),
            Row(ValuationListIds.Purposes, ++i, "expropriation", "نزع الملكية للمنفعة العامة", 5, "القيمة السوقية"),
            Row(ValuationListIds.Purposes, ++i, "judicial_execution", "تنفيذ قضائي", 0, "قيمة التصفية"),
            Row(ValuationListIds.Purposes, ++i, "sale_purchase", "بيع أو شراء", 0, "القيمة السوقية"),
            Row(ValuationListIds.Purposes, ++i, "other", "أخرى", 0, "—"),
        ];
    }

    private static List<ValuationListItemDto> ValueBases()
    {
        var i = 0;
        return
        [
            Row(ValuationListIds.ValueBases, ++i, "market", "القيمة السوقية", 118, "المبلغ المقدَّر لتبادل الأصل في تاريخ التقييم بين مشترٍ راغب وبائع راغب، في معاملة محايدة بعد تسويق مناسب، ويتصرف فيها كل طرف بمعرفة وحكمة ودون إكراه."),
            Row(ValuationListIds.ValueBases, ++i, "market_rent", "الإيجار السوقي", 8, "المقابل الإيجاري المقدَّر للأصل في تاريخ التقييم بنفس اشتراطات القيمة السوقية، مع مراعاة شروط عقد الإيجار المفترضة."),
            Row(ValuationListIds.ValueBases, ++i, "equitable", "القيمة المنصفة", 3, "السعر العادل بين طرفين محدَّدين بعينهما، يعكس مزايا كل منهما وعيوبه — أوسع من السوقية لأنه لا يفترض سوقًا عامة ولا تسويقًا مفتوحًا."),
            Row(ValuationListIds.ValueBases, ++i, "investment", "القيمة الاستثمارية", 6, "قيمة الأصل لدى مالك أو مستثمر بعينه وفق أهدافه الاستثمارية أو التشغيلية — قيمة خاصة بالكيان قد تفوق أو تقل عن السوقية."),
            Row(ValuationListIds.ValueBases, ++i, "synergistic", "القيمة التكاملية", 2, "القيمة الزائدة الناتجة عن دمج أصلين أو أكثر بحيث تفوق قيمة المجموع قيمة كل أصل منفردًا (قيمة التآزر/الاندماج)."),
            Row(ValuationListIds.ValueBases, ++i, "liquidation", "قيمة التصفية", 167, "المبلغ المتحقق من بيع الأصل — كليًا أو مجزّأً — خارج ظروف التسويق المعتادة؛ ولها فرضيتان: تصفية منظمة أو بيع قسري. وهي الأساس الغالب في ملفات التنفيذ القضائي."),
            Row(ValuationListIds.ValueBases, ++i, "fair_ifrs", "القيمة العادلة (IFRS)", 12, "السعر الذي يُقبَض لبيع أصل أو يُدفَع لنقل التزام في معاملة منظمة بين مشاركين في السوق في تاريخ القياس — تعريف محاسبي (IFRS 13) لأغراض التقارير المالية."),
            Row(ValuationListIds.ValueBases, ++i, "fair_statutory", "القيمة العادلة (القانونية/التشريعية)", 4, "ما يعرّفه النظام أو اللائحة أو العقد أو حكم القضاء — قد يختلف مضمونها عن الأساسين السابقين، فيلزم النص على مصدر التعريف."),
        ];
    }

    private static List<ValuationListItemDto> Premises()
    {
        var i = 0;
        return
        [
            Row(ValuationListIds.Premises, ++i, "hau", "أعلى وأفضل استخدام", 31, "القيمة السوقية"),
            Row(ValuationListIds.Premises, ++i, "current", "الاستخدام الحالي", 84, "القيمة السوقية"),
            Row(ValuationListIds.Premises, ++i, "orderly", "التصفية المنظمة", 152, "أساس القيمة (التصفية)"),
            Row(ValuationListIds.Premises, ++i, "forced", "البيع القسري", 15, "أساس القيمة (التصفية)"),
        ];
    }

    private static List<ValuationListItemDto> Methods()
    {
        var i = 0;
        return
        [
            Row(ValuationListIds.Methods, ++i, "comparison", "طريقة المقارنة", 214, "أسلوب السوق"),
            Row(ValuationListIds.Methods, ++i, "cost_replacement", "طريقة التكلفة (الإحلال)", 133, "أسلوب التكلفة"),
            Row(ValuationListIds.Methods, ++i, "dcf", "طريقة التدفقات النقدية المخصومة", 22, "أسلوب الدخل"),
            Row(ValuationListIds.Methods, ++i, "direct_cap", "طريقة رسملة الدخل (الرسملة المباشرة)", 31, "أسلوب الدخل"),
            Row(ValuationListIds.Methods, ++i, "residual", "طريقة القيمة المتبقية", 7, "أسلوب الدخل"),
            Row(ValuationListIds.Methods, ++i, "profits", "طريقة الأرباح", 3, "أسلوب الدخل"),
        ];
    }

    private static List<ValuationListItemDto> Comparables()
    {
        var i = 0;
        return
        [
            Row(ValuationListIds.Comparables, ++i, "comp_type", "العقار المقارن (نوعه)", 214, "إدخال — من قائمة أنواع العقار"),
            Row(ValuationListIds.Comparables, ++i, "deal_kind", "نوع العملية", 214, "إدخال (اختيار) — صفقة منفّذة / عرض حد / عرض سوم"),
            Row(ValuationListIds.Comparables, ++i, "source", "مصدر المعلومة", 180, "إدخال (اختيار) — منصة عقارية / وسيط / مالك / أخرى"),
            Row(ValuationListIds.Comparables, ++i, "listing_no", "رقم الإعلان / المعلومة", 168, "إدخال — يظهر حسب المصدر"),
            Row(ValuationListIds.Comparables, ++i, "phone", "رقم التواصل", 160, "إدخال — جوال المعلن أو الوسيط"),
            Row(ValuationListIds.Comparables, ++i, "area", "المساحة (م²)", 214, "إدخال — رقمي"),
            Row(ValuationListIds.Comparables, ++i, "deal_date", "تاريخ العملية", 214, "إدخال — تاريخ"),
            Row(ValuationListIds.Comparables, ++i, "price", "السعر (ر.س.)", 214, "إدخال — رقمي"),
            Row(ValuationListIds.Comparables, ++i, "unit_price", "سعر المتر (محسوب)", 214, "يُحسب تلقائيًا = السعر ÷ المساحة — لا يُدخله المستخدم"),
            Row(ValuationListIds.Comparables, ++i, "city", "المدينة", 214, "يُختار من قائمة مدن المنطقة"),
            Row(ValuationListIds.Comparables, ++i, "district", "الحي", 214, "يُختار من قائمة أحياء المدينة"),
            Row(ValuationListIds.Comparables, ++i, "plan_no", "رقم المخطط", 150, "إدخال"),
            Row(ValuationListIds.Comparables, ++i, "plot", "القطعة", 150, "إدخال"),
            Row(ValuationListIds.Comparables, ++i, "comp_desc", "وصف العقار", 214, "إدخال — يعدّه الأخصائي"),
            Row(ValuationListIds.Comparables, ++i, "coords", "الإحداثيات", 112, "إدخال — تحديد على الخريطة"),
        ];
    }

    /// <summary>
    /// «أنواع الواجهات» — inspector «نوع الواجهة» picker (mobile + desktop wizard).
    /// </summary>
    private static List<ValuationListItemDto> Facades()
    {
        var i = 0;
        return
        [
            Row(ValuationListIds.Facades, ++i, "paint", "دهان", 0),
            Row(ValuationListIds.Facades, ++i, "stone", "حجر", 0),
            Row(ValuationListIds.Facades, ++i, "marble", "رخام", 0),
            Row(ValuationListIds.Facades, ++i, "glass", "زجاج", 0),
            Row(ValuationListIds.Facades, ++i, "brick", "طوب", 0),
            Row(ValuationListIds.Facades, ++i, "none", "بدون تشطيب", 0),
            Row(ValuationListIds.Facades, ++i, "other", "أخرى", 0),
        ];
    }

    /// <summary>
    /// «أنواع الحد» — PO bourse boundary «النوع» column (street · plot · passage · rail).
    /// </summary>
    private static List<ValuationListItemDto> BoundaryTypes()
    {
        var i = 0;
        return
        [
            Row(ValuationListIds.BoundaryTypes, ++i, "street", "شارع", 0),
            Row(ValuationListIds.BoundaryTypes, ++i, "plot", "قطعة", 0),
            Row(ValuationListIds.BoundaryTypes, ++i, "passage", "ممر", 0),
            Row(ValuationListIds.BoundaryTypes, ++i, "rail", "سكة", 0),
        ];
    }

    private static List<ValuationListItemDto> IvsStandards()
    {
        var i = 0;
        return
        [
            Row(ValuationListIds.IvsStandards, ++i, "ivs_100", "المعيار 100 – إطار التقييم", 214, "الأساس الذي تُبنى عليه كل عملية تقييم؛ ينطبق على الأصول والالتزامات كافة وتتفرع عنه معايير الأصول بمتطلباتها الخاصة، ويرسي مبادئ المقيّم الأربعة (الأخلاقيات، الكفاءة، الالتزام، الشك المهني)، وقواعد مراقبة جودة عملية التقييم، وضوابط الاستعانة بأخصائي، وأحكام الامتثال وتاريخ النفاذ."),
            Row(ValuationListIds.IvsStandards, ++i, "ivs_101", "المعيار 101 – نطاق العمل", 214, "يعنى بالاتفاق الجوهري بين المقيّم والعميل الذي يحدد شروط التعاقد والالتزامات والحد الأدنى من المتطلبات اللازمة لإنجاز عملية التقييم بما يتناسب مع الاستخدام المقصود."),
            Row(ValuationListIds.IvsStandards, ++i, "ivs_102", "المعيار 102 – أسس القيمة", 214, "يوجب على المقيّم اختيار أساس القيمة الملائم للغرض والاستخدام المقصود، والتقيد بكل المتطلبات المرتبطة بالأساس المختار — من أسس المعايير في ملحقه أو من الأسس الأخرى."),
            Row(ValuationListIds.IvsStandards, ++i, "ivs_103", "المعيار 103 – أساليب التقييم", 214, "يوجب دراسة أساليب التقييم الثلاثة (السوق، الدخل، التكلفة) وطرقها المفصلة في ملحقه، واختيار الأنسب منها — أو الجمع بين أكثر من أسلوب — بما يلائم الأصل محل التقييم واستخدامه المقصود."),
            Row(ValuationListIds.IvsStandards, ++i, "ivs_104", "المعيار 104 – البيانات والمدخلات", 214, "يُعنى باختيار بيانات التقييم ومدخلاته وتوثيقها، والغاية بلوغ أقصى استخدام ممكن للبيانات الملحوظة ذات الصلة، مع مسؤولية المقيّم عن تقدير ملاءمة البيانات والافتراضات والتعديلات بحكمه المهني."),
            Row(ValuationListIds.IvsStandards, ++i, "ivs_105", "المعيار 105 – نماذج التقييم", 214, "يُعنى باختيار نماذج التقييم وكيفية استخدامها وتوثيقها، ويقرر أن النموذج — ومنه نماذج التقييم الآلي (AVM) — لا يُنتج وحده تقييمًا ممتثلًا للمعايير ما لم يُعمل المقيّم فيه حكمه المهني."),
            Row(ValuationListIds.IvsStandards, ++i, "ivs_106", "المعيار 106 – التوثيق وإعداد التقارير", 214, "الإجراءات التنظيمية التي تفرض إعداد تقارير نهائية تعكس مخرجات التقييم بوضوح، مع إلزامية توثيق كافة الأدلة وسجلات العمل لضمان الشفافية وقابلية المراجعة المهنية."),
        ];
    }

    private static List<ValuationListItemDto> Attachments()
    {
        var i = 0;
        ValuationListItemDto A(string key, string name, bool required, string property, int usage) =>
            new()
            {
                Id = key,
                Key = key,
                Name = name,
                Cells = [required ? "إلزامي" : "اختياري", property],
                IsEnabled = true,
                DefaultName = name,
                Usage = usage,
                SortOrder = ++i,
                IsSystemDefault = true,
                IsRequired = required,
                PropertyTypeKeys = property is "الكل" or "" ? [] : [property],
            };

        return
        [
            A("deed", "صك الملكية", true, "الكل", 240),
            A("survey", "التقرير المساحي", true, "أرض", 105),
            A("zoning-sketch", "كروكي الموقع", false, "الكل", 77),
            A("building-permit", "رخصة البناء", true, "مبني", 131),
        ];
    }

    private static List<ValuationListItemDto> Glossary()
    {
        var i = 0;
        ValuationListItemDto G(string key, string name, string def, int usage) =>
            Row(ValuationListIds.Glossary, ++i, key, name, usage, def);

        return
        [
            G("org", "المنشأة", "المؤسسة أو الشركة التي تصدر التقرير وينتسب لها المقيم أو يتعاقد معها.", 214),
            G("valuer", "المقيم", "فرد أو مجموعة من الأفراد يمتلك المؤهلات والقدرة والخبرة اللازمة لتنفيذ التقييم بموضوعية وحيادية ونزاهة وكفاءة.", 214),
            G("certified_valuer", "المقيم المعتمد", "شخص طبيعي أو اعتباري مرخص له مزاولة المهنة وفقا لأحكام نظام المقيمين المعتمدين.", 214),
            G("client", "العميل", "الشخص الذي يُعين المُقيّم لإجراء عملية تقييم معينة، داخليًا أو خارجيًا.", 214),
            G("scope", "نطاق العمل", "الشروط الأساسية للتقييم: الأصل محل التقييم، والاستخدام المقصود، ومسؤوليات الأطراف المشاركة.", 214),
            G("basis", "أساس القيمة", "المبادئ الأساسية التي تعتمد عليها القيم المُقرّرة (المعيار 102 — أسس القيمة).", 214),
            G("judgment", "الحكم المهني", "استخدام المعارف والخبرات المُكتسبة وكذلك التفكير النقدي لاتخاذ قرارٍ صائب.", 190),
            G("skepticism", "الشك المهني", "سلوك يقتضي تبنّي عقلية مُتقصية وتقييمًا نقديًا للحصول على أدلة التقييم.", 190),
            G("weighting", "الترجيح", "مقدار الاعتماد على مؤشر قيمة معين للتوصل إلى استنتاج بخصوص القيمة.", 175),
            G("inspection", "معاينة العقار", "زيارة الممتلكات لفحصها والحصول على المعلومات ذات الصلة للتعبير عن رأي مهني في قيمتها.", 214),
            G("valuation_date", "تاريخ التقييم", "التاريخ الذي يسري فيه التحليل والرأي الخاص بعملية التقييم.", 214),
            G("report_date", "تاريخ التقرير", "تاريخ إصدار التقرير واعتماده بصيغته النهائية، ومنه تُحسب مدة صلاحية التقرير.", 214),
            G("freehold", "ملكية مطلقة", "حق تام في ملكية العقار أو الأرض.", 160),
            G("habu", "الاستخدام الأعلى والأفضل", "الاستخدام الممكن ماديًا والمجدي ماليًا والمسموح به قانونًا والذي يحقق أعلى قيمة.", 120),
            G("member", "العضو", "شخص طبيعي أو اعتباري يحمل عضوية سارية لدى الهيئة السعودية للمقيمين المعتمدين.", 214),
            G("external_valuer", "المقيم الخارجي", "مقيم منتسب للهيئة السعودية للمقيمين المعتمدين مستقل عن الأصل محل التقييم ليس له أدنى مصلحة في العقار محل التقييم.", 130),
            G("specialist", "أخصائي", "فرد أو مجموعة من الأفراد يتمتعون بالمهارات التقنية والمعرفة اللازمة لتنفيذ عملية التقييم أو المساعدة في تنفيذها أو مراجعتها، ويمكن توظيف الأخصائي داخليًا أو خارجيًا.", 40),
            G("engagement", "التعاقد", "اتفاق بين المقيم والعميل لتقديم خدمات التقييم أو مراجعة التقييم.", 214),
            G("valuation", "التقييم", "إجراء أو عملية التوصل لاستنتاج بخصوص القيمة اعتبارًا من تاريخ التقييم الذي يُنفذ امتثالًا لمعايير التقييم الدولية.", 214),
            G("purpose", "الغرض من التقييم", "سبب أو أسباب إجراء التقييم، وتشمل الأغراض العامة أغراض التقارير المالية، والتقارير الضريبية، ودعم التقاضي، ودعم المعاملات، ودعم قرارات الإقراض المضمون.", 214),
            G("liq_value", "قيمة التصفية", "المبلغ الإجمالي الذي يمكن تحقيقه عند بيع أصل أو مجموعة أصول بموجب بيع التصفية، مع إجبار البائع على البيع بدءًا من تاريخ محدد — بموجب افتراضي المعاملة المنظمة أو المعاملة الإجبارية (المعيار 102 — الملحق (أ)60).", 167),
            G("user", "مستخدم التقرير", "الشخص أو الأشخاص المخولين لاستخدام تقرير التقييم، وللغرض المحدد فقط.", 214),
            G("property", "العقار", "الأرض وكافة الأشياء التي تشكل جزءًا طبيعيًا منها مثل الأشجار والمعادن، والأشياء التي ألحقت بها مثل المباني وتحسينات الموقع، وجميع مرافق وملاحقات المباني الدائمة فوق الأرض وتحتها.", 214),
            G("rights", "الحقوق العقارية", "الحق في ملكية الأرض والمباني أو السيطرة عليها أو استغلالها أو إشغالها.", 200),
            G("value", "القيمة", "الاستنتاج الكمي للمُقيم بشأن نتائج عملية التقييم التي تمتثل لمتطلبات المعايير في تاريخ التقييم امتثالًا كاملًا.", 214),
            G("market_approach", "أسلوب السوق", "يقدم مؤشرًا على القيمة من خلال مقارنة الأصل أو الالتزام مع أصول أو التزامات مطابقة أو مقارنة (مشابهة) تتوفر عنها معلومات سعرية.", 214),
            G("drc", "تكلفة الإحلال المهلكة (DRC)", "التكلفة الحالية لاستبدال الأصل بأصل مكافئ حديث مطروحًا منها الاستقطاعات المترتبة على التقادم المادي وجميع أشكال التقادم، والتحسينات ذات الصلة.", 133),
            G("cost_approach", "أسلوب التكلفة", "مؤشر للقيمة على مبدأ أن المشتري لن يدفع مقابل الأصل أكثر من تكلفة الحصول على أصل ذي منفعة مماثلة — بحساب التكلفة الحالية للإحلال أو إعادة الإنتاج وتطبيق خصومات لجميع أشكال التقادم.", 133),
            G("income_dcf", "أسلوب الدخل – التدفقات النقدية", "يقدم مؤشرًا للقيمة عن طريق تحويل التدفقات المالية المستقبلية إلى قيمة رأسمالية حالية واحدة.", 22),
            G("income_cap", "أسلوب الدخل – رسملة الدخل", "تحويل الدخل إلى مؤشر قيمة من خلال تطبيق معدل الرسملة المناسب.", 31),
            G("residual", "أسلوب الدخل – طريقة القيمة المتبقية", "مؤشر للقيمة عن طريق خصم مجمل تكاليف التطوير وأرباح المطور من إجمالي قيمة التطوير (GDV) للوصول إلى القيمة المتبقية للأرض أو العقار محل التطوير.", 7),
            G("cap_rate", "معدل الرسملة", "نسبة صافي الدخل التشغيلي لسنة واحدة للأصل إلى قيمة الأصل، ويستخدم لتحويل الدخل إلى قيمة عند تطبيق طريقة رسملة الدخل.", 31),
            G("direct_cap", "الرسملة المباشرة", "تحويل تقدير الدخل السنوي المتوقع لسنة واحدة إلى مؤشر للقيمة في خطوة مباشرة، بقسمة صافي الدخل على معدل رسملة مناسب أو ضربه في عامل مناسب، بمعدلات ومضاعفات مشتقة من بيانات سوقية.", 31),
            G("all_risks", "عائد جميع المخاطر", "معدل الرسملة الذي يأخذ بعين الاعتبار كافة المخاطر والعوائد المرتبطة بملكية استثمار ما ويعكسها في سعر شراء ذلك الاستثمار.", 22),
            G("discount", "معدل الخصم", "معدل العائد المستخدم لتحويل مبلغ نقدي مستحق الدفع في المستقبل إلى قيمة حالية.", 22),
            G("esg", "العوامل البيئية والاجتماعية والحوكمة (ESG)", "المعايير التي تحدد مجتمعةً إطار تقييم تأثير الاستدامة والممارسات الأخلاقية أو الأداء المالي أو العمليات — بركائزها الثلاث: البيئية والاجتماعية والحوكمة.", 96),
            G("profits", "طريقة الأرباح", "طريقة تقييم تستخدم قدرة العقار التجارية لحساب مؤشر لقيمته، بتطبيق مضاعف كافة المخاطر على أرباح التشغيل، وتشمل القيمة فائدة العقار والشهرة والتجهيزات والتركيبات كقيمة واحدة.", 3),
            G("assumptions", "الافتراضات", "أمور منطقية يمكن قبولها كحقيقة في سياق أعمال التقييم دون التحقق والتحقيق فيها على نحو محدد، وتعتبر مقبولة بمجرد ذكرها لتوضيح الرأي المستنتج للقيمة.", 214),
            G("special_assumptions", "الافتراضات الخاصة", "حقائق مُفترضة تختلف عن الحقائق الموجودة في تاريخ التقييم، تُستخدم لتوضيح أثر التغيرات المُحتملة على قيمة الأصل، وتوصف بأنها «خاصة» لأنها تعتمد على تغير في الظروف الراهنة.", 190),
            G("inspection_date", "تاريخ المعاينة", "هو تاريخ الوقوف على العقار وإجراء الفحص البصري.", 214),
            G("opinion_date", "تاريخ إصدار الرأي", "هو تاريخ الوصول للقيمة من قبل المقيم، بغض النظر عن تاريخ التقييم المطلوب.", 214),
            G("award_date", "تاريخ قرار التقدير", "تاريخ اعتماد الجهة صاحبة المشروع لمحضر لجنة التقدير (تقرير اللجنة النهائي).", 15),
            G("current_use", "الاستخدام الحالي", "الطريقة الحالية لاستخدام الأصل أو الالتزام أو مجموعتهما — وقد يكون، وليس بالضرورة، أعلى وأفضل استخدام.", 180),
            G("leasehold", "الملكية الإيجارية", "الحق المؤقت الذي يملكه المستأجر في استخدام العقارات وشغلها لفترة محددة.", 25),
            G("market_rent", "الإيجار السوقي", "المبلغ التقديري لتأجير حق الملكية في تاريخ التقييم بين مؤجر راغب ومستأجر راغب بشروط مناسبة في معاملة محايدة بعد تسويق مناسب.", 8),
            G("rfp", "طلب العروض", "إجراء طلب العروض من خلال تحديد شروط المهمة ومتطلباتها وإعلانها للشركات المتنافسة.", 12),
        ];
    }
}
