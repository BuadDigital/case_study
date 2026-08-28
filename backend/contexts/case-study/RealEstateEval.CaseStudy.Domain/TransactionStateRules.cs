namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// ق-9 (بصياغة سليمان النصية): آلة حالات المعاملة ودراسة الحالة — شبكة توزيع
/// واعتماديات لا سلسلة خطية.
/// المراحل التأسيسية تسلسلية: ورود أمر العمل من إنفاذ ← البيانات الأولية (الصكوك)
/// ← الاستعلام من البورصة العقارية ← التوزيع على الأطراف.
/// مرحلة العمل متوازية باعتماديات — المعاين عقدة المفتاح: المكتب الهندسي ينتظر تأكيد
/// المعاين (ومنه الموقع) ثم يرفع مساحياً · المقيم ينتظر معلومات المعاين وصوره ثم يسعّر
/// · أخصائي دراسة الحالة ينتظر الجميع ثم يكمل.
/// الختام خطوتان مختلفتا الطبيعة: شهادة الإيداع في قيمة (مهنية — تقرير التقييم وحده،
/// ق-6) ثم رفع المعاملة على إنفاذ (تسليم شامل).
/// حالة المعاملة مشتقة من حالات الأطراف، والشاشة تعرض من ينتظر من.
/// (حالات الرجوع/إعادة الفتح ونطاق التجميد الحقلي: للورشة التكميلية — الهيكل هنا حاكم.)
/// </summary>
public static class TransactionStateRules
{
    public static class Stages
    {
        public const string EnfathIntake = "enfath_intake";
        public const string InitialData = "initial_data";
        public const string BourseInquiry = "bourse_inquiry";
        public const string Distribution = "distribution";
        public const string PartyWork = "party_work";
        public const string DepositCertificate = "deposit_certificate";
        public const string EnfazHandover = "enfaz_handover";

        public static readonly IReadOnlyList<(string Key, string LabelAr)> All =
        [
            (EnfathIntake, "ورود أمر العمل من إنفاذ"),
            (InitialData, "البيانات الأولية — إدخال الصكوك"),
            (BourseInquiry, "الاستعلام من البورصة العقارية"),
            (Distribution, "التوزيع على الأطراف"),
            (PartyWork, "عمل الأطراف (متوازٍ باعتماديات)"),
            (DepositCertificate, "شهادة الإيداع في قيمة (ق-6)"),
            (EnfazHandover, "رفع المعاملة على إنفاذ"),
        ];
    }

    public static class Parties
    {
        public const string Inspector = "inspector";
        public const string Appraiser = "appraiser";
        public const string EngineeringOffice = "engineering_office";
        public const string CaseSpecialist = "case_specialist";

        public static string LabelAr(string key) => key switch
        {
            Inspector => "المعاين الميداني",
            Appraiser => "المقيم العقاري",
            EngineeringOffice => "المكتب الهندسي",
            CaseSpecialist => "أخصائي دراسة الحالة",
            _ => key,
        };
    }

 /// <summary>لم يبدأ / قيد العمل / معلق بانتظار طرف / مكتمل — نص القرار حرفياً.</summary>
    public static class Statuses
    {
        public const string NotStarted = "not_started";
        public const string InProgress = "in_progress";
        public const string WaitingOnParty = "waiting_on_party";
        public const string Completed = "completed";

        public static string LabelAr(string key) => key switch
        {
            NotStarted => "لم يبدأ",
            InProgress => "قيد العمل",
            WaitingOnParty => "معلق بانتظار طرف",
            Completed => "مكتمل",
            _ => key,
        };
    }

    public sealed record PartyFacts(bool Assigned, bool Completed);

    public sealed record Input(
 /// <summary>WorkflowTaskPhaseValues wire string لمهمة دراسة الحالة الأم.</summary>
        string ParentPhase,
        PartyFacts Inspector,
        PartyFacts Appraiser,
 /// <summary>null = المعاملة لا تتطلب رفعاً مساحياً.</summary>
        PartyFacts? EngineeringOffice,
        PartyFacts CaseSpecialist,
 /// <summary>ق-6: صدرت النسخة النهائية بشهادة الإيداع (طلب التقييم أُقفل).</summary>
        bool ValuationReportClosed,
        bool EnfazHandedOver);

    public sealed record PartyState(
        string Key,
        string LabelAr,
        string Status,
 /// <summary>مفاتيح الأطراف التي ينتظرها هذا الطرف الآن — «من ينتظر من».</summary>
        IReadOnlyList<string> WaitingOn);

    public sealed record StageState(string Key, string LabelAr, string Status);

    public sealed record Result(
        IReadOnlyList<StageState> Stages,
        IReadOnlyList<PartyState> Parties,
 /// <summary>حالة المعاملة المشتقة من حالات الأطراف.</summary>
        string OverallStatus,
 /// <summary>ملخص «من ينتظر من» للشريط.</summary>
        string WaitingSummaryAr);

    public static Result Evaluate(Input input)
    {
        var phaseRank = PhaseRank(input.ParentPhase);
        var distributionDone = phaseRank >= 3; // بعد مرحلة التوزيع

        var parties = new List<PartyState>();

        // المعاين — عقدة المفتاح: لا ينتظر أحداً.
        var inspector = PartyStateFor(
            Parties.Inspector, input.Inspector, distributionDone, waitingOn: []);
        parties.Add(inspector);

        // المكتب الهندسي ينتظر تأكيد المعاين ثم يرفع مساحياً.
        if (input.EngineeringOffice is not null)
        {
            parties.Add(PartyStateFor(
                Parties.EngineeringOffice,
                input.EngineeringOffice,
                distributionDone,
                waitingOn: input.Inspector.Completed ? [] : [Parties.Inspector]));
        }

        // المقيم ينتظر معلومات المعاين وصوره ثم يسعّر.
        parties.Add(PartyStateFor(
            Parties.Appraiser,
            input.Appraiser,
            distributionDone,
            waitingOn: input.Inspector.Completed ? [] : [Parties.Inspector]));

        // أخصائي دراسة الحالة ينتظر الجميع.
        var specialistWaits = new List<string>();
        if (!input.Inspector.Completed) specialistWaits.Add(Parties.Inspector);
        if (!input.Appraiser.Completed) specialistWaits.Add(Parties.Appraiser);
        if (input.EngineeringOffice is { Completed: false })
            specialistWaits.Add(Parties.EngineeringOffice);
        parties.Add(PartyStateFor(
            Parties.CaseSpecialist,
            input.CaseSpecialist,
            distributionDone,
            waitingOn: specialistWaits));

        var partiesDone = parties.All(p => p.Status == Statuses.Completed);

        // الختام — خطوتان مختلفتا الطبيعة (ق-6 ثم التسليم الشامل).
        var depositDone = input.ValuationReportClosed;
        var handoverReady = depositDone && partiesDone;
        var handoverDone = input.EnfazHandedOver;

        var stages = new List<StageState>();
        foreach (var (key, label) in Stages.All)
        {
            var status = key switch
            {
                Stages.EnfathIntake => StageFromRank(phaseRank, atLeast: 0, doneAt: 1),
                Stages.InitialData => StageFromRank(phaseRank, atLeast: 0, doneAt: 1),
                Stages.BourseInquiry => StageFromRank(phaseRank, atLeast: 1, doneAt: 2),
                Stages.Distribution => StageFromRank(phaseRank, atLeast: 2, doneAt: 3),
                Stages.PartyWork => !distributionDone
                    ? Statuses.NotStarted
                    : partiesDone ? Statuses.Completed : Statuses.InProgress,
                Stages.DepositCertificate => depositDone
                    ? Statuses.Completed
                    : parties.First(p => p.Key == Parties.Appraiser).Status == Statuses.Completed
                        ? Statuses.InProgress
                        : Statuses.WaitingOnParty,
                Stages.EnfazHandover => handoverDone
                    ? Statuses.Completed
                    : handoverReady ? Statuses.InProgress : Statuses.WaitingOnParty,
                _ => Statuses.NotStarted,
            };
            stages.Add(new StageState(key, label, status));
        }

        var overall = handoverDone
            ? Statuses.Completed
            : phaseRank == 0 && !distributionDone && parties.All(p => p.Status == Statuses.NotStarted)
                ? Statuses.NotStarted
                : parties.Any(p => p.Status == Statuses.WaitingOnParty)
                    ? Statuses.WaitingOnParty
                    : Statuses.InProgress;

        return new Result(stages, parties, overall, WaitingSummary(parties, handoverDone));
    }

 /// <summary>رفع إنفاذ الشامل لا يقع قبل شهادة الإيداع واكتمال كل الأطراف.</summary>
    public static bool AllowsEnfazHandover(Input input) =>
        !input.EnfazHandedOver
        && input.ValuationReportClosed
        && Evaluate(input).Stages
            .First(s => s.Key == Stages.PartyWork).Status == Statuses.Completed;

 /// <summary>حزمة رفع إنفاذ (ق-9/ق-14): ما يجب أن يضمّه التسليم الشامل.</summary>
    public static IReadOnlyList<string> HandoverPackageAr(bool hasSurvey) =>
        hasSurvey
            ?
            [
                "تقرير التقييم — النسخة النهائية بشهادة الإيداع (ق-6)",
                "تقرير دراسة الحالة (مخرج مستقل — قرار 22)",
                "الرفع المساحي",
                "المستندات والبيانات الأخرى",
            ]
            :
            [
                "تقرير التقييم — النسخة النهائية بشهادة الإيداع (ق-6)",
                "تقرير دراسة الحالة (مخرج مستقل — قرار 22)",
                "المستندات والبيانات الأخرى",
            ];

    private static PartyState PartyStateFor(
        string key,
        PartyFacts facts,
        bool distributionDone,
        IReadOnlyList<string> waitingOn)
    {
        var status = facts.Completed
            ? Statuses.Completed
            : !distributionDone || !facts.Assigned
                ? Statuses.NotStarted
                : waitingOn.Count > 0
                    ? Statuses.WaitingOnParty
                    : Statuses.InProgress;
        // المكتمل لا «ينتظر» أحداً وإن تأخر غيره.
        return new PartyState(
            key,
            Parties.LabelAr(key),
            status,
            facts.Completed ? [] : waitingOn);
    }

    private static string StageFromRank(int phaseRank, int atLeast, int doneAt) =>
        phaseRank >= doneAt
            ? Statuses.Completed
            : phaseRank >= atLeast
                ? Statuses.InProgress
                : Statuses.NotStarted;

 /// <summary>ترتيب المراحل التأسيسية من WorkflowTaskPhase: إنفاذ=0 · بورصة=1 · توزيع=2 · ما بعده=3.</summary>
    private static int PhaseRank(string parentPhase) =>
        parentPhase.Trim().ToLowerInvariant() switch
        {
            "enfath" => 0,
            "bourse" => 1,
            "distribution" => 2,
            _ => 3, // case_study / obstruction / done — التوزيع وقع
        };

    private static string WaitingSummary(IReadOnlyList<PartyState> parties, bool handoverDone)
    {
        if (handoverDone) return "المعاملة مرفوعة على إنفاذ — مكتملة";
        var waits = parties
            .Where(p => p.WaitingOn.Count > 0)
            .Select(p => $"{p.LabelAr} ينتظر {string.Join(" و",
                p.WaitingOn.Select(Parties.LabelAr))}")
            .ToList();
        return waits.Count == 0 ? "" : string.Join(" · ", waits);
    }
}
