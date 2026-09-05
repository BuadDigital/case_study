using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// The list half of the party billing use case — the paged and filtered reads of
/// docs/architecture/pagination-contract.md §9. Statements are counted and cut in the database;
/// ready lines are synthesised first and the page is cut over that list.
/// </summary>
public partial class PartyBillingStatementService
{
    public async Task<IReadOnlyList<PartyBillingReadyLineDto>> ListReadyLinesAsync(
        PartyBillingReadyLineListQuery query,
        CancellationToken cancellationToken = default)
    {
        var lines = await SynthesiseReadyLinesAsync(query, cancellationToken);
        return lines.Take(MaxListRows).ToList();
    }

    public async Task<PagedResultDto<PartyBillingReadyLineDto>> ListReadyLinesPagedAsync(
        PartyBillingReadyLineListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default)
    {
        var lines = await SynthesiseReadyLinesAsync(query, cancellationToken);
        return MaterialisedListPage.Cut(lines, skip, take, page);
    }

    public async Task<IReadOnlyList<PartyBillingStatementDto>> ListStatementsAsync(
        PartyBillingStatementListQuery query,
        CancellationToken cancellationToken = default)
    {
        var statements = await _db.ListStatementsAsync(
            PartyBillingStatementListQueryRules.ToFilter(query),
            PartyBillingStatementListQueryRules.ResolveSort(query.Sort),
            PartyBillingStatementListQueryRules.ResolveDescending(query.Dir),
            skip: 0,
            take: MaxListRows,
            cancellationToken);

        return await MapStatementRowsAsync(statements, cancellationToken);
    }

    public async Task<PagedResultDto<PartyBillingStatementDto>> ListStatementsPagedAsync(
        PartyBillingStatementListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default)
    {
        var filter = PartyBillingStatementListQueryRules.ToFilter(query);
        var total = await _db.CountStatementsAsync(filter, cancellationToken);
        var statements = await _db.ListStatementsAsync(
            filter,
            PartyBillingStatementListQueryRules.ResolveSort(query.Sort),
            PartyBillingStatementListQueryRules.ResolveDescending(query.Dir),
            skip,
            take,
            cancellationToken);

        return new PagedResultDto<PartyBillingStatementDto>
        {
            Items = await MapStatementRowsAsync(statements, cancellationToken),
            TotalCount = total,
            Page = page,
            PageSize = take,
        };
    }

    /// <summary>
    /// The full ready-line set for the payee (the legacy synthesis), then the search and sort of
    /// the contract. Everything the page is cut from is in this list, so its length is the count.
    /// </summary>
    private async Task<List<PartyBillingReadyLineDto>> SynthesiseReadyLinesAsync(
        PartyBillingReadyLineListQuery query,
        CancellationToken cancellationToken)
    {
        var all = await ListReadyLinesAsync(
            PartyBillingReadyLineListQueryRules.NormalizeExact(query.AssigneeId),
            cancellationToken);
        return PartyBillingReadyLineListQueryRules.Apply(all, query);
    }

    private async Task<IReadOnlyList<PartyBillingStatementDto>> MapStatementRowsAsync(
        IReadOnlyList<PartyBillingStatement> statements,
        CancellationToken cancellationToken)
    {
        if (statements.Count == 0) return [];

        var lines = await _db.ListLinesForStatementsAsync(
            statements.Select(s => s.Id).ToList(),
            cancellationToken);

        return await MapStatementsAsync(statements, lines, cancellationToken);
    }
}
