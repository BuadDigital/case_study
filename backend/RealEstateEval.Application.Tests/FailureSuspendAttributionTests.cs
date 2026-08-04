using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class FailureSuspendAttributionTests
{
    private static readonly Guid FailureId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid PropertyId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly string SupervisorUserId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    [Fact]
    public async Task Suspend_persists_actor_and_timestamp()
    {
        var bundle = CreateDb();
        SeedReviewFailure(bundle);
        var service = CreateFailureService(bundle);

        var before = DateTime.UtcNow;
        var dto = await service.SuspendAsync(FailureId, "تعليق للتحقق", SupervisorUserId);
        var after = DateTime.UtcNow;

        Assert.NotNull(dto);

        var entity = await bundle.Failures.PropertyFailures.AsNoTracking()
            .SingleAsync(f => f.Id == FailureId);
        Assert.Equal(PropertyFailureStatus.Suspended, entity.Status);
        Assert.Equal(SupervisorUserId, entity.SuspendedByUserId);
        Assert.NotNull(entity.SuspendedAtUtc);
        Assert.InRange(entity.SuspendedAtUtc!.Value, before.AddSeconds(-1), after.AddSeconds(1));
    }

    [Fact]
    public async Task Suspended_list_resolves_suspender_display_name_not_raiser()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        var suspendedAt = DateTime.UtcNow.AddHours(-2);
        db.Users.Add(new ApplicationUser
        {
            Id = SupervisorUserId,
            UserName = "supervisor",
            DisplayName = "مشرف الاختبار",
        });
        bundle.Failures.PropertyFailures.Add(PropertyFailure.Reconstitute(
            FailureId,
            "PO-900",
            PropertyId.ToString(),
            "D-1",
            "تعذر",
            "access",
            "internal",
            "مفتش ميداني",
            "ملاحظة",
            "ملاحظة المشرف",
            PropertyFailureStatus.Suspended,
            "specialist",
            suspendedAt.AddDays(-1),
            suspendedAt,
            suspendedAt,
            SupervisorUserId));
        await db.SaveChangesAsync();
        await bundle.Failures.SaveChangesAsync();

        var list = await new SuspendedTransactionsService(db).ListAsync();

        var row = Assert.Single(list);
        Assert.Equal(suspendedAt, row.SuspendedAt);
        Assert.Equal("مشرف الاختبار", row.SuspendedBy);
        Assert.Equal("مفتش ميداني", row.RaisedByRole);
        Assert.NotEqual(row.RaisedByRole, row.SuspendedBy);
    }

    [Fact]
    public async Task Suspended_list_leaves_SuspendedBy_blank_when_actor_unknown()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        var suspendedAt = DateTime.UtcNow.AddHours(-1);
        bundle.Failures.PropertyFailures.Add(PropertyFailure.Reconstitute(
            FailureId,
            "PO-901",
            PropertyId.ToString(),
            "D-2",
            "تعذر تاريخي",
            "access",
            "internal",
            "مفتش ميداني",
            "ملاحظة",
            "",
            PropertyFailureStatus.Suspended,
            "specialist",
            suspendedAt.AddDays(-1),
            suspendedAt,
            suspendedAt,
            null));
        await db.SaveChangesAsync();
        await bundle.Failures.SaveChangesAsync();

        var list = await new SuspendedTransactionsService(db).ListAsync();

        var row = Assert.Single(list);
        Assert.Equal("", row.SuspendedBy);
        Assert.Equal(suspendedAt, row.SuspendedAt);
    }

    private static void SeedReviewFailure(TestBoundedContexts.Bundle bundle)
    {
        var now = DateTime.UtcNow;
        bundle.Failures.PropertyFailures.Add(PropertyFailure.Reconstitute(
            FailureId,
            "PO-900",
            PropertyId.ToString(),
            "D-1",
            "تعذر",
            "access",
            "internal",
            "مفتش ميداني",
            "ملاحظة",
            "",
            PropertyFailureStatus.Review,
            "specialist",
            now,
            now));
        bundle.Failures.SaveChanges();
    }

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"failure-suspend-{Guid.NewGuid():N}");

    private static FailureService CreateFailureService(TestBoundedContexts.Bundle bundle) =>
        TestBoundedContexts.CreateFailureService(bundle);
}
