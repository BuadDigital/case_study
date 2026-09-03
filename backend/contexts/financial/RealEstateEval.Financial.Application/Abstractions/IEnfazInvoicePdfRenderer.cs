using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Financial.Application.Abstractions;

/// <summary>
/// Renders the Arabic RTL Enfaz tax invoice. The PDF engine is an Infrastructure concern, so
/// the billing use case asks for bytes through this port.
/// </summary>
public interface IEnfazInvoicePdfRenderer
{
    byte[] Render(PoEnfazBillingDto billing);
}
