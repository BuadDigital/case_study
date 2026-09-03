using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Abstractions;

namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>
/// QuestPDF adapter for <see cref="IEnfazInvoicePdfRenderer"/>. The layout itself stays in
/// <see cref="EnfazInvoicePdfGenerator"/>; this only puts it behind the Application port.
/// </summary>
public sealed class EnfazInvoicePdfRenderer : IEnfazInvoicePdfRenderer
{
    public byte[] Render(PoEnfazBillingDto billing) => EnfazInvoicePdfGenerator.Generate(billing);
}
