namespace RealEstateEval.Application.Rules;

/// <summary>
/// Authoritative PO / property / party-submission role matrix —
/// mirrors frontend <c>po-roles.ts</c> and <c>operations-task-roles.ts</c>.
/// </summary>
public static class PoRoleMatrixRules
{
    public static bool IsSuperAdmin(string? prototypeRole) =>
        string.Equals(prototypeRole?.Trim(), "cdo", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Receive a work order from Enfaz — the section supervisor and the coordination sub-role of the
    /// case specialist (not the CDO).
    /// </summary>
    public static bool CanReceivePo(StaffActor actor) =>
        actor.NormalizedRole is "section-supervisor" || actor.HoldsCoordination;

    public static bool CanEditPoHeader(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role) || role is "section-supervisor";
    }

    /// <summary>
    /// The assignment specialist's name is provisional when the work order is received and is
    /// confirmed later — the case specialist corrects it, beside the header editors.
    /// </summary>
    public static bool CanEditAssignmentSpecialist(StaffActor actor) =>
        CanEditPoHeader(actor.Role) || actor.HoldsCoordination;

    /// <summary>
    /// Register a property's initial data (Enfaz stage) and the bourse inquiry, link a property to
    /// a task slot, and advance the task past those stages — the coordination sub-role (ruling
    /// 2026-11-02) and the CDO; the supervisor and the general manager do not write these stages.
    /// </summary>
    public static bool CanAdvanceIntake(StaffActor actor) =>
        IsSuperAdmin(actor.Role) || actor.HoldsCoordination;

    /// <summary>
    /// Edit a property's data and documents after intake — every case-specialist sub-role, the
    /// appraiser and the CDO (ruling 2026-11-02: all edit, with a change log). The inspector and the
    /// engineering office never do.
    /// </summary>
    public static bool CanEditPropertyData(StaffActor actor) =>
        IsSuperAdmin(actor.Role) || actor.IsCaseSpecialist || actor.NormalizedRole is "real-estate-appraiser";

    /// <summary>
    /// Send a case-study task one phase back (distribution → bourse → Enfaz) — the coordination
    /// sub-role and the CDO, who own those stages' data, and the section supervisor.
    /// </summary>
    public static bool CanRevertTaskPhase(StaffActor actor) =>
        IsSuperAdmin(actor.Role) || actor.NormalizedRole is "section-supervisor" || actor.HoldsCoordination;

    /// <summary>
    /// Confirm a transaction's distribution to the inspector, the appraiser and the engineering
    /// office — the coordination sub-role, the section supervisor, the general manager and the CDO.
    /// </summary>
    public static bool CanDistribute(StaffActor actor) =>
        IsSuperAdmin(actor.Role)
        || actor.NormalizedRole is "section-supervisor" or "general-manager"
        || actor.HoldsCoordination;

    /// <summary>
    /// The generic task patch: the case specialist and the section supervisor may change a task's phase
    /// or status; the general manager and the CDO only suspend (status «blocked», no phase change) or
    /// resolve an obstruction (status «open», back to the phase it came from — never «done»).
    /// A patch that touches neither stays open to every work-order manager.
    /// </summary>
    public static bool CanPatchTaskLifecycle(StaffActor actor, string? phase, string? status)
    {
        if (string.IsNullOrWhiteSpace(phase) && string.IsNullOrWhiteSpace(status)) return true;

        var role = actor.NormalizedRole;
        // The lifecycle (suspend, resolve an obstruction) is coordination's (ruling 2026-11-02).
        if (role is "section-supervisor" || actor.HoldsCoordination) return true;

        if (!(IsSuperAdmin(role) || role is "general-manager")) return false;

        var normalizedStatus = status?.Trim().ToLowerInvariant();
        // Suspend: status blocked, no phase change.
        if (string.IsNullOrWhiteSpace(phase) && normalizedStatus == "blocked") return true;

        // Resolve an obstruction: reopen (status open) and return to a working phase — completing is not theirs.
        return normalizedStatus == "open"
            && !string.Equals(phase?.Trim(), "done", StringComparison.OrdinalIgnoreCase);
    }

    // The case specialist's own decisions, each owned by one sub-role (Omar's ruling 2026-11-02).
    // Any holder of the sub-role takes them — the queues are shared, never by assignment — and
    // the supervisor, the general manager and the CDO do not take them.

    /// <summary>
    /// Finish the property study («إنهاء الدراسة», today «إصدار تقرير دراسة الحالة»): it locks the
    /// parties' contributions and opens the appraiser's hand-over — the study sub-role.
    /// </summary>
    public static bool CanFinishStudy(StaffActor actor) => actor.HoldsStudy;

    /// <summary>
    /// Reopen a study sent to review — the study takes it back before review acts, review returns it to
    /// the study with a reason (Omar 2026-11-08). Who may act in which review state is the reopen's rule.
    /// </summary>
    public static bool CanReopenCaseStudyReport(StaffActor actor) => actor.HoldsStudy || actor.HoldsReview;

    /// <summary>Decide the appraiser's recall request (send the valuation back) — the study sub-role.</summary>
    public static bool CanDecideAppraisalRecall(StaffActor actor) => actor.HoldsStudy;

    /// <summary>Record the Enfaz upload («تم الرفع على إنفاذ») — the review sub-role.</summary>
    public static bool CanHandOverToEnfaz(StaffActor actor) => actor.HoldsReview;

    /// <summary>Take a transaction back after Enfaz returned it — the review sub-role.</summary>
    public static bool CanReturnFromEnfaz(StaffActor actor) => actor.HoldsReview;

    /// <summary>Lift the survey freeze a failure put on a property — coordination, which follows failures.</summary>
    public static bool CanLiftSurveyFreeze(StaffActor actor) => actor.HoldsCoordination;

    /// <summary>
    /// «إرسال المعاملة للدراسة» — coordination confirms every party delivered and moves the transaction to
    /// the study queue (ruling 2026-11-02); the section supervisor and the CDO may too.
    /// </summary>
    public static bool CanFormallyReceive(StaffActor actor) =>
        IsSuperAdmin(actor.Role) || actor.NormalizedRole is "section-supervisor" || actor.HoldsCoordination;

    /// <summary>
    /// Follow a failure up (upgrade, escalate, suspend, resolve, approve, return) — coordination
    /// always, whatever stage the transaction is in (ruling 2026-11-02). Only the case specialist is
    /// narrowed: other roles keep what their capability gives them. Raising a failure stays open to
    /// whoever finds it.
    /// </summary>
    public static bool CanFollowUpFailure(StaffActor actor) => !actor.IsCaseSpecialist || actor.HoldsCoordination;

    /// <summary>
    /// Merge deeds into one transaction or take one out — the stage owner: coordination while the
    /// transaction is with coordination, study after it (the stage gate is checked by the caller).
    /// </summary>
    public static bool CanMergeTransactions(StaffActor actor) => actor.HoldsCoordination || actor.HoldsStudy;

    /// <summary>
    /// The stage gate of a merge: coordination before the formal receipt, study after it (the stage
    /// owner, ruling 2026-11-02).
    /// </summary>
    public static bool CanMergeAtStage(StaffActor actor, bool transactionReceived) =>
        transactionReceived ? actor.HoldsStudy : actor.HoldsCoordination;

    /// <summary>
    /// Marking a deed «جاهز للفوترة» once its financial data appeared on Enfaz is the accountant's call
    /// (the financial officer) — the specialist who handed it over does not decide when it can be billed.
    /// </summary>
    /// <remarks>
    /// How it works: normalises the role (trim + lower-case) and accepts only «financial-officer».
    /// Edge cases: null / blank / unknown roles are refused; the case specialist, the section supervisor,
    /// the general manager and the CDO are refused on purpose — the mark is the accountant's statement
    /// that the figures appeared on Enfaz, which only they can see. Mirrored on the client by
    /// canMarkBillingReady (role-access.ts); the controller checks this after the ManageFinancial capability,
    /// because a capability only «reaches the door» and several roles share it.
    /// </remarks>
    public static bool CanMarkBillingReady(string? prototypeRole) =>
        Normalize(prototypeRole) is "financial-officer";

    /// <summary>
    /// The valuation-report draft is prepared, sent and withdrawn by the study sub-role (the
    /// appraiser's assistant).
    /// </summary>
    public static bool CanPrepareReportDraft(StaffActor actor) => actor.HoldsStudy;

    /// <summary>A deposited report is reopened as a new version (n+1) by the review sub-role.</summary>
    public static bool CanReopenValuationReport(StaffActor actor) => actor.HoldsReview;

    /// <summary>The review sub-role deposits the approved report in «قيمة», so it records the code and certificate.</summary>
    public static bool CanRecordValuationDeposit(StaffActor actor) => actor.HoldsReview;

    /// <summary>
    /// Only the appraiser ASSIGNED to the property reviews, approves and deposits the report: no
    /// supervisor / CDO override (an absent appraiser is covered by re-assigning the transaction).
    /// </summary>
    public static bool IsAssignedPartyUser(
        string? taskAssigneeId,
        string? actorUserId,
        string? actorDistributionAssigneeId)
    {
        var assignee = taskAssigneeId?.Trim() ?? "";
        if (assignee.Length == 0) return false;

        var dist = actorDistributionAssigneeId?.Trim() ?? "";
        if (dist.Length > 0 && string.Equals(dist, assignee, StringComparison.Ordinal))
            return true;

        var userId = actorUserId?.Trim() ?? "";
        return userId.Length > 0 && string.Equals(userId, assignee, StringComparison.Ordinal);
    }

    public static bool CanDeletePo(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role) || role is "section-supervisor";
    }

    public static bool CanDeleteProperty(string? prototypeRole) => CanDeletePo(prototypeRole);

    /// <summary>
    /// «إلغاء المعاملة»: the coordination sub-role asks for it; the section supervisor and the CDO may
    /// too (their request is decided at once). Mirrors <c>canRequestTransactionCancel</c> in po-roles.ts.
    /// </summary>
    public static bool CanRequestTransactionCancel(StaffActor actor) =>
        CanDecideTransactionCancel(actor.Role) || actor.HoldsCoordination;

    /// <summary>
    /// Approve or reject a cancellation request, and reactivate a cancelled transaction — the section
    /// supervisor and the CDO. Mirrors <c>canDecideTransactionCancel</c> in po-roles.ts.
    /// </summary>
    public static bool CanDecideTransactionCancel(string? prototypeRole) => CanEditPoHeader(prototypeRole);

 /// <summary>
 /// Case staff: read every party submission and task. Writes (accept / return / reopen) use
 /// <see cref="CanAcceptPartyWork"/>, which narrows the specialist to the study sub-role.
 /// </summary>
    public static bool CanManagePartySubmissions(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role)
            || role is "case-specialist" or "section-supervisor" or "general-manager";
    }

 /// <summary>
 /// Upload / classify governed documents from the property documents tab
 /// (matches frontend <c>canUploadPropertyDocuments</c>).
 /// </summary>
    public static bool CanUploadPropertyDocuments(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        // The appraiser edits property data and documents too (ruling 2026-11-02).
        return IsSuperAdmin(role) || role is "case-specialist" or "section-supervisor" or "real-estate-appraiser";
    }

    /// <summary>
    /// Upload a «مستند ذو قيمة» (matches frontend <c>canUploadValuedDocuments</c>): the case
    /// specialist, the appraiser, management, the field inspector and the engineering office.
    /// </summary>
    public static bool CanUploadValuedDocuments(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role)
            || role is "case-specialist" or "real-estate-appraiser" or "section-supervisor"
                or "general-manager" or "field-inspector" or "engineering-office";
    }

    /// <summary>
    /// See a «مستند ذو قيمة» and its value — between the case specialist and the appraiser
    /// (and the CDO); finance and the other uploaders do not.
    /// </summary>
    public static bool CanSeeValuedDocuments(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role) || role is "case-specialist" or "real-estate-appraiser";
    }

    /// <summary>Decide what a «مستند ذو قيمة» does to the valuation — the appraiser (and the CDO).</summary>
    public static bool CanDecideValueDocumentEffect(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role) || role is "real-estate-appraiser";
    }

    /// <summary>
    /// The technical acceptance of party work (ruling 2026-11-02): accept, return to the inspector,
    /// reopen a package, write «مكونات العقار» and the components table, correct a submitted
    /// inspection — every case-specialist sub-role (Omar 2026-11-08: coordination, study and review see
    /// all of the transaction's data and edit it at the same level; the coordinator receives each party's
    /// work on his page, the study returns what it finds wrong), and the section supervisor, the general
    /// manager and the CDO as before.
    /// </summary>
    public static bool CanAcceptPartyWork(StaffActor actor) =>
        IsSuperAdmin(actor.Role)
        || actor.NormalizedRole is "section-supervisor" or "general-manager"
        || actor.IsCaseSpecialist;

    /// <summary>
    /// Review's own decisions on a transaction handed to it (Omar 2026-11-05): approve the reports and
    /// send the valuation draft to the appraiser, or return it to the study — the review sub-role only,
    /// like the other draft steps (preparing is the study's, the deposit review's).
    /// </summary>
    public static bool CanReviewTransaction(StaffActor actor) => actor.HoldsReview;

    /// <summary>
    /// Who still edits a transaction's data once it is handed to review — review itself, the section
    /// supervisor and the CDO (the study and coordination wait for a return).
    /// </summary>
    public static bool CanEditWhileInReview(StaffActor actor) =>
        IsSuperAdmin(actor.Role) || actor.NormalizedRole is "section-supervisor" || actor.HoldsReview;

    /// <summary>
    /// «إعادة فتح المعاملة» after review approved it (Omar 2026-11-05): any case specialist, whatever his
    /// sub-role, the section supervisor and the CDO — with a reason.
    /// </summary>
    public static bool CanReopenTransaction(StaffActor actor) =>
        IsSuperAdmin(actor.Role) || actor.NormalizedRole is "section-supervisor" || actor.IsCaseSpecialist;

    /// <summary>Approve / reject a «مستند ذو قيمة» — the study sub-role (and the CDO).</summary>
    public static bool CanReviewValuedDocuments(StaffActor actor) =>
        IsSuperAdmin(actor.Role) || actor.HoldsStudy;

 /// <summary>
 /// Operations-task managers (matches frontend <c>canManageOperationsTasks</c>): the coordination
 /// sub-role (operational work is coordination's, ruling 2026-11-02), management and the appraiser.
 /// </summary>
    public static bool CanManageOperationsTasks(StaffActor actor) =>
        IsSuperAdmin(actor.Role)
        || actor.NormalizedRole is "section-supervisor" or "general-manager" or "real-estate-appraiser"
        || actor.HoldsCoordination;

 /// <summary>
 /// Party draft/submit: assigned party, or CDO / section supervisor override.
 /// </summary>
    public static bool CanWritePartyTask(
        string? prototypeRole,
        string? taskAssigneeId,
        string? actorUserId,
        string? actorDistributionAssigneeId)
    {
        if (IsSuperAdmin(prototypeRole)
            || string.Equals(Normalize(prototypeRole), "section-supervisor", StringComparison.Ordinal))
        {
            return true;
        }

        return IsAssignedPartyUser(taskAssigneeId, actorUserId, actorDistributionAssigneeId);
    }

 /// <summary>
 /// Case-study staff may correct a submitted field-inspection package
 /// (e.g. map pin) without being the inspector assignee — part of the technical acceptance.
 /// </summary>
    public static bool CanCorrectFieldInspectionSubmission(StaffActor actor) =>
        CanAcceptPartyWork(actor);

 /// <summary>
 /// Party read access: case staff read every task, parties read only their own.
 /// Strictly wider than <see cref="CanWritePartyTask"/>.
 /// </summary>
    public static bool CanReadPartyTask(
        string? prototypeRole,
        string? taskAssigneeId,
        string? actorUserId,
        string? actorDistributionAssigneeId)
    {
        return CanManagePartySubmissions(prototypeRole)
            || CanWritePartyTask(
                prototypeRole,
                taskAssigneeId,
                actorUserId,
                actorDistributionAssigneeId);
    }

    static string Normalize(string? prototypeRole) =>
        prototypeRole?.Trim().ToLowerInvariant() ?? "";
}
