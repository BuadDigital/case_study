namespace RealEstateEval.Domain;

/// <summary>
/// Provisional narrative fills for report / 18 / 20 from live context.
/// Legal frozen layers stay versioned at issue; these are data-driven drafts.
/// </summary>
public static class ValuationReportNarrativeRules
{
    public static string ResearchScopeBody(
        IReadOnlyList<string> comparableSources,
        int adoptedCount)
    {
        var sources = comparableSources
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var sourceLine = sources.Count == 0
            ? "سجلات بنك المقارنات في الشركة ومصادر العروض/الصفقات المعتمدة في الطلب."
            : "مصادر المقارنات المعتمدة: " + string.Join(" · ", sources) + ".";

        return
            "نطاق البحث وطبيعة ومصدر المعلومات — "
            + $"عدد المقارنات المعتمدة: {adoptedCount}. "
            + sourceLine
            + " يشمل البحث عروض وصفقات السوق، سجلات ومعاملات الشركة السابقة، وأدلة/إصدارات الهيئة عند الاقتضاء.";
    }

    public static string SpecialAssumptionsBody(
        bool hasStructures,
        string? deedKindLabelAr,
        string? basisLabelAr,
        string? premiseLabelAr,
        string? restrictionsLine,
 // القرار 24 — نص تحفّظ حدود المعاينة المركّب آلياً (فارغ عند معاينة كاملة).
        string? inspectionReservationLine = null,
 // بند الأخصائي (IVS 101 1-20/ل): «لا» ⟵ نفي قياسي · «نعم» ⟵ التوضيح يحل محله.
        bool externalSpecialistUsed = false,
        string? externalSpecialistDetails = null,
 // بنود منتقاة من مكتبة إعدادات تبويب تقرير التقييم + إضافات المقيّم الحرة.
        IReadOnlyList<string>? selectedAssumptions = null,
 // سطر الأثر الرجعي عند اختياره (التاريخ + المبرر).
        string? retrospectiveLine = null)
    {
        var bits = new List<string>
        {
            "تؤخذ العوامل البيئية والاجتماعية وعوامل الحوكمة (ESG) في الاعتبار عند تقييم العقار، ويُشار إليها في التقرير متى ثبت تأثيرها على القيمة التقديرية أثناء تنفيذ مهمة التقييم.",
        };

        if (!string.IsNullOrWhiteSpace(deedKindLabelAr))
            bits.Add($"نوع الصك المعتمد في التفريغ: {deedKindLabelAr.Trim()}.");

        bits.Add(hasStructures
            ? "يشمل نطاق القيمة المباني/الإنشاءات محل التقييم وفق حصر المكونات."
            : "يُفترض أن الأصل أرض فضاء بلا مبانٍ تُقيَّم ضمن الرأي، ما لم يُذكر خلاف ذلك.");

        if (!string.IsNullOrWhiteSpace(basisLabelAr))
        {
            var premise = string.IsNullOrWhiteSpace(premiseLabelAr)
                ? ""
                : $" (فرضية: {premiseLabelAr.Trim()})";
            bits.Add($"أساس القيمة المحدد في نطاق العمل: {basisLabelAr.Trim()}{premise}.");
        }

        if (!string.IsNullOrWhiteSpace(restrictionsLine))
            bits.Add($"قيود مدوّنة على العقار: {restrictionsLine.Trim()}.");

        if (!string.IsNullOrWhiteSpace(inspectionReservationLine))
            bits.Add(inspectionReservationLine.Trim());

 // بند الأخصائي — الأخصائي الخارجي الذي استعان به المقيّم لمهمة التقييم حصراً
 // (لا أخصائي الإسناد ولا أخصائي دراسة الحالة — دوران داخليان في سير المعاملة).
        bits.Add(externalSpecialistUsed && !string.IsNullOrWhiteSpace(externalSpecialistDetails)
            ? $"استُعين في هذه المهمة بأخصائي خارجي: {externalSpecialistDetails.Trim()}، وتقريره مرفق بالتقرير."
            : "لم يستعن المقيّم بأي أخصائي خارجي في أداء مهمة التقييم هذه.");

        if (!string.IsNullOrWhiteSpace(retrospectiveLine))
            bits.Add(retrospectiveLine.Trim());

        foreach (var a in selectedAssumptions ?? [])
        {
            var t = (a ?? "").Trim();
            if (t.Length == 0) continue;
            if (externalSpecialistUsed
                && ValuationApproachSettingsRules.IsNoExternalSpecialistAssumption(t))
                continue;
            bits.Add(t.EndsWith('.') || t.EndsWith('؟') ? t : t + ".");
        }

        return string.Join(" ", bits);
    }

    public static string ComparablesMapBody(
        string? subjectLat,
        string? subjectLon,
        IReadOnlyList<(int Index, string Label, string? Lat, string? Lon)> points)
    {
        var subject = !string.IsNullOrWhiteSpace(subjectLat) && !string.IsNullOrWhiteSpace(subjectLon)
            ? $"إحداثيات الأصل: {subjectLat}, {subjectLon}."
            : "إحداثيات الأصل غير متوفرة من المعاينة بعد.";

        if (points.Count == 0)
            return subject + " لا نقاط مقارنات معتمدة للخريطة.";

        var list = string.Join(
            " · ",
            points.Select(p =>
            {
                var coord = !string.IsNullOrWhiteSpace(p.Lat) && !string.IsNullOrWhiteSpace(p.Lon)
                    ? $"{p.Lat}, {p.Lon}"
                    : "بدون إحداثيات";
                return $"#{p.Index} {p.Label} ({coord})";
            }));

        return subject
            + " مواقع المقارنات المعتمدة: "
            + list
            + ". تُرسم الخريطة النهائية عند الإصدار من هذه النقاط.";
    }

    /// <summary>
    /// 9190 — valuer-opinion text filled at upload from system data.
    /// Internal platform field; never a printed report section.
    /// </summary>
    public static string ValuerOpinionText(
        decimal finalOpinionValue,
        string? basisLabelAr,
        string? methodsRationale)
    {
        var basis = string.IsNullOrWhiteSpace(basisLabelAr) ? "أساس القيمة المحدد في نطاق العمل" : basisLabelAr.Trim();
        var rationale = string.IsNullOrWhiteSpace(methodsRationale) ? "" : " " + methodsRationale.Trim();
        return
            $"يرى المقيّم أن قيمة العقار وفق {basis} بتاريخ التقييم هي "
            + ValuationReportDisplayRules.FormatMoney(finalOpinionValue)
            + " ريال سعودي، بناءً على التحليل والطرق الموثقة في التقرير."
            + rationale;
    }

    /// <summary>
    /// 9360/9370 — risks list/text filled at upload from live context.
    /// Provisional standard lines; the structured risk field stays deferred.
    /// </summary>
    public static IReadOnlyList<string> RisksList(
        bool liquidationBasis,
        bool hasStructures,
        string? deedNatureMatchOutcome)
    {
        var risks = new List<string>
        {
            "تقلبات السوق العقاري بين تاريخ التقييم وتاريخ أي تصرف لاحق في الأصل.",
        };

        if (liquidationBasis)
            risks.Add("أثر ظروف البيع ضمن أساس قيمة التصفية على السعر المتحقق مقارنة بالقيمة السوقية.");

        if (hasStructures)
            risks.Add("حالة المباني/الإنشاءات ومدى مطابقتها للتراخيص قد تؤثر على القيمة.");

        if (string.Equals(deedNatureMatchOutcome?.Trim(), DeedNatureMatchOutcomes.Differences, StringComparison.OrdinalIgnoreCase))
            risks.Add("فروق مرصودة بين الصك والطبيعة — موثقة في دراسة الحالة وقد تقيّد الرأي.");

        return risks;
    }

    public static string RisksText(IReadOnlyList<string> risksList) =>
        string.Join(" ", risksList);

 /// <summary>
 /// usage-restriction sentence with the three derived cases:
 /// no other users / one user / several users listed by name.
 /// </summary>
    public static string UsageRestrictionSentence(
        string? clientNameAr,
        IReadOnlyList<string> reportUserNames)
    {
        var client = string.IsNullOrWhiteSpace(clientNameAr) ? "العميل" : clientNameAr.Trim();
        var users = reportUserNames
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Select(n => n.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (users.Count == 0)
        {
            return $"أُعد هذا التقرير لاستخدام العميل ({client}) وحده، ولا يجوز لأي طرف آخر الاعتماد عليه دون موافقة كتابية مسبقة.";
        }

        if (users.Count == 1)
        {
            return $"أُعد هذا التقرير لاستخدام العميل ({client}) ومستخدم التقرير ({users[0]})، ولا يجوز لأي طرف آخر الاعتماد عليه دون موافقة كتابية مسبقة.";
        }

        return $"أُعد هذا التقرير لاستخدام العميل ({client}) ومستخدمي التقرير: {string.Join(" · ", users)}، ولا يجوز لأي طرف آخر الاعتماد عليه دون موافقة كتابية مسبقة.";
    }
}
