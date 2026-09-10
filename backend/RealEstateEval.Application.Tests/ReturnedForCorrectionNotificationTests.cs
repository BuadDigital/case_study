using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Notifications;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Rules;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Infrastructure.Integration;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Every «إعادة للتصحيح» in the system speaks with one voice: warn tone, and the mandatory
/// reason the actor typed travels with it — the recipient cannot act without knowing why.
/// </summary>
public sealed class ReturnedForCorrectionNotificationTests
{
    [Fact]
    public void The_reason_is_appended_to_the_summary()
    {
        var request = ReturnedForCorrectionNotice.Build(
            title: "إعادة الفاتورة للتصحيح",
            summary: "أُعيدت فاتورتك للتصحيح",
            reason: "  الرقم الضريبي ناقص  ",
            href: "/party-fees",
            category: NotificationContract.Categories.Financial,
            entityType: null,
            entityId: "stmt-1",
            sourceEvent: "vendor-invoice-returned:stmt-1");

        Assert.Equal("أُعيدت فاتورتك للتصحيح: الرقم الضريبي ناقص", request.Body);
        Assert.Equal(NotificationContract.Tones.Warn, request.Tone);
        Assert.Equal("إعادة الفاتورة للتصحيح", request.Title);
        Assert.Equal(NotificationContract.Categories.Financial, request.Category);
        Assert.Equal("stmt-1", request.EntityId);
        Assert.Equal("vendor-invoice-returned:stmt-1", request.SourceEvent);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_blank_reason_leaves_a_clean_sentence(string? reason)
    {
        var request = ReturnedForCorrectionNotice.Build(
            title: "إعادة",
            summary: "أُعيد العمل للتصحيح",
            reason: reason,
            href: "/x",
            category: NotificationContract.Categories.Workflow,
            entityType: null,
            entityId: null,
            sourceEvent: "x:1");

        Assert.Equal("أُعيد العمل للتصحيح.", request.Body);
    }

    [Fact]
    public void The_returned_failure_notice_carries_the_reviewer_note()
    {
        var failure = FailureRules.NewEvictionHold("PO-9", Guid.NewGuid(), "D-9", "سالم", DateTime.UtcNow);

        var request = FailureRules.ReturnedNotification(failure, "أرفق صورة الصك");

        Assert.Equal("إعادة التعذر للتصحيح", request.Title);
        Assert.Contains("أرفق صورة الصك", request.Body);
        Assert.Contains("PO-9", request.Body);
        Assert.Equal(NotificationContract.Tones.Warn, request.Tone);
        Assert.Equal(NotificationContract.EntityTypes.Failure, request.EntityType);
        Assert.Equal($"failure-returned:{failure.Id}", request.SourceEvent);
    }

    [Fact]
    public async Task A_valuation_notice_reaches_the_addressed_audience_only()
    {
        var name = $"valuation-notice-{Guid.NewGuid():N}";
        var root = new Microsoft.EntityFrameworkCore.Storage.InMemoryDatabaseRoot();
        await using var messaging = TestMessagingContexts.CreateMessaging(name, root: root);
        await using var caseStudy = TestMessagingContexts.CreateCaseStudy(name, root);
        var identity = TestInspectorFeeServiceFactory.ShareIdentity(caseStudy);

        var propertyId = Guid.NewGuid();
        SeedProfile(identity, "user-appraiser", "val-1");
        SeedProfile(identity, "user-specialist", "cs-1");
        await identity.SaveChangesAsync();
        SeedOpenTask(caseStudy, propertyId, WorkflowTaskKind.PropertyAppraisal, "val-1");
        SeedOpenTask(caseStudy, propertyId, WorkflowTaskKind.CaseStudyProperty, "cs-1");
        await caseStudy.SaveChangesAsync();

        var handler = new NotificationIntegrationEventHandler(
            TestInspectorFeeServiceFactory.CreateRecipients(caseStudy),
            TestMessagingContexts.CreateNotificationService(messaging),
            NullLogger<NotificationIntegrationEventHandler>.Instance);

        await handler.HandleEnvelopeAsync(Envelope(new ValuationWorkflowNoticePayload(
            propertyId.ToString("D"),
            ValuationNoticeAudiences.Appraiser,
            "قُبل استرجاع التقرير",
            "عاد التقرير إليك للتعديل: خطأ في المساحة",
            NotificationContract.Tones.Warn,
            "/property-appraisal")));

        var row = Assert.Single(await messaging.UserNotifications.ToListAsync());
        Assert.Equal("user-appraiser", row.UserId);
        Assert.Equal("قُبل استرجاع التقرير", row.Title);
        Assert.Equal(NotificationContract.Tones.Warn, row.Tone);
        Assert.Equal(propertyId.ToString("D"), row.EntityId);
    }

    [Fact]
    public async Task An_unknown_audience_writes_nothing()
    {
        var name = $"valuation-notice-bad-{Guid.NewGuid():N}";
        var root = new Microsoft.EntityFrameworkCore.Storage.InMemoryDatabaseRoot();
        await using var messaging = TestMessagingContexts.CreateMessaging(name, root: root);
        await using var caseStudy = TestMessagingContexts.CreateCaseStudy(name, root);
        var handler = new NotificationIntegrationEventHandler(
            TestInspectorFeeServiceFactory.CreateRecipients(caseStudy),
            TestMessagingContexts.CreateNotificationService(messaging),
            NullLogger<NotificationIntegrationEventHandler>.Instance);

        await handler.HandleEnvelopeAsync(Envelope(new ValuationWorkflowNoticePayload(
            Guid.NewGuid().ToString("D"),
            "everyone",
            "عنوان",
            "نص",
            NotificationContract.Tones.Warn,
            "/x")));

        Assert.Empty(await messaging.UserNotifications.ToListAsync());
    }

    private static string Envelope(ValuationWorkflowNoticePayload payload) =>
        JsonSerializer.Serialize(
            new IntegrationEventEnvelope<ValuationWorkflowNoticePayload>(
                Guid.NewGuid(),
                IntegrationEventTypes.ValuationWorkflowNotice,
                DateTimeOffset.UtcNow,
                payload));

    private static void SeedProfile(IdentityDbContext db, string userId, string distributionAssigneeId)
    {
        db.Users.Add(new ApplicationUser
        {
            Id = userId,
            UserName = userId,
            Email = $"{userId}@example.test",
            NormalizedEmail = $"{userId}@EXAMPLE.TEST",
            DisplayName = userId,
        });
        db.UserProfiles.Add(new UserProfile
        {
            UserId = userId,
            DistributionAssigneeId = distributionAssigneeId,
            JobTitle = "party",
            RoleId = "real-estate-appraiser",
            Status = UserStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
        });
    }

    private static void SeedOpenTask(
        DbContext caseStudy,
        Guid propertyId,
        WorkflowTaskKind kind,
        string assigneeId)
    {
        caseStudy.Add(WorkflowTask.Create(
            kind: kind,
            poNumber: "PO-NOTICE",
            nowUtc: DateTime.UtcNow,
            title: "مهمة",
            propertyId: propertyId,
            assigneeId: assigneeId));
    }
}
