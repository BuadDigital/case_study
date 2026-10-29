namespace RealEstateEval.Application.Rules;

/// <summary>
/// Authoritative PO / property / party-submission role matrix —
/// mirrors frontend <c>po-roles.ts</c> and <c>operations-task-roles.ts</c>.
/// </summary>
public static class PoRoleMatrixRules
{
    public static bool IsSuperAdmin(string? prototypeRole) =>
        string.Equals(prototypeRole?.Trim(), "cdo", StringComparison.OrdinalIgnoreCase);

    /// <summary>Receive a work order from Enfaz — the case specialist and the section supervisor only (not the CDO).</summary>
    public static bool CanReceivePo(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return role is "section-supervisor" or "case-specialist";
    }

    public static bool CanEditPoHeader(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role) || role is "section-supervisor";
    }

    /// <summary>
    /// The assignment specialist's name is provisional when the work order is received and is
    /// confirmed later — the case specialist corrects it, beside the header editors.
    /// </summary>
    public static bool CanEditAssignmentSpecialist(string? prototypeRole) =>
        CanEditPoHeader(prototypeRole) || Normalize(prototypeRole) is "case-specialist";

    /// <summary>
    /// Write a property's own data — the initial data (Enfaz stage) and the bourse inquiry, and the
    /// task-phase advances after them. Any case specialist, by role (not by assignment); the supervisor,
    /// the general manager and the CDO do not write these stages.
    /// </summary>
    public static bool CanEditProperty(string? prototypeRole) =>
        IsSuperAdmin(prototypeRole) || Normalize(prototypeRole) is "case-specialist";

    /// <summary>
    /// Send a case-study task one phase back (distribution → bourse → Enfaz) — the case specialist and the CDO,
    /// who own those stages' data, and the section supervisor.
    /// </summary>
    public static bool CanRevertTaskPhase(string? prototypeRole) =>
        IsSuperAdmin(prototypeRole) || Normalize(prototypeRole) is "case-specialist" or "section-supervisor";

    /// <summary>
    /// The generic task patch: the case specialist and the section supervisor may change a task's phase
    /// or status; the general manager and the CDO only suspend (status «blocked», no phase change) or
    /// resolve an obstruction (status «open», back to the phase it came from — never «done»).
    /// A patch that touches neither stays open to every work-order manager.
    /// </summary>
    public static bool CanPatchTaskLifecycle(string? prototypeRole, string? phase, string? status)
    {
        if (string.IsNullOrWhiteSpace(phase) && string.IsNullOrWhiteSpace(status)) return true;

        var role = Normalize(prototypeRole);
        if (role is "case-specialist" or "section-supervisor") return true;

        if (!(IsSuperAdmin(role) || role is "general-manager")) return false;

        var normalizedStatus = status?.Trim().ToLowerInvariant();
        // Suspend: status blocked, no phase change.
        if (string.IsNullOrWhiteSpace(phase) && normalizedStatus == "blocked") return true;

        // Resolve an obstruction: reopen (status open) and return to a working phase — completing is not theirs.
        return normalizedStatus == "open"
            && !string.Equals(phase?.Trim(), "done", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// The case specialist's own decisions on a study (any case specialist, by role — not by
    /// assignment; the supervisor, the general manager and the CDO do not take them):
    /// issuing the case-study report and reopening it, deciding an appraisal recall, handing the
    /// transaction over to Enfaz and taking it back from Enfaz, and lifting the survey freeze a
    /// failure puts on a property. An absent specialist is covered by re-assigning the transaction.
    /// </summary>
    public static bool IsCaseSpecialistDecision(string? prototypeRole) =>
        Normalize(prototypeRole) is "case-specialist";

    public static bool CanIssueCaseStudyReport(string? prototypeRole) => IsCaseSpecialistDecision(prototypeRole);

    public static bool CanReopenCaseStudyReport(string? prototypeRole) => IsCaseSpecialistDecision(prototypeRole);

    public static bool CanDecideAppraisalRecall(string? prototypeRole) => IsCaseSpecialistDecision(prototypeRole);

    public static bool CanHandOverToEnfaz(string? prototypeRole) => IsCaseSpecialistDecision(prototypeRole);

    public static bool CanReturnFromEnfaz(string? prototypeRole) => IsCaseSpecialistDecision(prototypeRole);

    public static bool CanLiftSurveyFreeze(string? prototypeRole) => IsCaseSpecialistDecision(prototypeRole);

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
    /// The valuation-report draft is prepared, sent, withdrawn — and a deposited report is reopened as a
    /// new version — by the case specialist alone (the appraiser's assistant).
    /// </summary>
    public static bool CanPrepareReportDraft(string? prototypeRole) => IsCaseSpecialistDecision(prototypeRole);

    public static bool CanReopenValuationReport(string? prototypeRole) => IsCaseSpecialistDecision(prototypeRole);

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
    /// «إلغاء المعاملة»: the case specialist asks for it; the section supervisor and the CDO may too
    /// (their request is decided at once). Mirrors <c>canRequestTransactionCancel</c> in po-roles.ts.
    /// </summary>
    public static bool CanRequestTransactionCancel(string? prototypeRole) =>
        CanDecideTransactionCancel(prototypeRole) || Normalize(prototypeRole) is "case-specialist";

    /// <summary>
    /// Approve or reject a cancellation request, and reactivate a cancelled transaction — the section
    /// supervisor and the CDO. Mirrors <c>canDecideTransactionCancel</c> in po-roles.ts.
    /// </summary>
    public static bool CanDecideTransactionCancel(string? prototypeRole) => CanEditPoHeader(prototypeRole);

 /// <summary>Specialist accept / reopen of party submissions.</summary>
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
        return IsSuperAdmin(role) || role is "case-specialist" or "section-supervisor";
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

    /// <summary>Approve / reject a «مستند ذو قيمة» — the case specialist (and the CDO).</summary>
    public static bool CanReviewValuedDocuments(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role) || role is "case-specialist";
    }

 /// <summary>Operations-task managers (matches frontend <c>canManageOperationsTasks</c>).</summary>
    public static bool CanManageOperationsTasks(string? prototypeRole)
    {
        var role = Normalize(prototypeRole);
        return IsSuperAdmin(role)
            || role is "case-specialist" or "section-supervisor" or "general-manager"
                or "real-estate-appraiser";
    }

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
 /// (e.g. map pin) without being the inspector assignee.
 /// </summary>
    public static bool CanCorrectFieldInspectionSubmission(string? prototypeRole) =>
        CanManagePartySubmissions(prototypeRole);

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
