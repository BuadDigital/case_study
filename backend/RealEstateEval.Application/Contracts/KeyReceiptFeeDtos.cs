using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

// Stays global (A8 Operations slice): bound by the financial host's charges dispatch
// endpoint, whose validation comes from the global-assembly FluentValidation scan.
public class MarkKeyReceiptFeeCollectedRequest
{
    [MaxLength(128)]
    public string? InvoiceReference { get; init; }
}
