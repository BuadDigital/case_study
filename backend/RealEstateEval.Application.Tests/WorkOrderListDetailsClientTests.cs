using Microsoft.Extensions.Options;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// GET /api/work-orders/details feeds the property map and other whole-list readers: the client's
/// name must travel with each order, not only the client id.
/// </summary>
public class WorkOrderListDetailsClientTests
{
    private static readonly DateTime Now = new(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task The_details_list_carries_the_clients_name()
    {
        var bundle = TestBoundedContexts.Create($"wo-details-client-{Guid.NewGuid():N}");
        var caseStudy = bundle.CaseStudy;
        var clientId = Guid.NewGuid();
        caseStudy.Clients.Add(new Client
        {
            Id = clientId,
            NameAr = "مركز الإسناد والتصفية",
            CreatedAtUtc = Now,
            UpdatedAtUtc = Now,
        });
        caseStudy.WorkOrders.AddRange(
            Order("PO-WITH-CLIENT", clientId),
            Order("PO-NO-CLIENT", clientId: null));
        caseStudy.SaveChanges();

        var query = new WorkOrderQueryService(
            caseStudy,
            new FailureLookup(bundle.Failures),
            new PoEnfazInvoiceLookup(TestInspectorFeeServiceFactory.ShareFinancial(caseStudy)),
            new UserLabelLookup(TestInspectorFeeServiceFactory.ShareIdentity(caseStudy)),
            new WorkOrderLoader(caseStudy),
            new WorkOrderVisibilityFilter(caseStudy),
            Options.Create(new DatabaseOptions()));

        var list = await query.ListDetailsAsync(Staff());

        Assert.Equal("مركز الإسناد والتصفية", list.Single(w => w.PoNumber == "PO-WITH-CLIENT").ClientNameAr);
        Assert.Null(list.Single(w => w.PoNumber == "PO-NO-CLIENT").ClientNameAr);
    }

    private static WorkOrder Order(string poNumber, Guid? clientId) => new()
    {
        Id = Guid.NewGuid(),
        PoNumber = poNumber,
        AssignmentType = AssignmentType.Execution,
        AssignmentSpecialist = "أحمد",
        ExpectedPropertyCount = 1,
        ClientId = clientId,
        CreatedAtUtc = Now,
        ReceivedFromEnfathAt = DateOnly.FromDateTime(Now),
        PromulgationDate = DateOnly.FromDateTime(Now),
        DueDateAt = DateOnly.FromDateTime(Now).AddDays(10),
        Properties = [],
    };

    private static PermissionsDto Staff() => new()
    {
        UserId = "staff-1",
        PrototypeRole = "case-specialist",
        Capabilities = ["manage-work-orders"],
    };
}
