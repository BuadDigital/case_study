using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Abstractions;

namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>
/// QuestPDF adapter for <see cref="IEnfazInvoicePdfRenderer"/>. Layout matches the official
/// Ejadah letters (letterhead, navy table, stamp) inside <see cref="EnfazInvoicePdfGenerator"/>.
/// </summary>
public sealed class EnfazInvoicePdfRenderer : IEnfazInvoicePdfRenderer
{
    public byte[] Render(PoEnfazBillingDto billing) => EnfazInvoicePdfGenerator.Generate(billing);
}
