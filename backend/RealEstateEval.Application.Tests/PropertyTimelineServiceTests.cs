using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Failures.Infrastructure.Services;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>The property timeline: one milestone per business step, oldest first, nothing technical shown.</summary>
public class PropertyTimelineServiceTests
{
    private const string Po = "PO-9";
    private static readonly Guid PropertyId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly DateTime T0 = new(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc);

    private static (PropertyTimelineService Service, TestBoundedContexts.Bundle Bundle) Create()
    {
        var bundle = TestBoundedContexts.Create();
        return (new PropertyTimelineService(bundle.CaseStudy, new FailureLookup(bundle.Failures)), bundle);
    }

    private static async Task Add(
        TestBoundedContexts.Bundle bundle,
        string key,
        string title,
        DateTime at,
        string? detail = null,
        string tone = PropertyTimelineTones.Done)
    {
        bundle.CaseStudy.PropertyTimelineEntries.Add(new PropertyTimelineEntry
        {
            Id = Guid.NewGuid(),
            PoNumber = Po,
            PropertyId = PropertyId,
            EventKey = key,
            Title = title,
            Detail = detail,
            Tone = tone,
            OccurredAtUtc = at,
            RecordedAtUtc = at,
        });
        await bundle.CaseStudy.SaveChangesAsync();
    }

    [Fact]
    public async Task Events_come_oldest_first()
    {
        var (service, bundle) = Create();
        await Add(bundle, "b", "ثانياً", T0.AddHours(2));
        await Add(bundle, "a", "أولاً", T0.AddHours(1));
        await Add(bundle, "c", "ثالثاً", T0.AddHours(3));

        var events = await service.GetForPropertyAsync(Po, PropertyId);

        Assert.Equal(["أولاً", "ثانياً", "ثالثاً"], events.Select(e => e.Title));
    }

    [Fact]
    public async Task Technical_rows_are_not_shown()
    {
        var (service, bundle) = Create();
        var task = Guid.NewGuid();
        await Add(bundle, "due", "موعد الاستحقاق", T0.AddDays(30));
        await Add(bundle, $"task:{task}:created", "دراسة حالة العقار", T0);
        await Add(bundle, $"task:{task}:case-study", "تعيين أخصائي دراسة الحالة", T0);
        await Add(bundle, $"task:{task}:bourse-complete", "اكتمال استعلام البورصة", T0);
        await Add(bundle, $"party:{Guid.NewGuid()}:assigned", "تعيين المعاين الميداني", T0, "أحمد");
        await Add(bundle, "enfath", "استلام من إنفاذ", T0);

        var events = await service.GetForPropertyAsync(Po, PropertyId);

        Assert.Equal(["استلام أمر العمل من إنفاذ"], events.Select(e => e.Title));
    }

    [Fact]
    public async Task Old_distribution_row_gets_its_detail_from_the_hidden_assignment_rows()
    {
        var (service, bundle) = Create();
        var task = Guid.NewGuid();
        await Add(bundle, $"task:{task}:distribution", "توزيع المعاملة", T0);
        await Add(bundle, $"task:{task}:specialist-assigned", "تعيين أخصائي دراسة الحالة", T0, "سارة");
        await Add(bundle, $"party:{Guid.NewGuid()}:assigned", "تعيين المعاين الميداني", T0.AddSeconds(1), "أحمد");

        var events = await service.GetForPropertyAsync(Po, PropertyId);

        var distribution = Assert.Single(events);
        Assert.Equal("أخصائي دراسة الحالة: سارة · المعاين الميداني: أحمد", distribution.Detail);
    }

    [Fact]
    public async Task Old_titles_are_reworded_and_the_redistribution_prefix_dropped()
    {
        var (service, bundle) = Create();
        await Add(bundle, "k1", "تسليم التقييم للأخصائي", T0);
        await Add(bundle, "k2", "اعتماد تقرير التقييم", T0.AddMinutes(1));
        await Add(bundle, "k3", "إعادة إسناد — تعيين المعاين الميداني", T0.AddMinutes(2));

        var events = await service.GetForPropertyAsync(Po, PropertyId);

        Assert.Equal(
            ["تسليم المقيّم لتقييمه", "اطلاع الأخصائي على التقييم", "إعادة إسناد — المعاين الميداني"],
            events.Select(e => e.Title));
    }

    [Fact]
    public async Task A_date_without_a_time_is_shown_as_a_date_only()
    {
        var (service, bundle) = Create();
        await Add(bundle, "enfath", "استلام أمر العمل من إنفاذ", new DateTime(2026, 9, 20, 0, 0, 0, DateTimeKind.Utc));
        await Add(bundle, "x", "حدث", T0);

        var events = await service.GetForPropertyAsync(Po, PropertyId);

        Assert.Equal("2026-09-20", events[0].At);
        Assert.Contains("T08:00:00", events[1].At);
    }

    [Fact]
    public async Task Everything_is_done_except_the_problems_and_the_backward_moves()
    {
        var (service, bundle) = Create();
        await Add(bundle, "p", "خطوة جارية قديمة", T0, tone: PropertyTimelineTones.Active);
        await Add(bundle, "q", "خطوة مخفّتة قديمة", T0.AddMinutes(1), tone: PropertyTimelineTones.Muted);
        await Add(bundle, "failure:1:created", "تسجيل تعذر", T0.AddMinutes(2), tone: PropertyTimelineTones.Warn);
        await Add(bundle, "task:1:phase-revert:5", "إعادة مرحلة", T0.AddMinutes(3), tone: PropertyTimelineTones.Active);

        var events = await service.GetForPropertyAsync(Po, PropertyId);

        Assert.Equal(
            [PropertyTimelineTones.Done, PropertyTimelineTones.Done, PropertyTimelineTones.Warn, PropertyTimelineTones.Warn],
            events.Select(e => e.Tone));
    }

    [Fact]
    public async Task A_repeated_milestone_with_a_new_key_shows_both_times()
    {
        var (service, bundle) = Create();
        var task = Guid.NewGuid();
        await Add(bundle, $"party:{task}:submitted:1", "تسليم المقيّم لتقييمه", T0);
        await Add(bundle, $"party:{task}:submitted:2", "تسليم المقيّم لتقييمه", T0.AddDays(3));

        var events = await service.GetForPropertyAsync(Po, PropertyId);

        Assert.Equal(2, events.Count);
    }

    [Fact]
    public async Task Record_skips_a_key_that_already_exists()
    {
        var (service, _) = Create();
        await service.RecordAsync(Po, PropertyId, "k", "أول", null, PropertyTimelineTones.Done, T0);
        await service.RecordAsync(Po, PropertyId, "k", "ثانٍ", null, PropertyTimelineTones.Done, T0.AddHours(1));

        var events = await service.GetForPropertyAsync(Po, PropertyId);

        Assert.Equal("أول", Assert.Single(events).Title);
    }
}
