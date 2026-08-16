using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public class ClientService(CaseStudyDbContext db) : IClientService
{
    public async Task EnsureSeedClientsAsync(CancellationToken cancellationToken)
    {
        if (await db.Clients.AnyAsync(c => c.Id == SeedClientIds.InfathAssignmentCenter, cancellationToken))
            return;

        var now = DateTime.UtcNow;
        db.Clients.Add(new Client
        {
            Id = SeedClientIds.InfathAssignmentCenter,
            NameAr = "مركز الإسناد والتصفية (إنفاذ)",
            NameEn = "Assignment and Liquidation Center (Infath)",
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ClientDto>> ListAsync(
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        await EnsureSeedClientsAsync(cancellationToken);
        var q = db.Clients.AsNoTracking().AsQueryable();
        if (!includeInactive)
            q = q.Where(c => c.IsActive);
        var rows = await q.OrderBy(c => c.NameAr).ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    public async Task<ClientDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await db.Clients.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<(ClientDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        UpsertClientRequest request,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request);
        if (errors.Count > 0) return (null, errors);

        var now = DateTime.UtcNow;
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
        db.Clients.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return (ToDto(entity), null);
    }

    public async Task<(ClientDto? Result, Dictionary<string, string>? Errors)> UpdateAsync(
        Guid id,
        UpsertClientRequest request,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request);
        if (errors.Count > 0) return (null, errors);

        var entity = await db.Clients.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (entity is null)
            return (null, new Dictionary<string, string> { ["_"] = "العميل غير موجود" });

        entity.NameAr = request.NameAr.Trim();
        entity.NameEn = Normalize(request.NameEn);
        entity.IdentityNumber = Normalize(request.IdentityNumber);
        entity.Phone = Normalize(request.Phone);
        entity.Email = Normalize(request.Email);
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return (ToDto(entity), null);
    }

    public async Task<(bool Ok, string? Error)> DeactivateAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (id == SeedClientIds.InfathAssignmentCenter)
            return (false, "لا يمكن تعطيل عميل إنفاذ الأساسي");

        var entity = await db.Clients.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (entity is null) return (false, "العميل غير موجود");
        entity.IsActive = false;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    private static Dictionary<string, string> Validate(UpsertClientRequest request)
    {
        var errors = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(request.NameAr))
            errors["nameAr"] = "اسم العميل بالعربية مطلوب";
        return errors;
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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
