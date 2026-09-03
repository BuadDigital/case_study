using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Operations.Infrastructure.Services;

public sealed class KeyEnvelopeEntitlementLookup(OperationsDbContext ops) : IKeyEntitlementLookup
{
    public async Task<IReadOnlyList<KeyEnvelopeEntitlementDto>> ListByPropertyIdsAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken = default)
    {
        if (propertyIds.Count == 0)
            return [];

        var ids = propertyIds.Distinct().Take(200).ToList();
        var rows = await (
            from a in ops.KeyEnvelopeAssignments.AsNoTracking()
            join e in ops.KeyEnvelopes.AsNoTracking() on a.EnvelopeId equals e.Id
            where e.RevenueEntitlementAtUtc != null
                  && a.PropertyId != null
                  && ids.Contains(a.PropertyId.Value)
            orderby e.RevenueEntitlementAtUtc
            select new
            {
                EnvelopeId = e.Id,
                PropertyId = a.PropertyId!.Value,
                e.PhotoAttachmentId,
                e.ReceiptAttachmentId,
                e.ThirdPartyLetterAttachmentId,
            })
            .ToListAsync(cancellationToken);

        var list = new List<KeyEnvelopeEntitlementDto>();
        var seen = new HashSet<Guid>();
        foreach (var row in rows)
        {
            if (!seen.Add(row.PropertyId))
                continue;

            var attachments = new List<string>(3);
            if (row.PhotoAttachmentId is Guid photo)
                attachments.Add(photo.ToString());
            if (row.ReceiptAttachmentId is Guid receipt)
                attachments.Add(receipt.ToString());
            if (row.ThirdPartyLetterAttachmentId is Guid letter)
                attachments.Add(letter.ToString());

            list.Add(new KeyEnvelopeEntitlementDto
            {
                PropertyId = row.PropertyId,
                EnvelopeId = row.EnvelopeId,
                AttachmentIds = attachments,
            });
        }

        return list;
    }
}
