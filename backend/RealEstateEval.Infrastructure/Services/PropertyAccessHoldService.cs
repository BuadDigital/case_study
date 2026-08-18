using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Access-hold side effects on Case Study tasks. Failure rows live on the Failures owner
/// (<see cref="IFailureService"/> — EF on the Failures host, HTTP elsewhere). Property
/// identity is resolved through <see cref="ICaseStudyLookup"/>.
/// </summary>
public sealed class PropertyAccessHoldService : IPropertyAccessHoldService
{
    private readonly ICaseStudyLookup _caseStudy;
    private readonly IFailureService _failures;

    public PropertyAccessHoldService(
        CaseStudyDbContext cs,
        FailuresDbContext failures,
        IdentityDbContext identity,
        INotificationService notifications,
        NotificationRecipientResolver recipients)
        : this(
            new CaseStudyLookup(cs),
            new FailureService(
                failures,
                cs,
                new WorkflowTaskShellPatcher(cs),
                new PropertyTimelineService(cs, failures),
                notifications,
                recipients,
                new UserLabelLookup(identity)))
    {
    }

    public PropertyAccessHoldService(CaseStudyDbContext cs, IFailureService failures)
        : this(new CaseStudyLookup(cs), failures)
    {
    }

    [ActivatorUtilitiesConstructor]
    public PropertyAccessHoldService(ICaseStudyLookup caseStudy, IFailureService failures)
    {
        _caseStudy = caseStudy;
        _failures = failures;
    }

    public async Task EnsureEvictionHoldAsync(
        Guid propertyId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var property = await _caseStudy.GetPropertyAsync(propertyId, cancellationToken);
        if (property is null) return;

        await _failures.ApplyEvictionHoldAsync(
            property.PoNumber,
            property.Id.ToString(),
            property.DeedNumber,
            actorName,
            cancellationToken);
    }

    public async Task ResolveEvictionHoldAsync(
        Guid propertyId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var property = await _caseStudy.GetPropertyAsync(propertyId, cancellationToken);
        if (property is null) return;

        await _failures.ResolveEvictionHoldsAsync(
            property.PoNumber,
            property.Id.ToString(),
            actorName,
            cancellationToken);
    }

    public async Task EnsureKeyUnmatchedFailureAsync(
        Guid propertyId,
        string deedNumber,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var property = await _caseStudy.GetPropertyAsync(propertyId, cancellationToken);
        if (property is null) return;

        await _failures.EnsureKeyUnmatchedFailureAsync(
            property.PoNumber,
            property.Id.ToString(),
            string.IsNullOrWhiteSpace(deedNumber) ? property.DeedNumber : deedNumber,
            actorName,
            cancellationToken);
    }
}
