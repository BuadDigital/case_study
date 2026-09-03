namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// Q-9 (Suleiman's wording): transaction / case-study state machine — a distribution-and-dependency
/// network, not a linear chain.
/// Foundational stages are sequential: work-order intake from Enfaz ← initial data (deeds)
/// ← real-estate bourse inquiry ← distribution to parties.
/// The work phase runs in parallel with dependencies — the inspector is the key node: the engineering
/// office waits for inspector confirmation (and the site) then submits the survey · the valuer waits
/// for inspector info and photos then prices · the case-study specialist waits for everyone then finishes.
/// Closing has two different steps: Qeema deposit certificate (professional — valuation report alone,
/// Q-6) then uploading the transaction to Enfaz (full handover).
/// Overall status is derived from party statuses; the UI shows who is waiting on whom.
/// (Recall/reopen cases and field-freeze scope: supplementary workshop — this structure governs.)
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

 /// <summary>Not started / in progress / waiting on a party / completed — labels match the decision text.</summary>
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
 /// <summary>WorkflowTaskPhaseValues wire string for the parent case study task.</summary>
        string ParentPhase,
        PartyFacts Inspector,
        PartyFacts Appraiser,
 /// <summary>null = The transaction does not require survey submission.</summary>
        PartyFacts? EngineeringOffice,
        PartyFacts CaseSpecialist,
 /// <summary>Q-6: final version issued with deposit certificate (valuation request closed).</summary>
        bool ValuationReportClosed,
        bool EnfazHandedOver);

    public sealed record PartyState(
        string Key,
        string LabelAr,
        string Status,
 /// <summary>Party keys this party is waiting on now — “who waits on whom”.</summary>
        IReadOnlyList<string> WaitingOn);

    public sealed record StageState(string Key, string LabelAr, string Status);

    public sealed record Result(
        IReadOnlyList<StageState> Stages,
        IReadOnlyList<PartyState> Parties,
 /// <summary>The transaction status is derived from the statuses of the parties.</summary>
        string OverallStatus,
 /// <summary>“Who is waiting for whom” summary for the status strip.</summary>
        string WaitingSummaryAr);

    public static Result Evaluate(Input input)
    {
        var phaseRank = PhaseRank(input.ParentPhase);
        var distributionDone = phaseRank >= 3; // After the distribution phase.

        var parties = new List<PartyState>();

        // Inspector — key node: waits on no one.
        var inspector = PartyStateFor(
            Parties.Inspector, input.Inspector, distributionDone, waitingOn: []);
        parties.Add(inspector);

        // Engineering office waits for inspector confirmation, then submits the survey.
        if (input.EngineeringOffice is not null)
        {
            parties.Add(PartyStateFor(
                Parties.EngineeringOffice,
                input.EngineeringOffice,
                distributionDone,
                waitingOn: input.Inspector.Completed ? [] : [Parties.Inspector]));
        }

        // Valuer waits for inspector info and photos, then prices.
        parties.Add(PartyStateFor(
            Parties.Appraiser,
            input.Appraiser,
            distributionDone,
            waitingOn: input.Inspector.Completed ? [] : [Parties.Inspector]));

        // Case-study specialist waits for everyone.
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

        // Closing — two different steps (Q-6, then full handover).
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

 /// <summary>Full Enfaz handover is not allowed before the deposit certificate and all parties complete.</summary>
    public static bool AllowsEnfazHandover(Input input) =>
        !input.EnfazHandedOver
        && input.ValuationReportClosed
        && Evaluate(input).Stages
            .First(s => s.Key == Stages.PartyWork).Status == Statuses.Completed;

 /// <summary>Enfaz upload package (Q-9/Q-14): required contents of the complete delivery.</summary>
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
        // Completed parties do not “wait” on anyone, even if others are late.
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

 /// <summary>WorkflowTaskPhase order: Enfaz=0 · exchange=1 · distribution=2 · onwards=3.</summary>
    private static int PhaseRank(string parentPhase) =>
        parentPhase.Trim().ToLowerInvariant() switch
        {
            "enfath" => 0,
            "bourse" => 1,
            "distribution" => 2,
            _ => 3, // case_study / obstruction / done — distribution has occurred.
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
