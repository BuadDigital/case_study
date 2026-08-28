using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

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

    // A8: the PlatformDbContext convenience ctor is gone — compose PlatformAuditLogAppend
    // explicitly where needed (tests); DI uses the interface ctor below.

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

        // دفعة واحدة لإحداثيات المعاينة بدل استعلام لكل مرشح (كانت N+1 حتى 500 استعلام).
        var inputs = await BuildCandidateInputsAsync(
            candidates.Append(subject).ToList(), cancellationToken);
        var subjectInput = inputs[subject.Id];

        // كانت تُحمَّل كل أوامر العمل — نكتفي بأوامر المرشحين.
        var candidateWorkOrderIds = candidates
            .Select(c => c.WorkOrderId)
            .Distinct()
            .ToList();
        var poNumbers = await db.WorkOrders.AsNoTracking()
            .Where(w => candidateWorkOrderIds.Contains(w.Id))
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

            var candidateInput = inputs[candidate.Id];
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

        // زوجا التحميل في استعلامين بدل أربعة — نفس الجدول ونفس الشكل.
        var pair = await db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == propertyId || p.Id == targetPropertyId)
            .ToListAsync(cancellationToken);
        var subject = pair.FirstOrDefault(p => p.Id == propertyId);
        var target = pair.FirstOrDefault(p => p.Id == targetPropertyId);
        if (subject is null || target is null)
            return (null, "العقار غير موجود");

        var members = await db.PropertyGroupMembers
            .Where(m =>
                (m.PropertyId == propertyId || m.PropertyId == targetPropertyId) &&
                m.IsActive)
            .ToListAsync(cancellationToken);
        var subjectMember = members.FirstOrDefault(m => m.PropertyId == propertyId);
        var targetMember = members.FirstOrDefault(m => m.PropertyId == targetPropertyId);

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

        var pairInputs = await BuildCandidateInputsAsync(pair, cancellationToken);
        var signals = string.Join(
            ",",
            PropertyGroupRules.EvaluateSignals(
                pairInputs[subject.Id],
                pairInputs[target.Id]));

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

    /// <summary>إحداثيات أحدث معاينة لكل عقار في استعلام واحد — بدل استعلامٍ لكل عقار.</summary>
    private async Task<Dictionary<Guid, PropertyGroupRules.CandidateInput>> BuildCandidateInputsAsync(
        IReadOnlyCollection<WorkOrderProperty> props,
        CancellationToken cancellationToken)
    {
        var ids = props.Select(p => p.Id).ToList();
        var workspaces = await db.FieldInspectionWorkspaces.AsNoTracking()
            .Where(w => w.PropertyId != null && ids.Contains(w.PropertyId.Value))
            .OrderByDescending(w => w.UpdatedAtUtc)
            .Select(w => new { w.PropertyId, w.MapLatitude, w.MapLongitude })
            .ToListAsync(cancellationToken);
        var latestByProperty = workspaces
            .GroupBy(w => w.PropertyId!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var result = new Dictionary<Guid, PropertyGroupRules.CandidateInput>(props.Count);
        foreach (var prop in props)
        {
            latestByProperty.TryGetValue(prop.Id, out var workspace);
            result[prop.Id] = new PropertyGroupRules.CandidateInput(
                prop.OwnerName,
                prop.PlanNumber,
                prop.PlotNumber,
                workspace?.MapLatitude,
                workspace?.MapLongitude);
        }

        return result;
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
