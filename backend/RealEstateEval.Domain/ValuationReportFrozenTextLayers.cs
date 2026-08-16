namespace RealEstateEval.Domain;

/// <summary>
/// Frozen text layers for report §§4/5/19/21/26/27 — versioned at issue.
/// Provisional wording until legal-copy workshop; structure matches decisions log.
/// </summary>
public static class ValuationReportFrozenTextLayers
{
    public const string VersionId = "ejadah-frozen-text-v1-2026-08-16";

    public static string ForSectionKey(string key) => key switch
    {
        ValuationReportSectionKeys.ProfessionalStandards => ProfessionalStandards,
        ValuationReportSectionKeys.Independence => Independence,
        ValuationReportSectionKeys.Restrictions => Restrictions,
        ValuationReportSectionKeys.Terms => Terms,
        ValuationReportSectionKeys.IvsStandards => IvsStandards,
        ValuationReportSectionKeys.Glossary => Glossary,
        _ => "",
    };

    public const string ProfessionalStandards =
        "أُعدّ هذا التقرير وفق المعايير المهنية المعتمدة لدى الهيئة السعودية للمقيّمين المعتمدين، "
        + "وبما لا يتعارض مع المعايير الدولية للتقييم (IVS) السارية بتاريخ إعداد التقرير. "
        + "يتحمّل المقيم المعتمد المسؤولية المهنية عن الرأي الوارد فيه ضمن نطاق العمل المحدد.";

    public const string Independence =
        "يقرّ المقيم المعتمد والمشاركون في إعداد التقرير باستقلاليتهم وخلوّ مهمتهم من تضارب مصالح "
        + "يؤثر في موضوعية الرأي، وبأن الأتعاب لا تتوقف على نتيجة القيمة التقديرية.";

    public const string Restrictions =
        "هذا التقرير معدّ للغرض وللعميل المحددين في نطاق العمل، ولا يجوز نشره أو نسخه أو الاعتماد عليه "
        + "من طرف ثالث دون موافقة كتابية مسبقة من الجهة المُصدِرة، باستثناء ما يقتضيه النظام أو الجهة الرقابية.";

    public const string Terms =
        "الرأي الوارد تقدير مهني في تاريخ التقييم وفق المعلومات المتاحة والأساس والفرضية المعتمدين. "
        + "لا يُعد ضمانًا لسعر بيع مستقبلي، ولا يغني عن الفحص القانوني أو الهندسي المستقل عند الحاجة. "
        + "أي اعتماد خارج نطاق العمل يكون على مسؤولية المستخدم.";

    public const string IvsStandards =
        "يُستشهد بالمعايير الدولية للتقييم (IVS) بالفقرة ذات الصلة دون نسخ نصي للمحتوى المحمي. "
        + "تعريفات أساس القيمة وفرضية القيمة وقيمة التصفية تُشتق من الحقول المختارة في نطاق العمل "
        + "ومن الملحق (أ)60 عند انطباق قيمة التصفية.";

    public const string Glossary =
        "المصطلحات الفنية المستخدمة في التقرير تطابق التعريفات المعتمدة في قائمة IVS "
        + "(منها: التقييم، أساس القيمة، المقيم، قيمة التصفية، الحكم المهني، الشك المهني) "
        + "مع الاستثناءات المنصوص عليها للترجمة المعتمدة.";
}
