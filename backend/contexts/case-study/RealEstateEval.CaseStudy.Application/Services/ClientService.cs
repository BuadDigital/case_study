using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Application;

namespace RealEstateEval.CaseStudy.Application.Services;

public class ClientService(IClientRepository clients, TimeProvider? time = null) : IClientService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task EnsureSeedClientsAsync(CancellationToken cancellationToken)
    {
        var now = _time.UtcNow();
        var added = false;

        if (!await clients.ExistsAsync(SeedClientIds.InfathAssignmentCenter, cancellationToken))
        {
            clients.Add(new Client
            {
                Id = SeedClientIds.InfathAssignmentCenter,
                NameAr = "مركز الإسناد والتصفية (إنفاذ)",
                NameEn = "Assignment and Liquidation Center (Infath)",
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
            added = true;
        }

        if (!await clients.ExistsAsync(SeedClientIds.NabrRealEstate, cancellationToken))
        {
            clients.Add(new Client
            {
                Id = SeedClientIds.NabrRealEstate,
                NameAr = "شركة نبر العقارية",
                NameEn = "Nabr Real Estate Company",
                IsActive = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
            added = true;
        }

        if (added)
            await clients.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ClientDto>> ListAsync(
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        await EnsureSeedClientsAsync(cancellationToken);
        var rows = await clients.ListAsync(includeInactive, cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    public async Task<ClientDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await clients.GetByIdAsync(id, track: false, cancellationToken);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<(ClientDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        UpsertClientRequest request,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request);
        if (errors.Count > 0) return (null, errors);

        var now = _time.UtcNow();
        var entity = new Client
        {
            Id = Guid.NewGuid(),
            NameAr = request.NameAr.Trim(),
            NameEn = Normalize(request.NameEn),
            IdentityNumber = Normalize(request.IdentityNumber),
            Phone = Normalize(request.Phone),
            Email = Normalize(request.Email),
            IsActive = request.IsActive,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
        clients.Add(entity);
        await clients.SaveChangesAsync(cancellationToken);
        return (ToDto(entity), null);
    }

    public async Task<(ClientDto? Result, Dictionary<string, string>? Errors)> UpdateAsync(
        Guid id,
        UpsertClientRequest request,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request);
        if (errors.Count > 0) return (null, errors);

        var entity = await clients.GetByIdAsync(id, track: true, cancellationToken);
        if (entity is null)
            return (null, new Dictionary<string, string> { ["_"] = "العميل غير موجود" });

        entity.NameAr = request.NameAr.Trim();
        entity.NameEn = Normalize(request.NameEn);
        entity.IdentityNumber = Normalize(request.IdentityNumber);
        entity.Phone = Normalize(request.Phone);
        entity.Email = Normalize(request.Email);
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = _time.UtcNow();
        await clients.SaveChangesAsync(cancellationToken);
        return (ToDto(entity), null);
    }

    public async Task<(bool Ok, string? Error)> DeactivateAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (id == SeedClientIds.InfathAssignmentCenter)
            return (false, "لا يمكن تعطيل عميل إنفاذ الأساسي");
        if (id == SeedClientIds.NabrRealEstate)
            return (false, "لا يمكن تعطيل شركة نبر العقارية");

        var entity = await clients.GetByIdAsync(id, track: true, cancellationToken);
        if (entity is null) return (false, "العميل غير موجود");
        entity.IsActive = false;
        entity.UpdatedAtUtc = _time.UtcNow();
        await clients.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    private static Dictionary<string, string> Validate(UpsertClientRequest request)
    {
        var errors = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(request.NameAr))
            errors["nameAr"] = "اسم العميل بالعربية مطلوب";
        return errors;
    }

    private static string? Normalize(string? value) => Texts.NullIfBlank(value);

    private static ClientDto ToDto(Client c) => new()
    {
        Id = c.Id,
        NameAr = c.NameAr,
        NameEn = c.NameEn,
        IdentityNumber = c.IdentityNumber,
        Phone = c.Phone,
        Email = c.Email,
        IsActive = c.IsActive,
        CreatedAtUtc = c.CreatedAtUtc.ToString("o"),
        UpdatedAtUtc = c.UpdatedAtUtc.ToString("o"),
    };
}
