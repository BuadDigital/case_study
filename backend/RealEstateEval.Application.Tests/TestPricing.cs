using RealEstateEval.Financial.Application.Services;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Infrastructure.Persistence;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Composes the party-fee pricing use case over an in-memory Financial context. The service
/// itself lives in <c>Financial.Application</c> and takes an <c>IPartyFeePricingRepository</c>,
/// so tests wire the EF adapter here instead of handing it a DbContext.
/// </summary>
internal static class TestPricing
{
    public static PartyFeePricingService Create(FinancialDbContext financial, TimeProvider? time = null) =>
        new(new PartyFeePricingRepository(financial), new AuditLogWriter(time), time);
}
