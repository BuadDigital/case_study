using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PartyFeePricingService : IPartyFeePricingService
{
    /// <summary>Seed defaults only — real rates are edited via SaveAsync / DB.</summary>
    public static readonly Guid SingletonId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    private readonly ApplicationDbContext _db;

    public PartyFeePricingService(ApplicationDbContext db) => _db = db;

    public async Task<PartyFeePricingDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var row = await EnsureRowAsync(cancellationToken);
        return ToDto(row);
    }

    public async Task<PartyFeePricingDto> SaveAsync(
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default)
    {
        var row = await EnsureRowAsync(cancellationToken);
        row.EngineeringSurveyFeeSar = Math.Max(0m, request.EngineeringSurveyFeeSar);
        row.GovernmentReviewFeeSar = Math.Max(0m, request.GovernmentReviewFeeSar);
        row.FieldInspectorIndividualFeeSar = Math.Max(0m, request.FieldInspectorIndividualFeeSar);
        row.FieldInspectorOrganizationFeeSar = Math.Max(0m, request.FieldInspectorOrganizationFeeSar);
        row.FieldInspectorEmployeeFeeSar = Math.Max(0m, request.FieldInspectorEmployeeFeeSar);
        row.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(row);
    }

    public async Task<decimal> ResolveDefaultFeeAsync(
        string taskKind,
        string partyType,
        CancellationToken cancellationToken = default)
    {
        var pricing = await GetAsync(cancellationToken);
        return ResolveFromDto(pricing, taskKind, partyType);
    }

    public static decimal ResolveFromDto(
        PartyFeePricingDto pricing,
        string taskKind,
        string partyType)
    {
        if (string.Equals(taskKind, "engineering-survey", StringComparison.OrdinalIgnoreCase))
            return pricing.EngineeringSurveyFeeSar;

        if (string.Equals(taskKind, "government-review", StringComparison.OrdinalIgnoreCase))
            return pricing.GovernmentReviewFeeSar;

        return partyType switch
        {
            InspectorFeeRules.TypeCooperatorOrganization => pricing.FieldInspectorOrganizationFeeSar,
            InspectorFeeRules.TypeCooperatorIndividual
                or InspectorFeeRules.TypeCooperatorLegacy => pricing.FieldInspectorIndividualFeeSar,
            _ => pricing.FieldInspectorEmployeeFeeSar,
        };
    }

    private async Task<PartyFeePricingConfig> EnsureRowAsync(CancellationToken cancellationToken)
    {
        var row = await _db.PartyFeePricingConfigs
            .FirstOrDefaultAsync(x => x.Id == SingletonId, cancellationToken);
        if (row is not null) return row;

        row = new PartyFeePricingConfig
        {
            Id = SingletonId,
            EngineeringSurveyFeeSar = EngineeringSurveyFeeRules.FallbackFeeSar,
            GovernmentReviewFeeSar = GovernmentReviewFeeRules.FallbackFeeSar,
            FieldInspectorIndividualFeeSar = InspectorFeeRules.CooperatorIndividualFeeSar,
            FieldInspectorOrganizationFeeSar = InspectorFeeRules.CooperatorOrganizationFeeSar,
            FieldInspectorEmployeeFeeSar = InspectorFeeRules.EmployeeFeeSar,
            UpdatedAtUtc = DateTime.UtcNow,
        };
        _db.PartyFeePricingConfigs.Add(row);
        await _db.SaveChangesAsync(cancellationToken);
        return row;
    }

    private static PartyFeePricingDto ToDto(PartyFeePricingConfig row) => new()
    {
        EngineeringSurveyFeeSar = row.EngineeringSurveyFeeSar,
        GovernmentReviewFeeSar = row.GovernmentReviewFeeSar,
        FieldInspectorIndividualFeeSar = row.FieldInspectorIndividualFeeSar,
        FieldInspectorOrganizationFeeSar = row.FieldInspectorOrganizationFeeSar,
        FieldInspectorEmployeeFeeSar = row.FieldInspectorEmployeeFeeSar,
        UpdatedAtUtc = row.UpdatedAtUtc,
    };
}
