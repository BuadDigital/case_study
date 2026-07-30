using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

public static class KeyEnvelopeMapper
{
    public static KeyEnvelopeDto ToDto(
        KeyEnvelope row,
        IReadOnlyList<KeyEnvelopeLinkedPropertyDto> linked) => new()
    {
        Id = row.Id,
        RequestNumber = row.RequestNumber,
        Court = row.Court,
        Circuit = row.Circuit,
        KeysCountLabeled = row.KeysCountLabeled,
        KeysCountActual = row.KeysCountActual,
        CountMismatch = row.KeysCountLabeled != row.KeysCountActual,
        ReceiptAttachmentId = row.ReceiptAttachmentId,
        PhotoAttachmentId = row.PhotoAttachmentId,
        ThirdPartyLetterAttachmentId = row.ThirdPartyLetterAttachmentId,
        ContactPhones = row.ContactPhones,
        Notes = row.Notes,
        ReceiveScenario = row.ReceiveScenario,
        Status = row.Status,
        FeeGenerated = row.FeeGenerated,
        FeeAmountSar = row.FeeAmountSar,
        RevenueEntitlementAtUtc = row.RevenueEntitlementAtUtc,
        CreatedByUserId = row.CreatedByUserId,
        CreatedByName = row.CreatedByName,
        CreatedAtUtc = row.CreatedAtUtc,
        UpdatedAtUtc = row.UpdatedAtUtc,
        OperationsTaskId = row.OperationsTaskId,
        Assignments = row.Assignments
            .OrderBy(a => a.DeedNumber)
            .Select(a => new KeyEnvelopeAssignmentDto
            {
                Id = a.Id,
                DeedNumber = a.DeedNumber,
                PropertyId = a.PropertyId,
                Status = a.Status,
                Notes = a.Notes,
                ConfirmedByName = a.ConfirmedByName,
                ConfirmedAtUtc = a.ConfirmedAtUtc,
            })
            .ToList(),
        Handoffs = row.Handoffs
            .OrderByDescending(h => h.CreatedAtUtc)
            .Select(h => new KeyEnvelopeHandoffDto
            {
                Id = h.Id,
                Kind = h.Kind,
                FromParty = h.FromParty,
                ToParty = h.ToParty,
                ToUserId = h.ToUserId,
                LetterNumber = h.LetterNumber,
                LetterAttachmentId = h.LetterAttachmentId,
                Notes = h.Notes,
                Status = h.Status,
                ConfirmedByName = h.ConfirmedByName,
                ConfirmedAtUtc = h.ConfirmedAtUtc,
                CreatedByName = h.CreatedByName,
                CreatedAtUtc = h.CreatedAtUtc,
            })
            .ToList(),
        Timeline = row.Timeline
            .OrderByDescending(t => t.CreatedAtUtc)
            .Select(t => new KeyEnvelopeTimelineEntryDto
            {
                Id = t.Id,
                EventType = t.EventType,
                Summary = t.Summary,
                ActorName = t.ActorName,
                CreatedAtUtc = t.CreatedAtUtc,
            })
            .ToList(),
        LinkedProperties = linked,
    };

    public static PropertyCourtAccessDto ToAccessDto(PropertyCourtAccess row) => new()
    {
        Id = row.Id,
        PropertyId = row.PropertyId,
        PoNumber = row.PoNumber,
        DeedNumber = row.DeedNumber,
        RequestNumber = row.RequestNumber,
        HasEnablingLetter = row.HasEnablingLetter,
        EnablingLetterAttachmentId = row.EnablingLetterAttachmentId,
        HasEvictionNotice = row.HasEvictionNotice,
        EvictionNoticeAttachmentId = row.EvictionNoticeAttachmentId,
        StudyHoldStatus = row.StudyHoldStatus,
        ContactPhones = row.ContactPhones,
        Notes = row.Notes,
        UpdatedByName = row.UpdatedByName,
        UpdatedAtUtc = row.UpdatedAtUtc,
    };
}
