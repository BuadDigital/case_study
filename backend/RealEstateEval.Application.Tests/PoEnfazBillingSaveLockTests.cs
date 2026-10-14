using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Application.Services;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Persistence;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Once the Enfaz invoice is issued it stamps its totals; the fee lines behind it are frozen on
/// the server, not only greyed out on screen, so they cannot drift from the invoice.
/// </summary>
public sealed class PoEnfazBillingSaveLockTests
{
    private const string PoNumber = "PO-LOCK-1";
    private static readonly Guid PropertyId = Guid.Parse("d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4");

    [Fact]
    public async Task Saving_fee_lines_after_the_invoice_is_issued_is_refused_and_changes_nothing()
    {
        var bundle = TestBoundedContexts.Create($"enfaz-lock-{Guid.NewGuid():N}");
        var fin = TestInspectorFeeServiceFactory.ShareFinancial(bundle.CaseStudy);
        var now = DateTime.UtcNow;
        fin.PoEnfazRevenueLines.Add(new PoEnfazRevenueLine
        {
            Id = Guid.NewGuid(),
            PoNumber = PoNumber,
            PropertyId = PropertyId,
            CaseStudyFeeSar = 1000m,
            UpdatedAtUtc = now,
        });
        fin.PoEnfazInvoices.Add(new PoEnfazInvoice
        {
            PoNumber = PoNumber,
            InvoiceNumber = $"INV-{PoNumber}-1",
            IssuedAtUtc = now,
            Status = PoEnfazInvoiceStatus.Issued,
            SubtotalSar = 1000m,
            VatSar = 150m,
            TotalSar = 1150m,
        });
        await fin.SaveChangesAsync();

        var service = new PoEnfazBillingService(
            new PoEnfazBillingRepository(fin),
            new CaseStudyLookup(bundle.CaseStudy),
            new NoKeyEntitlements(),
            new NoPdf(),
            new AuditLogWriter());

        var (billing, error) = await service.SavePoBillingAsync(
            PoNumber,
            new SavePoEnfazBillingRequest
            {
                Lines =
                [
                    new PoEnfazRevenueLineInput
                    {
                        PropertyId = PropertyId.ToString(),
                        CaseStudyFeeSar = 5000m,
                    },
                ],
            });

        Assert.Null(billing);
        Assert.Equal("لا يمكن تعديل بنود الفوترة بعد إصدار الفاتورة.", error);

        var line = await TestInspectorFeeServiceFactory.ShareFinancial(bundle.CaseStudy)
            .PoEnfazRevenueLines.AsNoTracking()
            .SingleAsync(l => l.PoNumber == PoNumber);
        Assert.Equal(1000m, line.CaseStudyFeeSar);
    }

    private sealed class NoKeyEntitlements : IPropertyKeyEntitlementLookup
    {
        public Task<IReadOnlyList<PropertyKeyEntitlement>> ListByPropertyIdsAsync(
            IReadOnlyList<Guid> propertyIds,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<PropertyKeyEntitlement>>([]);
    }

    private sealed class NoPdf : IEnfazInvoicePdfRenderer
    {
        public byte[] Render(PoEnfazBillingDto billing) => [];
    }
}
