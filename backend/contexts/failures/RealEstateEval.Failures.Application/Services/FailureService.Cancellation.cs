using RealEstateEval.Application;
using RealEstateEval.Failures.Application.Rules;

namespace RealEstateEval.Failures.Application.Services;

/// <summary>«إلغاء المعاملة» seen from Failures: the cancelled deed's open failures are closed.</summary>
public partial class FailureService
{
    public const string CancelledTransactionResolutionReason = "أُلغيت المعاملة";
    public const string CancelledTransactionContinueInstructions = "لا متابعة — المعاملة ملغاة.";

    /// <summary>Resolves every open failure of a deed whose transaction was cancelled.</summary>
    /// <remarks>
    /// How it works: loads the deed's failures that are neither resolved nor approved (suspended ones
    /// included) and resolves each through the system path with the reason «أُلغيت المعاملة».
    /// Edge cases: a final (approved) failure is left as it is — the case-study side refuses to cancel
    /// such a transaction anyway; the case-study tasks are not unblocked here because the cancellation
    /// has already cancelled them; a malformed property id is ignored.
    /// </remarks>
    public async Task ResolveForCancelledTransactionAsync(
        string poNumber,
        string propertyId,
        string actor,
        CancellationToken cancellationToken = default)
    {
        if (!FailureRules.TryParsePropertyId(propertyId, out var propertyKey)) return;

        var open = await _failures.FindOpenForPropertyAsync(poNumber.Trim(), propertyKey, cancellationToken);
        if (open.Count == 0) return;

        var now = _time.UtcNow();
        var note = $"{CancelledTransactionResolutionReason} — {FailureRules.ActorOrSystem(actor)}";
        foreach (var failure in open)
        {
            failure.TrySystemResolve(
                CancelledTransactionResolutionReason,
                CancelledTransactionContinueInstructions,
                now,
                finalNoteIfEmpty: note);
        }

        await _failures.SaveChangesAsync(cancellationToken);
    }
}
