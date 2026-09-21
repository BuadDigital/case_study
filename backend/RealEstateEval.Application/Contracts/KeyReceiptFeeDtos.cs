using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

// Stays global: bound by both the financial charges-dispatch host and the operations
// key-envelope host. Validator lives in Operations.Application.
public class MarkKeyReceiptFeeCollectedRequest
{
    [MaxLength(128)]
    public string? InvoiceReference { get; init; }
}
