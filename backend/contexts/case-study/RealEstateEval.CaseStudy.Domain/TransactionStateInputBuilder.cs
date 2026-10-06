using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// The one place a property's workflow tasks become <see cref="TransactionStateRules.Input"/>: the transaction
/// state screen and the list's progress bar both read through it, so they can never disagree on who is assigned,
/// who is done, or whether the transaction needs a survey. What only the detailed read knows (the appraiser's
/// package, the valuation request, the issued study report) is passed in; the list path leaves it at its defaults.
/// </summary>
public static class TransactionStateInputBuilder
{
    /// <summary>The latest task of the kind that is not cancelled, or null.</summary>
    public static WorkflowTask? LatestTask(IReadOnlyList<WorkflowTask> tasks, WorkflowTaskKind kind) =>
        tasks
            .Where(t => t.Kind == kind && t.Status != WorkflowTaskStatus.Cancelled)
            .OrderByDescending(t => t.CreatedAtUtc)
            .FirstOrDefault();

    /// <param name="tasks">Every workflow task of the property.</param>
    /// <param name="enfazHandedOver">The property carries an Enfaz hand-over stamp.</param>
    /// <param name="studyReportIssued">The specialist issued the case-study report (detailed read only).</param>
    /// <param name="appraiserSubmitted">The appraiser handed his package over, task not completed yet.</param>
    /// <param name="valuationClosed">
    /// The valuation report is closed (final issuance). Null = the list's approximation: the appraiser's task is completed.
    /// </param>
    public static TransactionStateRules.Input Build(
        IReadOnlyList<WorkflowTask> tasks,
        bool enfazHandedOver,
        bool studyReportIssued = false,
        bool appraiserSubmitted = false,
        bool? valuationClosed = null)
    {
        var parent = tasks
            .Where(t => t.Kind == WorkflowTaskKind.CaseStudyProperty)
            .OrderByDescending(t => t.CreatedAtUtc)
            .FirstOrDefault();

        TransactionStateRules.PartyFacts FactsFor(WorkflowTaskKind kind)
        {
            var task = LatestTask(tasks, kind);
            return new TransactionStateRules.PartyFacts(
                Assigned: task is not null,
                Completed: task?.Status == WorkflowTaskStatus.Completed);
        }

        var appraiser = FactsFor(WorkflowTaskKind.PropertyAppraisal);
        if (!appraiser.Completed && appraiserSubmitted)
            appraiser = appraiser with { Submitted = true };

        var hasSurvey = LatestTask(tasks, WorkflowTaskKind.EngineeringSurvey) is not null;

        return new TransactionStateRules.Input(
            ParentPhase: (parent?.Phase ?? WorkflowTaskPhase.Enfath).ToDbValue(),
            Inspector: FactsFor(WorkflowTaskKind.FieldInspection),
            Appraiser: appraiser,
            EngineeringOffice: hasSurvey ? FactsFor(WorkflowTaskKind.EngineeringSurvey) : null,
            CaseSpecialist: new TransactionStateRules.PartyFacts(
                Assigned: parent is not null,
                Completed: parent?.Status == WorkflowTaskStatus.Completed),
            ValuationReportClosed: valuationClosed ?? appraiser.Completed,
            EnfazHandedOver: enfazHandedOver,
            StudyReportIssued: studyReportIssued);
    }
}
