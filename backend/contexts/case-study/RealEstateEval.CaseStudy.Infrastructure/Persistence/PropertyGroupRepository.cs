using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class PropertyGroupRepository(CaseStudyDbContext db) : IPropertyGroupRepository
{
    public async Task<PropertyGroupMembership?> GetActiveMembershipAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        await db.PropertyGroupMembers.AsNoTracking()
            .Where(m => m.PropertyId == propertyId && m.IsActive)
            .Select(m => new PropertyGroupMembership(m.PropertyId, m.GroupId))
            .FirstOrDefaultAsync(cancellationToken);

    public Task<WorkOrderProperty?> GetPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        db.WorkOrderProperties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);

    public async Task<IReadOnlyList<PropertyGroupMembership>> ListActiveMembershipsAsync(
        CancellationToken cancellationToken) =>
        await db.PropertyGroupMembers.AsNoTracking()
            .Where(m => m.IsActive)
            .Select(m => new PropertyGroupMembership(m.PropertyId, m.GroupId))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<WorkOrderProperty>> ListLinkCandidatesAsync(
        Guid excludePropertyId,
        int take,
        CancellationToken cancellationToken) =>
        await db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id != excludePropertyId && !p.IsRemoved)
            .OrderByDescending(p => p.Id)
            .Take(take)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<WorkOrderProperty>> ListPropertiesByIdsAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken) =>
        await db.WorkOrderProperties.AsNoTracking()
            .Where(p => propertyIds.Contains(p.Id))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, string>> GetPoNumbersByWorkOrderIdsAsync(
        IReadOnlyCollection<Guid> workOrderIds,
        CancellationToken cancellationToken) =>
        await db.WorkOrders.AsNoTracking()
            .Where(w => workOrderIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.PoNumber, cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, string>> ListAllPoNumbersAsync(
        CancellationToken cancellationToken) =>
        await db.WorkOrders.AsNoTracking()
            .ToDictionaryAsync(w => w.Id, w => w.PoNumber, cancellationToken);

    public async Task<IReadOnlyList<PropertyInspectionPoint>> ListInspectionPointsAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken) =>
        await db.FieldInspectionWorkspaces.AsNoTracking()
            .Where(w => w.PropertyId != null && propertyIds.Contains(w.PropertyId.Value))
            .OrderByDescending(w => w.UpdatedAtUtc)
            .Select(w => new PropertyInspectionPoint(
                w.PropertyId!.Value,
                w.MapLatitude,
                w.MapLongitude))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<PropertyGroupMember>> ListActiveMembersForPropertiesAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken) =>
        await db.PropertyGroupMembers
            .Where(m => propertyIds.Contains(m.PropertyId) && m.IsActive)
            .ToListAsync(cancellationToken);

    public Task<PropertyGroupMember?> GetActiveMemberForUpdateAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        db.PropertyGroupMembers
            .FirstOrDefaultAsync(m => m.PropertyId == propertyId && m.IsActive, cancellationToken);

    public Task<PropertyGroup?> GetGroupAsync(Guid groupId, CancellationToken cancellationToken) =>
        db.PropertyGroups.AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == groupId, cancellationToken);

    public async Task<IReadOnlyList<PropertyGroupMember>> ListActiveMembersAsync(
        Guid groupId,
        CancellationToken cancellationToken) =>
        await db.PropertyGroupMembers.AsNoTracking()
            .Where(m => m.GroupId == groupId && m.IsActive)
            .OrderBy(m => m.LinkedAtUtc)
            .ToListAsync(cancellationToken);

    public void AddGroup(PropertyGroup group) => db.PropertyGroups.Add(group);

    public void AddMember(PropertyGroupMember member) => db.PropertyGroupMembers.Add(member);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
