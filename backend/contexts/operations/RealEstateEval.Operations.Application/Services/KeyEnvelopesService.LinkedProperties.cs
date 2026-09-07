using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Services;

public sealed partial class KeyEnvelopesService
{
    private async Task<IReadOnlyList<KeyEnvelopeDto>> MapManyAsync(
        IReadOnlyList<KeyEnvelope> rows,
        CancellationToken cancellationToken)
    {
        if (rows.Count == 0) return [];
        var requestNumbers = rows
            .Select(r => r.RequestNumber)
            .Where(r => r.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var linkedByRequest = await LoadLinkedByRequestNumbersAsync(
            requestNumbers,
            cancellationToken);
        return await _people.WithResolvedPeopleAsync(
            rows
                .Select(row => KeyEnvelopeMapper.ToDto(
                    row,
                    linkedByRequest.GetValueOrDefault(row.RequestNumber) ?? []))
                .ToList(),
            cancellationToken);
    }

    private async Task<IReadOnlyList<KeyEnvelopeLinkedPropertyDto>> LoadLinkedAsync(
        string requestNumber,
        CancellationToken cancellationToken)
    {
        var key = requestNumber.Trim();
        if (key.Length == 0) return [];
        var map = await LoadLinkedByRequestNumbersAsync([key], cancellationToken);
        return map.GetValueOrDefault(key) ?? [];
    }

    private async Task<Dictionary<string, IReadOnlyList<KeyEnvelopeLinkedPropertyDto>>>
        LoadLinkedByRequestNumbersAsync(
            IReadOnlyList<string> requestNumbers,
            CancellationToken cancellationToken)
    {
        if (requestNumbers.Count == 0)
            return new Dictionary<string, IReadOnlyList<KeyEnvelopeLinkedPropertyDto>>(
                StringComparer.Ordinal);

        var snapshots = await _caseStudy.ListPropertiesByRequestNumbersAsync(
            requestNumbers,
            cancellationToken);
        var rows = snapshots
            .Select(p => new KeyEnvelopeLinkedPropertyDto
            {
                PropertyId = p.Id,
                PoNumber = p.PoNumber,
                DeedNumber = p.DeedNumber,
                OwnerName = p.OwnerName,
                City = p.City,
                Court = p.Court,
                Circuit = p.Circuit,
                RequestNumber = p.RequestNumber,
            })
            .ToList();

        return rows
            .GroupBy(r => r.RequestNumber, StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<KeyEnvelopeLinkedPropertyDto>)g.ToList(),
                StringComparer.Ordinal);
    }
}
