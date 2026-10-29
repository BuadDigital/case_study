using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

public class WorkOrderProperty : ITrackUpdatedAt
{
    public DateTime UpdatedAtUtc { get; set; }
    public Guid Id { get; set; }
    public Guid WorkOrderId { get; set; }
    /// <summary>The transaction (المعاملة) this deed belongs to — the reference above the deed.</summary>
    public Guid TransactionId { get; set; }
    public Transaction? Transaction { get; set; }
    public PropertyIdentifierType IdentifierType { get; set; }
 /// <summary>Deed kind — traditional / registered title.</summary>
    public DeedKind DeedKind { get; set; } = DeedKind.Traditional;
    public string DeedNumber { get; set; } = "";
 /// <summary>Request number (formerly task number).</summary>
    public string? RequestNumber { get; set; }
 /// <summary>false = no request number; field may be skipped.</summary>
    public bool HasRequestNumber { get; set; } = true;
 /// <summary>Assignment mandate number — required initial data.</summary>
    public string? AssignmentMandateNumber { get; set; }
 /// <summary>Assignment mandate date — required initial data (yyyy-MM-dd).</summary>
    public string? AssignmentMandateDate { get; set; }
    public string? DeedDate { get; set; }
 /// <summary>Real-estate registration number — registered-title path.</summary>
    public string? RealEstateRegNumber { get; set; }
 /// <summary>Real-estate registration date — registered-title path (yyyy-MM-dd).</summary>
    public string? RealEstateRegDate { get; set; }
    public string? OwnerName { get; set; }
 /// <summary>JSON array of {name} — the owners from the deed transcription (their count decides the ownership type).</summary>
    public string? DeedOwnersJson { get; set; }
 /// <summary>yes / no — property restrictions (bourse stage).</summary>
    public string? RestrictionsPresent { get; set; }
 /// <summary>mortgaged / seized / suspended / other — comma-separated when multiple.</summary>
    public string? RestrictionType { get; set; }
 /// <summary>Restriction reason when type includes other.</summary>
    public string? RestrictionOtherReason { get; set; }
 /// <summary>deed / bourse / doc / no</summary>
    public string? BoundariesAvailability { get; set; }
    public string? BoundariesExternalDocName { get; set; }
    public string? NorthBoundary { get; set; }
    public string? NorthBoundaryLengthM { get; set; }
 /// <summary>street | plot | passage | rail.</summary>
    public string? NorthBoundaryType { get; set; }
 /// <summary>Facade finishing material — north.</summary>
    public string? NorthFacadeFinishing { get; set; }
    public string? SouthBoundary { get; set; }
    public string? SouthBoundaryLengthM { get; set; }
    public string? SouthBoundaryType { get; set; }
    public string? SouthFacadeFinishing { get; set; }
    public string? EastBoundary { get; set; }
    public string? EastBoundaryLengthM { get; set; }
    public string? EastBoundaryType { get; set; }
    public string? EastFacadeFinishing { get; set; }
    public string? WestBoundary { get; set; }
    public string? WestBoundaryLengthM { get; set; }
    public string? WestBoundaryType { get; set; }
    public string? WestFacadeFinishing { get; set; }
    public string City { get; set; } = "";
 /// <summary>Region name (snapshot from region catalog).</summary>
    public string? Region { get; set; }
    public string District { get; set; } = "";
    public string? DeedStatus { get; set; }
    public string? Area { get; set; }
    public string? Court { get; set; }
    public string? Circuit { get; set; }
 /// <summary>Court catalog ref (optional; name copied into Court).</summary>
    public Guid? CourtId { get; set; }
 /// <summary>Circuit catalog ref (optional; number copied into Circuit).</summary>
    public Guid? CircuitId { get; set; }
 /// <summary>Region catalog ref.</summary>
    public Guid? RegionId { get; set; }
 /// <summary>City catalog ref.</summary>
    public Guid? CityId { get; set; }
    public string Classification { get; set; } = "";
    /// <summary>Initial type recorded during intake/bourse; retained for audit.</summary>
    public string PropertyType { get; set; } = "";
    /// <summary>
    /// Operational type confirmed by the field inspector on submission.
    /// Null until the first completed field inspection.
    /// </summary>
    public string? InspectedPropertyType { get; set; }
    public string? AssignmentDocFileName { get; set; }
    public string? DelegationLetterFileName { get; set; }
 /// <summary>JSON array of filenames.</summary>
    public string? OtherDocumentFileNames { get; set; }
    public string? RealEstateRegFileName { get; set; }
 /// <summary>Ownership deed image — initial-data attachment.</summary>
    public string? DeedOwnershipFileName { get; set; }
 /// <summary>Deed image from bourse — bourse-inquiry attachment.</summary>
    public string? BourseDeedImageFileName { get; set; }
    public bool BourseDataCompleted { get; set; }
    public DateTime? BourseCompletedAtUtc { get; set; }
 /// <summary>Who completed the bourse inquiry (display name) - the source note of the values it answered.</summary>
    public string? BourseCompletedByName { get; set; }
 /// <summary>Plan number — initial data.</summary>
    public string? PlanNumber { get; set; }
 /// <summary>Plan name — seed field property_plan_name.</summary>
    public string? PlanName { get; set; }
 /// <summary>Plot number — initial data.</summary>
    public string? PlotNumber { get; set; }
 /// <summary>Block number — seed field property_block_number.</summary>
    public string? BlockNumber { get; set; }
 /// <summary>Site map URL — initial data (ad-hoc when no plan/plot).</summary>
    public string? LocationMapUrl { get; set; }

    /// <summary>Retail report — No.</summary>
    public string? PartitionMinutesNumber { get; set; }
    /// <summary>Retail Minutes — History.</summary>
    public string? PartitionMinutesDate { get; set; }

    /// <summary>Finishing level: luxury | medium | ordinary | none.</summary>
    public string? FinishingType { get; set; }
 /// <summary>Structural system: concrete | metal | mixed | other.</summary>
    public string? FinishingStructure { get; set; }

    /// <summary>
    /// Specialist finishing level (valuation report) — distinct from intake
    /// <see cref="FinishingType"/>. luxury | medium | ordinary | none.
    /// </summary>
    public string? SpecialistFinishingLevel { get; set; }

    /// <summary>Search-scope notes written by the case specialist.</summary>
    public string? SearchScopeNotes { get; set; }

    /// <summary>JSON array of print attachment keys selected for the report package.</summary>
    public string? PrintAttachmentKeysJson { get; set; }

    /// <summary>Infath deposit code (draft until Enfaz handover).</summary>
    public string? InfathDepositCode { get; set; }

    /// <summary>Infath deposit certificate file name / label.</summary>
    public string? InfathDepositCertificateName { get; set; }

    /// <summary>ESG groups JSON (env / soc / gov) for the specialist valuation report.</summary>
    public string? SpecialistEsgJson { get; set; }

    /// <summary>
    /// Dual-write / legacy wire bag for specialist extras. Source of truth is the first-class
    /// columns above; the API still exposes this shape for the frontend hydrate path.
    /// </summary>
    public string? SpecialistReportExtrasJson { get; set; }

 /// <summary>Who wrote / last edited each key of the extras bag (a <c>PartyFieldProvenance</c> map, jsonb).</summary>
    public string SpecialistReportExtrasProvenanceJson { get; set; } = "{}";

 /// <summary>Are there buildings/structures to value? yes | no | ""</summary>
    public string HasStructuresToValue { get; set; } = "";

 /// <summary>
 /// «مكونات العقار» as the case specialist wrote it for the report, from the inspector's
 /// description text or photo. The inspector's own text stays untouched in the payload.
 /// </summary>
    public string? SpecialistComponentsText { get; set; }

 // Inspection Limitations — Construction Question Pattern: Columns on property.
 /// <summary>Inspection Scope: full | external | desktop | “(Not captured).</summary>
    public string InspectionScopeKey { get; set; } = "";
 /// <summary>Reason why Inspector is restricted/unabled — Mandatory when range is incomplete.</summary>
    public string? InspectionRestrictionReason { get; set; }
 /// <summary>JSON — unseen units (number + reason for each case).</summary>
    public string? UninspectedUnitsJson { get; set; }
 /// <summary>Certified appraiser approval for the “remote desktop” scope.</summary>
    public string? RemoteInspectionApprovedBy { get; set; }
    public DateTime? RemoteInspectionApprovedAtUtc { get; set; }

 /// <summary>(Second End): Upload the Transaction over Enfaz — Complete Delivery after Deposit Certificate.</summary>
    public DateTime? EnfazHandoverAtUtc { get; set; }
    public string? EnfazHandoverByUserId { get; set; }

 /// <summary>
 /// True once the transaction was recorded as handed over to Enfaz. A handed-over transaction is
 /// frozen against reopening the case-study report until the specialist takes it back.
 /// </summary>
    public bool IsHandedOverToEnfaz => EnfazHandoverAtUtc is not null;

 /// <summary>
 /// Clears the Enfaz handover stamp (the specialist re-opens work on a transaction that was
 /// already handed over). Idempotent; returns whether a stamp was actually cleared.
 /// </summary>
 /// <remarks>
 /// How it works: first drops the billing-ready mark, then clears the stamp and the user who set it.
 /// Edge cases: the mark is cleared BEFORE the «nothing to clear» early return, so a mark can never
 /// outlive the handover it follows — even on inconsistent data (a mark with no stamp) — and a deed
 /// handed over again always starts unmarked. The return value still means «a stamp was cleared», not
 /// «a mark was cleared». Callers that must protect a marked deed refuse BEFORE calling this
 /// (ReturnFromEnfazAsync and the study reopen), because clearing is exactly what they must not do.
 /// </remarks>
    public bool ClearEnfazHandover()
    {
        // A mark can never outlive the handover it follows.
        ClearBillingReady();
        if (EnfazHandoverAtUtc is null && EnfazHandoverByUserId is null) return false;

        EnfazHandoverAtUtc = null;
        EnfazHandoverByUserId = null;
        return true;
    }

 /// <summary>
 /// The accountant marked the deed «جاهز للفوترة»: its financial data appeared on the Enfaz platform
 /// and it can be invoiced. A marked deed is no longer taken back from Enfaz.
 /// </summary>
    public DateTime? BillingReadyAtUtc { get; set; }
    public string? BillingReadyByUserId { get; set; }

    /// <summary>True once the accountant has marked the deed ready for billing.</summary>
    public bool IsBillingReady => BillingReadyAtUtc is not null;

    /// <summary>The refusal when the deed is marked before it was handed over to Enfaz.</summary>
    public const string BillingReadyNeedsHandoverAr = "لا يُعلَّم الصك «جاهز للفوترة» قبل رفعه على إنفاذ";

    /// <summary>Marks the deed «جاهز للفوترة». Null on success, otherwise the Arabic reason it was refused.</summary>
    /// <remarks>
    /// How it works: refuses a removed deed and a deed that was never handed over to Enfaz (its financial
    /// data cannot exist yet); if it is already marked it succeeds without touching anything; otherwise it
    /// stamps the time and the accountant's user id.
    /// Edge cases: idempotent — a second mark (a double click, a retry after a timeout) keeps the FIRST
    /// stamp and the first user, so the audit trail is not rewritten; the caller uses IsBillingReady
    /// beforehand to know whether anything new happened and must be audited.
    /// </remarks>
    public string? MarkBillingReady(string? byUserId, DateTime nowUtc)
    {
        if (IsRemoved) return "الصك محذوف من المعاملة";
        if (!IsHandedOverToEnfaz) return BillingReadyNeedsHandoverAr;
        if (IsBillingReady) return null;

        BillingReadyAtUtc = nowUtc;
        BillingReadyByUserId = byUserId;
        return null;
    }

    /// <summary>Removes the billing-ready mark; returns whether one was actually there.</summary>
    /// <remarks>
    /// How it works: clears the time and the user together. Edge cases: safe to call on an unmarked deed
    /// (returns false); not exposed as a user action — the only caller is <see cref="ClearEnfazHandover"/>,
    /// because the product has no «unmark»: a mark means the figures are on Enfaz, and a deed returned for
    /// modification can never be marked again until it is handed over again.
    /// </remarks>
    public bool ClearBillingReady()
    {
        if (BillingReadyAtUtc is null && BillingReadyByUserId is null) return false;

        BillingReadyAtUtc = null;
        BillingReadyByUserId = null;
        return true;
    }

    /// <summary>The deed status a cancelled transaction's deeds carry.</summary>
    public const string CancelledDeedStatusAr = "ملغى";

    /// <summary>When the deed's transaction was cancelled («إلغاء المعاملة»); null while it is live.</summary>
    public DateTime? CancelledAtUtc { get; set; }

    /// <summary>The approved cancellation request that cancelled the deed.</summary>
    public Guid? CancellationId { get; set; }

    /// <summary>The deed status before the cancellation, put back on reactivation.</summary>
    public string? PreCancelDeedStatus { get; set; }

    /// <summary>True while the deed's transaction is cancelled.</summary>
    public bool IsCancelled => CancelledAtUtc is not null;

    /// <summary>Marks the deed cancelled by one approved cancellation. Returns whether it changed.</summary>
    /// <remarks>
    /// How it works: stamps the time and the cancellation, keeps the current deed status for the
    /// reactivation and writes «ملغى».
    /// Edge cases: an already cancelled deed keeps its first stamp and returns false, so a repeated
    /// approval never overwrites the remembered status with «ملغى».
    /// </remarks>
    public bool MarkCancelled(Guid cancellationId, DateTime nowUtc)
    {
        if (IsCancelled) return false;

        CancelledAtUtc = nowUtc;
        CancellationId = cancellationId;
        PreCancelDeedStatus = DeedStatus;
        DeedStatus = CancelledDeedStatusAr;
        return true;
    }

    /// <summary>Reactivation: clears the cancellation and puts back the deed status. Returns whether it changed.</summary>
    /// <remarks>
    /// How it works: clears the stamp and the cancellation id and restores the remembered status.
    /// Edge cases: a live deed returns false untouched.
    /// </remarks>
    public bool ClearCancellation()
    {
        if (!IsCancelled) return false;

        CancelledAtUtc = null;
        CancellationId = null;
        DeedStatus = PreCancelDeedStatus;
        PreCancelDeedStatus = null;
        return true;
    }

 /// <summary>Soft-removed from transaction queues; still listed on the work-order property list.</summary>
    public bool IsRemoved { get; set; }

 /// <summary>Removal reason — shown on the property list.</summary>
    public string? RemovalReason { get; set; }

    public DateTime? RemovedAtUtc { get; set; }

    public WorkOrder? WorkOrder { get; set; }
    public ICollection<PropertyContact> Contacts { get; set; } = [];
    public ICollection<BuildingInventoryLine> BuildingInventoryLines { get; set; } = [];
}
