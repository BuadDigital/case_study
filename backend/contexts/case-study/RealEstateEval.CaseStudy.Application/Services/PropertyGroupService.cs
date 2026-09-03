using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// grouped-property linking: the system suggests
/// (same owner / same plan / adjacent plots / coordinate proximity), a human confirms,
/// the confirmation is audited, and the link is reversible with a reason. Work orders
/// stay administratively independent.
/// </summary>
public sealed class PropertyGroupService : IPropertyGroupService
{
    private const int MaxSuggestions = 10;
    private readonly IPropertyGroupRepository db;
    private readonly IAuditLogWriter audit;
    private readonly IAuditLogAppend _auditLog;
    private readonly TimeProvider _time;

    // A8: the PlatformDbContext convenience ctor is gone — compose PlatformAuditLogAppend
    // explicitly where needed (tests); DI uses the interface ctor below.

    public PropertyGroupService(
        IPropertyGroupRepository db,
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
        var member = await db.GetActiveMembershipAsync(propertyId, cancellationToken);
        if (member is null) return null;

        return await BuildGroupDtoAsync(member.GroupId, cancellationToken);
    }

    public async Task<IReadOnlyList<PropertyGroupSuggestionDto>> SuggestAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var subject = await db.GetPropertyAsync(propertyId, cancellationToken);
        if (subject is null) return [];

        var alreadyLinked = await db.ListActiveMembershipsAsync(cancellationToken);
        var linkedByProperty = alreadyLinked.ToDictionary(x => x.PropertyId, x => x.GroupId);
        var subjectGroupId = linkedByProperty.GetValueOrDefault(propertyId);

 // Cross-work-order scan — the spec's whole point is deeds arriving in separate orders.
        var candidates = await db.ListLinkCandidatesAsync(propertyId, 500, cancellationToken);

        // One batch of Inspector coordinates per query allowance (N+1 up to 500 queries).
        var inputs = await BuildCandidateInputsAsync(
            candidates.Append(subject).ToList(), cancellationToken);
        var subjectInput = inputs[subject.Id];

        // All work orders were uploaded — just the candidates' orders.
        var candidateWorkOrderIds = candidates
            .Select(c => c.WorkOrderId)
            .Distinct()
            .ToList();
        var poNumbers = await db.GetPoNumbersByWorkOrderIdsAsync(
            candidateWorkOrderIds,
            cancellationToken);

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

        // Load pairs in two queries instead of four — same table, same shape.
        var pair = await db.ListPropertiesByIdsAsync(
            [propertyId, targetPropertyId],
            cancellationToken);
        var subject = pair.FirstOrDefault(p => p.Id == propertyId);
        var target = pair.FirstOrDefault(p => p.Id == targetPropertyId);
        if (subject is null || target is null)
            return (null, "العقار غير موجود");

        var members = await db.ListActiveMembersForPropertiesAsync(
            [propertyId, targetPropertyId],
            cancellationToken);
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
            db.AddGroup(group);
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
            db.AddMember(new PropertyGroupMember
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
            db.AddMember(new PropertyGroupMember
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

 // Confirmation is human audited (stage 1).
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

        var member = await db.GetActiveMemberForUpdateAsync(propertyId, cancellationToken);
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

    /// <summary>Latest inspection coordinates for each property in one query — instead of one query per property.</summary>
    private async Task<Dictionary<Guid, PropertyGroupRules.CandidateInput>> BuildCandidateInputsAsync(
        IReadOnlyCollection<WorkOrderProperty> props,
        CancellationToken cancellationToken)
    {
        var ids = props.Select(p => p.Id).ToList();
        var workspaces = await db.ListInspectionPointsAsync(ids, cancellationToken);
        var latestByProperty = workspaces
            .GroupBy(w => w.PropertyId)
            .ToDictionary(g => g.Key, g => g.First());

        var result = new Dictionary<Guid, PropertyGroupRules.CandidateInput>(props.Count);
        foreach (var prop in props)
        {
            latestByProperty.TryGetValue(prop.Id, out var workspace);
            result[prop.Id] = new PropertyGroupRules.CandidateInput(
                prop.OwnerName,
                prop.PlanNumber,
                prop.PlotNumber,
                workspace?.Latitude,
                workspace?.Longitude);
        }

        return result;
    }

    private async Task<PropertyGroupDto?> BuildGroupDtoAsync(
        Guid groupId,
        CancellationToken cancellationToken)
    {
        var group = await db.GetGroupAsync(groupId, cancellationToken);
        if (group is null) return null;

        var members = await db.ListActiveMembersAsync(groupId, cancellationToken);

        var propertyIds = members.Select(m => m.PropertyId).ToList();
        var props = (await db.ListPropertiesByIdsAsync(propertyIds, cancellationToken))
            .ToDictionary(p => p.Id);
        var poNumbers = await db.ListAllPoNumbersAsync(cancellationToken);

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
