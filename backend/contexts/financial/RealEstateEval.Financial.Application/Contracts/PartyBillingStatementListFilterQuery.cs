namespace RealEstateEval.Financial.Application.Contracts;

/// <summary>
/// The resolved, normalised filter <see cref="Abstractions.IPartyBillingStatementRepository"/>
/// applies to the statement list. Built by <c>PartyBillingStatementListQueryRules.ToFilter</c>.
/// </summary>
/// <param name="AssigneeId">Exact payee, or null for every payee.</param>
/// <param name="Statuses">
/// Persisted statuses to keep. <c>null</c> = no status filter; an empty list matches no row.
/// </param>
/// <param name="IssuedOrLaterOnly">Keep only issued / invoice-received / closed statements.</param>
/// <param name="Search">Trimmed free text, or null.</param>
public sealed record PartyBillingStatementListFilterQuery(
    string? AssigneeId,
    IReadOnlyList<string>? Statuses,
    bool IssuedOrLaterOnly,
    string? Search);
