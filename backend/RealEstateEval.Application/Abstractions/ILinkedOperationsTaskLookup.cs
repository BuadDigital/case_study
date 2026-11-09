namespace RealEstateEval.Application.Abstractions;

/// <summary>An operations task linked to a transaction's deeds whose outputs are not accepted yet.</summary>
public sealed record LinkedOperationsTaskFact(string Id, string DisplayId, string Title, string Status);

/// <summary>
/// The operations tasks that still hold a transaction (Omar 2026-11-08: «لو تم عمل مهمة على النظام مرتبطة
/// بالمعاملة أو الصك، لا يتم إرسالها للدراسة إلا إذا تمت العملية»). Case Study asks it before
/// «إرسال المعاملة للدراسة»; the Operations API answers over HTTP.
/// </summary>
public interface ILinkedOperationsTaskLookup
{
    /// <summary>
    /// The tasks on the work order <paramref name="poNumber"/> that name one of <paramref name="deedNumbers"/>
    /// (or no deed at all — the whole order) and are neither cancelled nor accepted by their creator.
    /// </summary>
    /// <remarks>Throws when the Operations API cannot be read — the caller refuses rather than guesses.</remarks>
    Task<IReadOnlyList<LinkedOperationsTaskFact>> ListOpenAsync(
        string poNumber,
        IReadOnlyCollection<string> deedNumbers,
        CancellationToken cancellationToken = default);
}
