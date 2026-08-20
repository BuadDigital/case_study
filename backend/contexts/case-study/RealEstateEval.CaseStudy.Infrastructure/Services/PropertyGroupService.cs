using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// grouped-property linking: the system suggests
/// (same owner / same plan / adjacent plots / coordinate proximity), a human confirms,
/// the confirmation is audited, and the link is reversible with a reason. Work orders
/// stay administratively independent.
/// </summary>
public sealed class PropertyGroupService : IPropertyGroupService
{
    private const int MaxSuggestions = 10;
    private readonly ICaseStudyRepository db;
    private readonly IAuditLogWriter audit;
    private readonly IAuditLogAppend _auditLog;
    private readonly TimeProvider _time;

    public PropertyGroupService(
        ICaseStudyRepository db,
        PlatformDbContext platformDb,
        IAuditLogWriter audit,
        TimeProvider? time = null)
        : this(db, audit, new PlatformAuditLogAppend(platformDb), time)
    {
    }

    [ActivatorUtilitiesConstructor]
    public PropertyGroupService(
        ICaseStudyRepository db,
        IAuditLogWriter audit,
        IAuditLogAppend auditLog,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        this.db = db;
        this.audit = audit;
        _auditLog = auditLog;
    }

    public async Task<PropertyGroupDto?> GetForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var member = await db.PropertyGroupMembers.AsNoTracking()
            .Where(m => m.PropertyId == propertyId && m.IsActive)
            .FirstOrDefaultAsync(cancellationToken);
        if (member is null) return null;

        return await BuildGroupDtoAsync(member.GroupId, cancellationToken);
    }

    public async Task<IReadOnlyList<PropertyGroupSuggestionDto>> SuggestAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var subject = await db.WorkOrderProperties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);
        if (subject is null) return [];

        var subjectInput = await BuildCandidateInputAsync(subject, cancellationToken);

        var alreadyLinked = await db.PropertyGroupMembers.AsNoTracking()
            .Where(m => m.IsActive)
            .Select(m => new { m.PropertyId, m.GroupId })
            .ToListAsync(cancellationToken);
        var linkedByProperty = alreadyLinked.ToDictionary(x => x.PropertyId, x => x.GroupId);
        var subjectGroupId = linkedByProperty.GetValueOrDefault(propertyId);

 // Cross-work-order scan — the spec's whole point is deeds arriving in separate orders.
        var candidates = await db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id != propertyId && !p.IsRemoved)
            .OrderByDescending(p => p.Id)
            .Take(500)
            .ToListAsync(cancellationToken);

        var poNumbers = await db.WorkOrders.AsNoTracking()
            .ToDictionaryAsync(w => w.Id, w => w.PoNumber, cancellationToken);

        var results = new List<PropertyGroupSuggestionDto>();
        foreach (var candidate in candidates)
        {
 // Same group already → nothing to suggest for this pair.
            if (subjectGroupId != Guid.Empty
                && linkedByProperty.GetValueOrDefault(candidate.Id) == subjectGroupId)
            {
                continue;
            }

            var candidateInput = await BuildCandidateInputAsync(candidate, cancellationToken);
            var signals = PropertyGroupRules.EvaluateSignals(subjectInput, candidateInput);
            if (signals.Count == 0) continue;

            results.Add(new PropertyGroupSuggestionDto
            {
                PropertyId = candidate.Id,
                PoNumber = poNumbers.GetValueOrDefault(candidate.WorkOrderId, ""),
                DeedNumber = candidate.DeedNumber,
                OwnerName = candidate.OwnerName,
                PlanNumber = candidate.PlanNumber,
                PlotNumber = candidate.PlotNumber,
                SignalCodes = signals,
                SignalLabelsAr = signals.Select(PropertyGroupSignals.LabelAr).ToList(),
                ExistingGroupId = linkedByProperty.TryGetValue(candidate.Id, out var g) ? g : null,
            });

            if (results.Count >= MaxSuggestions) break;
        }

        return results
            .OrderByDescending(r => r.SignalCodes.Count)
            .ToList();
    }

    public async Task<(PropertyGroupDto? Result, string? Error)> ConfirmLinkAsync(
        Guid propertyId,
        Guid targetPropertyId,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (propertyId == targetPropertyId)
            return (null, "لا يمكن ربط العقار بنفسه");

        var subject = await db.WorkOrderProperties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);
        var target = await db.WorkOrderProperties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == targetPropertyId, cancellationToken);
        if (subject is null || target is null)
            return (null, "العقار غير موجود");

        var subjectMember = await db.PropertyGroupMembers
            .FirstOrDefaultAsync(m => m.PropertyId == propertyId && m.IsActive, cancellationToken);
        var targetMember = await db.PropertyGroupMembers
            .FirstOrDefaultAsync(m => m.PropertyId == targetPropertyId && m.IsActive, cancellationToken);

        if (subjectMember is not null && targetMember is not null)
        {
            return subjectMember.GroupId == targetMember.GroupId
                ? (await BuildGroupDtoAsync(subjectMember.GroupId, cancellationToken), null)
                : (null, "العقاران في مجمعين مختلفين — فُكّ أحدهما أولًا بمبرر");
        }

        var now = _time.UtcNow();
        var groupId = subjectMember?.GroupId ?? targetMember?.GroupId ?? Guid.Empty;
        if (groupId == Guid.Empty)
        {
            var group = new PropertyGroup { Id = Guid.NewGuid(), CreatedAtUtc = now };
            db.PropertyGroups.Add(group);
            groupId = group.Id;
        }

        var subjectInput = await BuildCandidateInputAsync(subject, cancellationToken);
        var targetInput = await BuildCandidateInputAsync(target, cancellationToken);
        var signals = string.Join(
            ",", PropertyGroupRules.EvaluateSignals(subjectInput, targetInput));

        var actor = string.IsNullOrWhiteSpace(actorId) ? "unknown" : actorId;
        if (subjectMember is null)
        {
            db.PropertyGroupMembers.Add(new PropertyGroupMember
            {
                Id = Guid.NewGuid(),
                GroupId = groupId,
                PropertyId = propertyId,
                LinkedByUserId = actor,
                LinkedAtUtc = now,
                SuggestionSignals = signals,
                IsActive = true,
            });
        }

        if (targetMember is null)
        {
            db.PropertyGroupMembers.Add(new PropertyGroupMember
            {
                Id = Guid.NewGuid(),
                GroupId = groupId,
                PropertyId = targetPropertyId,
                LinkedByUserId = actor,
                LinkedAtUtc = now,
                SuggestionSignals = signals,
                IsActive = true,
            });
        }

        await db.SaveChangesAsync(cancellationToken);

 // التأكيد بشري مسجَّل بالتدقيق ( stage 1).
        await _auditLog.AppendAsync(audit.Create(
            actor,
            "PROPERTY_GROUP_LINK_CONFIRMED",
            "property_group",
            groupId.ToString("D"),
            null,
            new { propertyId, targetPropertyId, signals }), cancellationToken);
        return (await BuildGroupDtoAsync(groupId, cancellationToken), null);
    }

    public async Task<(PropertyGroupDto? Result, string? Error)> UnlinkAsync(
        Guid propertyId,
        string reason,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
            return (null, "مبرر فك الربط إلزامي");

        var member = await db.PropertyGroupMembers
            .FirstOrDefaultAsync(m => m.PropertyId == propertyId && m.IsActive, cancellationToken);
        if (member is null)
            return (null, "العقار غير مرتبط بمجمع");

        var actor = string.IsNullOrWhiteSpace(actorId) ? "unknown" : actorId;
        member.IsActive = false;
        member.UnlinkReason = reason.Trim();
        member.UnlinkedByUserId = actor;
        member.UnlinkedAtUtc = _time.UtcNow();
        await db.SaveChangesAsync(cancellationToken);

        await _auditLog.AppendAsync(audit.Create(
            actor,
            "PROPERTY_GROUP_UNLINKED",
            "property_group",
            member.GroupId.ToString("D"),
            new { propertyId },
            new { reason = member.UnlinkReason }), cancellationToken);

        return (await BuildGroupDtoAsync(member.GroupId, cancellationToken), null);
    }

    private async Task<PropertyGroupRules.CandidateInput> BuildCandidateInputAsync(
        WorkOrderProperty prop,
        CancellationToken cancellationToken)
    {
        var workspace = await db.FieldInspectionWorkspaces.AsNoTracking()
            .Where(w => w.PropertyId == prop.Id)
            .OrderByDescending(w => w.UpdatedAtUtc)
            .Select(w => new { w.MapLatitude, w.MapLongitude })
            .FirstOrDefaultAsync(cancellationToken);

        return new PropertyGroupRules.CandidateInput(
            prop.OwnerName,
            prop.PlanNumber,
            prop.PlotNumber,
            workspace?.MapLatitude,
            workspace?.MapLongitude);
    }

    private async Task<PropertyGroupDto?> BuildGroupDtoAsync(
        Guid groupId,
        CancellationToken cancellationToken)
    {
        var group = await db.PropertyGroups.AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == groupId, cancellationToken);
        if (group is null) return null;

        var members = await db.PropertyGroupMembers.AsNoTracking()
            .Where(m => m.GroupId == groupId && m.IsActive)
            .OrderBy(m => m.LinkedAtUtc)
            .ToListAsync(cancellationToken);

        var propertyIds = members.Select(m => m.PropertyId).ToList();
        var props = await db.WorkOrderProperties.AsNoTracking()
            .Where(p => propertyIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);
        var poNumbers = await db.WorkOrders.AsNoTracking()
            .ToDictionaryAsync(w => w.Id, w => w.PoNumber, cancellationToken);

        return new PropertyGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            CreatedAtUtc = group.CreatedAtUtc.ToString("o"),
            Members = members
                .Select(m =>
                {
                    props.TryGetValue(m.PropertyId, out var p);
                    return new PropertyGroupMemberDto
                    {
                        PropertyId = m.PropertyId,
                        PoNumber = p is null ? "" : poNumbers.GetValueOrDefault(p.WorkOrderId, ""),
                        DeedNumber = p?.DeedNumber ?? "",
                        DeedKind = p is null ? null : DeedKindLabels.LabelAr(p.DeedKind),
                        LinkedByUserId = m.LinkedByUserId,
                        LinkedAtUtc = m.LinkedAtUtc.ToString("o"),
                        SignalLabelsAr = (m.SuggestionSignals ?? "")
                            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                            .Select(PropertyGroupSignals.LabelAr)
                            .ToList(),
                    };
                })
                .ToList(),
        };
    }
}
