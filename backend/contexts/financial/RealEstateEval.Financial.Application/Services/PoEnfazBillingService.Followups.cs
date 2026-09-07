using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Rules;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// Follow-ups and finance flags on an Enfaz PO: the collection notes finance records against a
/// receivable, and the stopped / excluded / difficult marks on the tracking rows.
/// </summary>
public sealed partial class PoEnfazBillingService
{
    public async Task<IReadOnlyList<EnfazFollowupDto>> ListFollowupsAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (string.IsNullOrEmpty(po)) return [];

        var rows = await _db.ListFollowupsAsync(po, MaxFollowupRows, cancellationToken);

        return rows.Select(PoEnfazFollowupRules.ToFollowupDto).ToList();
    }

    public async Task<(EnfazFollowupDto? Followup, string? Error)> AddFollowupAsync(
        string poNumber,
        AddEnfazFollowupRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var notes = (request.Notes ?? "").Trim();
        var inputError = PoEnfazFollowupRules.ValidateFollowupInput(po, notes);
        if (inputError is not null)
            return (null, inputError);

        var entity = PoEnfazFollowupRules.BuildFollowup(po, notes, request, actorUserId, _time.UtcNow());
        _db.AddFollowup(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return (PoEnfazFollowupRules.ToFollowupDto(entity), null);
    }

    public async Task<(bool Ok, string? Error)> SetFinanceFlagAsync(
        string poNumber,
        SetEnfazFinanceFlagRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (string.IsNullOrEmpty(po))
            return (false, "رقم أمر العمل مطلوب.");

        var flag = PoEnfazFinanceFlagRules.NormalizeFlag(request.Flag);
        if (flag is null)
            return (false, "علامة غير معروفة. استخدم stopped أو excluded أو difficult.");

        var propertyId = PoEnfazFinanceFlagRules.ParsePropertyId(request.PropertyId);

        var existing = await _db.ListFinanceFlagsForPoAsync(po, cancellationToken);

        var match = PoEnfazFinanceFlagRules.MatchFlag(existing, propertyId);

        var now = _time.UtcNow();
        var note = PoEnfazFinanceFlagRules.NormalizeNote(request.Note);

        if (match is null)
            _db.AddFinanceFlag(PoEnfazFinanceFlagRules.NewFlag(po, propertyId, flag, note, actorUserId, now));
        else
            PoEnfazFinanceFlagRules.ApplyFlag(match, flag, note, actorUserId, now);

        await _db.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> ClearFinanceFlagAsync(
        string poNumber,
        string? propertyId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (string.IsNullOrEmpty(po))
            return (false, "رقم أمر العمل مطلوب.");

        var list = await _db.ListFinanceFlagsForPoAsync(po, cancellationToken);
        var toRemove = PoEnfazFinanceFlagRules.FlagsToClear(
            list,
            PoEnfazFinanceFlagRules.ParsePropertyId(propertyId));

        if (toRemove.Count == 0)
            return (true, null);

        _db.RemoveFinanceFlags(toRemove);
        await _db.SaveChangesAsync(cancellationToken);
        return (true, null);
    }
}
