using RealEstateEval.Domain;

namespace RealEstateEval.Application.Contracts;

public sealed class ExistsResponseDto
{
    public bool Exists { get; set; }
}

public sealed class CourtVisitFeeAmountDto
{
    public Guid OperationsTaskId { get; set; }
    public decimal AmountSar { get; set; }
}

public sealed class GuidListRequest
{
    public IReadOnlyList<Guid> Ids { get; init; } = [];
}

public sealed class StringListRequest
{
    public IReadOnlyList<string> Values { get; init; } = [];
}

public sealed class InspectorFeeActorRequest
{
    public string ActorUserId { get; set; } = "";
    public string? ActorAssigneeId { get; set; }
    public bool IsOperationsManager { get; set; }
    public bool IsFinancialOfficer { get; set; }
    public string? ActorDepartment { get; set; }
    public bool CanManageAllDepartments { get; set; }
}

public sealed class InspectorFeePatchDispatchRequest
{
    public PatchInspectorFeeRequest Patch { get; set; } = new();
    public string? ActorDepartment { get; set; }
    public bool CanManageAllDepartments { get; set; }
}

public sealed class InspectorFeeTransitionDispatchRequest
{
    public InspectorFeeTransitionRequest Transition { get; set; } = new() { Action = "" };
    public string ActorUserId { get; set; } = "";
    public string? ActorAssigneeId { get; set; }
    public bool IsOperationsManager { get; set; }
    public bool IsFinancialOfficer { get; set; }
    public string? ActorDepartment { get; set; }
    public bool CanManageAllDepartments { get; set; }
}

public sealed class InspectorFeeBatchTransitionDispatchRequest
{
    public BatchInspectorFeeTransitionRequest Batch { get; set; } = new() { Action = "" };
    public string ActorUserId { get; set; } = "";
    public string? ActorAssigneeId { get; set; }
    public bool IsOperationsManager { get; set; }
    public bool IsFinancialOfficer { get; set; }
    public string? ActorDepartment { get; set; }
    public bool CanManageAllDepartments { get; set; }
}

public sealed class InspectorFeeDisbursementDispatchRequest
{
    public CreateDisbursementBatchRequest Request { get; set; } = new();
    public string ActorUserId { get; set; } = "";
    public string? ActorAssigneeId { get; set; }
}

public sealed class AccrueEngineeringSurveyFeeDispatchRequest
{
    public string ActorUserId { get; set; } = "";
}

public sealed class ActorUserRequest
{
    public string ActorUserId { get; set; } = "";
}

public sealed class CreateCourtVisitFeeChargeRequest
{
    public Guid OperationsTaskId { get; set; }
    public string TaskDisplayId { get; set; } = "";
    public string? PoNumber { get; set; }
    public string CreditAssigneeId { get; set; } = "";
    public string CreditAssigneeName { get; set; } = "";
    public decimal AmountSar { get; set; }
    public Guid? PricingTableId { get; set; }
}

public sealed class KeyReceiptFeeChargeDto
{
    public Guid Id { get; set; }
    public Guid EnvelopeId { get; set; }
    public string RequestNumber { get; set; } = "";
    public decimal AmountSar { get; set; }
    public string CollectionStatus { get; set; } = "";
    public Guid? PhotoAttachmentId { get; set; }
    public Guid? ReceiptAttachmentId { get; set; }
    public string? InvoiceReference { get; set; }
    public DateTime? CollectedAtUtc { get; set; }
    public string CreatedByName { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class PoEnfazKeyRevenueLineDto
{
    public Guid EnvelopeId { get; set; }
    public string PoNumber { get; set; } = "";
    public decimal KeyFeeSar { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public sealed class PoEnfazInvoiceRefDto
{
    public string PoNumber { get; set; } = "";
    public string Status { get; set; } = "";
    public string InvoiceNumber { get; set; } = "";
    public DateTime? CollectedAtUtc { get; set; }
}

public sealed class ResolvedPartyFeeDto
{
    public decimal? FeeSar { get; set; }
    public Guid? PricingTableId { get; set; }

    public static ResolvedPartyFeeDto From(ResolvedPartyFee fee) => new()
    {
        FeeSar = fee.FeeSar,
        PricingTableId = fee.PricingTableId,
    };

    public ResolvedPartyFee ToFee() => new(FeeSar, PricingTableId);
}

public sealed class CollectPoEnfazInvoiceDispatchRequest
{
    public CollectPoEnfazInvoiceRequest Collect { get; set; } = new();
    public string ActorUserId { get; set; } = "";
}

public sealed class AddEnfazFollowupDispatchRequest
{
    public AddEnfazFollowupRequest Followup { get; set; } = new();
    public string ActorUserId { get; set; } = "";
}

public sealed class SetEnfazFinanceFlagDispatchRequest
{
    public SetEnfazFinanceFlagRequest Flag { get; set; } = new();
    public string ActorUserId { get; set; } = "";
}

public sealed class PartyBillingCreateDispatchRequest
{
    public CreatePartyBillingStatementRequest Request { get; set; } = new();
    public string ActorUserId { get; set; } = "";
}

public sealed class PartyBillingVendorInvoiceDispatchRequest
{
    public SubmitVendorInvoiceRequest Request { get; set; } = null!;
    public string ActorUserId { get; set; } = "";
}

public sealed class PartyBillingRejectInvoiceDispatchRequest
{
    public RejectVendorInvoiceRequest Request { get; set; } = null!;
    public string ActorUserId { get; set; } = "";
}

public sealed class PartyBillingCloseDispatchRequest
{
    public ClosePartyBillingStatementRequest Request { get; set; } = null!;
    public string ActorUserId { get; set; } = "";
}

public sealed class PartyBillingCancelDispatchRequest
{
    public CancelPartyBillingStatementRequest Request { get; set; } = null!;
    public string ActorUserId { get; set; } = "";
}

public sealed class PartyBillingDeferDispatchRequest
{
    public DeferPartyBillingLinesRequest Request { get; set; } = new();
    public string ActorUserId { get; set; } = "";
}
