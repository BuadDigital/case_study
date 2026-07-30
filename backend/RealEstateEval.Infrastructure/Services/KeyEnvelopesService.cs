using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class KeyEnvelopesService : IKeyEnvelopesService
{
    private const int MaxListRows = 500;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private const decimal DefaultKeyReceiptFeeSar = 350m;
    private readonly ApplicationDbContext _db;
    private readonly IPropertyAccessHoldService _holds;
    private readonly IKeyEnvelopePeopleResolver _people;

    public KeyEnvelopesService(
        ApplicationDbContext db,
        IPropertyAccessHoldService holds,
        IKeyEnvelopePeopleResolver people)
    {
        _db = db;
        _holds = holds;
        _people = people;
    }

    public async Task<IReadOnlyList<KeyEnvelopeDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await QueryEnvelopes()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);
        return await MapManyAsync(rows, cancellationToken);
    }

    public async Task<KeyEnvelopeDto?> GetAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await QueryEnvelopes()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return null;
        var linked = await LoadLinkedAsync(row.RequestNumber, cancellationToken);
        var dto = KeyEnvelopeMapper.ToDto(row, linked);
        return await _people.WithResolvedPeopleAsync(dto, cancellationToken);
    }

    public Task<IReadOnlyList<KeyEnvelopeLinkedPropertyDto>> ListLinkedPropertiesAsync(
        string requestNumber,
        CancellationToken cancellationToken = default)
        => LoadLinkedAsync(requestNumber.Trim(), cancellationToken);

    public async Task<IReadOnlyList<KeyEnvelopeFeeReportRowDto>> ListFeeReportAsync(
        CancellationToken cancellationToken = default)
    {
        var charges = await _db.KeyReceiptFeeCharges.AsNoTracking()
            .OrderByDescending(c => c.CreatedAtUtc)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);
        if (charges.Count == 0)
        {
            return await _db.KeyEnvelopes.AsNoTracking()
                .Where(x => x.FeeGenerated && x.FeeAmountSar != null)
                .OrderByDescending(x => x.CreatedAtUtc)
                .Select(x => new KeyEnvelopeFeeReportRowDto
                {
                    EnvelopeId = x.Id,
                    RequestNumber = x.RequestNumber,
                    Court = x.Court,
                    Circuit = x.Circuit,
                    PhotoAttachmentId = x.PhotoAttachmentId,
                    ReceiptAttachmentId = x.ReceiptAttachmentId,
                    FeeAmountSar = x.FeeAmountSar!.Value,
                    CollectionStatus = KeyReceiptFeeStatuses.Open,
                    CreatedByName = x.CreatedByName,
                    CreatedAtUtc = x.CreatedAtUtc,
                })
                .Take(MaxListRows)
                .ToListAsync(cancellationToken);
        }

        var envelopeIds = charges.Select(c => c.EnvelopeId).ToList();
        var envelopes = await _db.KeyEnvelopes.AsNoTracking()
            .Where(e => envelopeIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, cancellationToken);

        return charges.Select(c =>
        {
            envelopes.TryGetValue(c.EnvelopeId, out var env);
            return new KeyEnvelopeFeeReportRowDto
            {
                EnvelopeId = c.EnvelopeId,
                RequestNumber = c.RequestNumber,
                Court = env?.Court ?? "",
                Circuit = env?.Circuit ?? "",
                PhotoAttachmentId = c.PhotoAttachmentId ?? env?.PhotoAttachmentId,
                ReceiptAttachmentId = c.ReceiptAttachmentId ?? env?.ReceiptAttachmentId,
                FeeAmountSar = c.AmountSar,
                CollectionStatus = c.CollectionStatus,
                InvoiceReference = c.InvoiceReference,
                CollectedAtUtc = c.CollectedAtUtc,
                CreatedByName = c.CreatedByName,
                CreatedAtUtc = c.CreatedAtUtc,
            };
        }).ToList();
    }

    public async Task<bool> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var envelope = await _db.KeyEnvelopes
            .Include(e => e.Assignments)
            .Include(e => e.Handoffs)
            .Include(e => e.Timeline)
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (envelope is null) return false;

        // The fee charge is intentionally independent of the envelope FK,
        // so remove it explicitly. Assignments, handoffs, and timeline entries
        // are deleted through the envelope cascade configuration.
        var charges = await _db.KeyReceiptFeeCharges
            .Where(c => c.EnvelopeId == id)
            .ToListAsync(cancellationToken);
        if (charges.Count > 0)
            _db.KeyReceiptFeeCharges.RemoveRange(charges);

        _db.KeyEnvelopes.Remove(envelope);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<(KeyEnvelopeFeeReportRowDto? Row, string? Error)> MarkFeeCollectedAsync(
        Guid envelopeId,
        string? invoiceReference,
        CancellationToken cancellationToken = default)
    {
        var charge = await _db.KeyReceiptFeeCharges
            .FirstOrDefaultAsync(c => c.EnvelopeId == envelopeId, cancellationToken);
        if (charge is null)
            return (null, "بند الأتعاب غير موجود لهذا الظرف");

        var now = DateTime.UtcNow;
        charge.CollectionStatus = KeyReceiptFeeStatuses.Collected;
        charge.CollectedAtUtc = now;
        charge.UpdatedAtUtc = now;
        if (!string.IsNullOrWhiteSpace(invoiceReference))
            charge.InvoiceReference = invoiceReference.Trim();

        await _db.SaveChangesAsync(cancellationToken);

        var report = await ListFeeReportAsync(cancellationToken);
        var row = report.FirstOrDefault(r => r.EnvelopeId == envelopeId);
        return (row, null);
    }

    public async Task<(KeyEnvelopeDto? Envelope, string? Error)> CreateAsync(
        CreateKeyEnvelopeRequest request,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        actorDisplayName = await _people.ResolveActorDisplayNameAsync(
            actorUserId,
            actorDisplayName,
            cancellationToken);
        var requestNumber = request.RequestNumber.Trim();
        var court = request.Court.Trim();
        var circuit = request.Circuit.Trim();
        var scenario = KeyEnvelopeLifecycleRules.NormalizeScenario(request.ReceiveScenario);
        if (requestNumber.Length == 0) return (null, "رقم الطلب مطلوب");
        if (court.Length == 0) return (null, "المحكمة مطلوبة");
        if (circuit.Length == 0) return (null, "الدائرة مطلوبة");

        if (scenario == KeyReceiveScenarios.Court)
        {
            if (request.KeysCountActual < 1)
                return (null, "عدد المفاتيح الفعلي يجب أن يكون 1 على الأقل");
            if (request.PhotoAttachmentId is null || request.PhotoAttachmentId == Guid.Empty)
                return (null, "صورة الظرف مطلوبة");
            if (request.ReceiptAttachmentId is null || request.ReceiptAttachmentId == Guid.Empty)
                return (null, "خطاب الاستلام مطلوب");
        }
        else if (scenario == KeyReceiveScenarios.Missing)
        {
            if (string.IsNullOrWhiteSpace(request.ContactPhones))
                return (null, "أرقام التواصل مطلوبة عندما تكون المفاتيح غير موجودة");
        }
        else if (scenario == KeyReceiveScenarios.ThirdParty)
        {
            if (string.IsNullOrWhiteSpace(request.ContactPhones))
                return (null, "بيانات الطرف المسلِّم مطلوبة");
            if (request.ThirdPartyLetterAttachmentId is null
                || request.ThirdPartyLetterAttachmentId == Guid.Empty)
                return (null, "خطاب حامل المفتاح مطلوب");
        }

        if (request.ReceiptAttachmentId is { } rid && rid != Guid.Empty)
        {
            if (!await AttachmentExistsAsync(rid, cancellationToken))
                return (null, "ملف خطاب الاستلام غير موجود");
        }
        if (request.PhotoAttachmentId is { } pid && pid != Guid.Empty)
        {
            if (!await AttachmentExistsAsync(pid, cancellationToken))
                return (null, "ملف صورة الظرف غير موجود");
        }
        if (request.ThirdPartyLetterAttachmentId is { } tid && tid != Guid.Empty)
        {
            if (!await AttachmentExistsAsync(tid, cancellationToken))
                return (null, "ملف خطاب الطرف الثالث غير موجود");
        }

        Guid? operationsTaskId = null;
        if (request.OperationsTaskId is { } linkedTaskId && linkedTaskId != Guid.Empty)
        {
            var linkError = await ValidateCourtVisitTaskLinkAsync(linkedTaskId, cancellationToken);
            if (linkError is not null) return (null, linkError);
            operationsTaskId = linkedTaskId;
        }

        var now = DateTime.UtcNow;
        var entity = new KeyEnvelope
        {
            Id = Guid.NewGuid(),
            RequestNumber = requestNumber,
            Court = court,
            Circuit = circuit,
            KeysCountLabeled = Math.Max(0, request.KeysCountLabeled),
            KeysCountActual = Math.Max(0, request.KeysCountActual),
            ReceiptAttachmentId = EmptyToNull(request.ReceiptAttachmentId),
            PhotoAttachmentId = EmptyToNull(request.PhotoAttachmentId),
            ThirdPartyLetterAttachmentId = EmptyToNull(request.ThirdPartyLetterAttachmentId),
            ContactPhones = NullIfBlank(request.ContactPhones),
            Notes = NullIfBlank(request.Notes),
            ReceiveScenario = scenario,
            Status = KeyEnvelopeStatuses.Reviewer,
            CreatedByUserId = actorUserId,
            CreatedByName = actorDisplayName.Trim(),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            OperationsTaskId = operationsTaskId,
        };

        foreach (var item in request.Assignments ?? [])
        {
            var deed = item.DeedNumber.Trim();
            if (deed.Length == 0) continue;
            entity.Assignments.Add(new KeyEnvelopeAssignment
            {
                Id = Guid.NewGuid(),
                EnvelopeId = entity.Id,
                DeedNumber = deed,
                PropertyId = item.PropertyId,
                Status = KeyAssignmentStatuses.Pending,
                Notes = NullIfBlank(item.Notes),
            });
        }

        AddTimelineOnCreate(
            entity,
            KeyEnvelopeTimelineEvents.Created,
            KeyEnvelopeLifecycleRules.ScenarioCreatedSummary(scenario),
            actorUserId,
            actorDisplayName,
            now);

        if (scenario == KeyReceiveScenarios.Court)
        {
            var fee = await ResolveKeyReceiptFeeAsync(cancellationToken);
            entity.FeeGenerated = true;
            entity.FeeAmountSar = fee;
            AddTimelineOnCreate(
                entity,
                KeyEnvelopeTimelineEvents.FeeGenerated,
                $"توليد بند أتعاب استلام مفاتيح ({fee:0.##} ر.س)",
                actorUserId,
                actorDisplayName,
                now);
            _db.KeyReceiptFeeCharges.Add(new KeyReceiptFeeCharge
            {
                Id = Guid.NewGuid(),
                EnvelopeId = entity.Id,
                RequestNumber = requestNumber,
                AmountSar = fee,
                CollectionStatus = KeyReceiptFeeStatuses.Open,
                PhotoAttachmentId = entity.PhotoAttachmentId,
                ReceiptAttachmentId = entity.ReceiptAttachmentId,
                CreatedByUserId = actorUserId,
                CreatedByName = actorDisplayName.Trim(),
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        _db.KeyEnvelopes.Add(entity);
        await SaveAndDetachAsync(cancellationToken);
        return (await GetAsync(entity.Id, cancellationToken), null);
    }

    public async Task<(KeyEnvelopeDto? Envelope, string? Error)> AddAssignmentAsync(
        Guid envelopeId,
        AddKeyEnvelopeAssignmentRequest request,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        var entity = await LoadTrackedAsync(envelopeId, cancellationToken);
        if (entity is null) return (null, "الظرف غير موجود");

        var deed = request.DeedNumber.Trim();
        if (deed.Length == 0) return (null, "رقم الصك مطلوب");

        var exists = entity.Assignments.Any(a =>
            string.Equals(a.DeedNumber, deed, StringComparison.OrdinalIgnoreCase));
        if (exists) return (null, "الصك مُسند مسبقاً في هذا الظرف");

        var now = DateTime.UtcNow;
        entity.Assignments.Add(new KeyEnvelopeAssignment
        {
            Id = Guid.NewGuid(),
            EnvelopeId = entity.Id,
            DeedNumber = deed,
            PropertyId = request.PropertyId,
            Status = KeyAssignmentStatuses.Pending,
            Notes = NullIfBlank(request.Notes),
        });
        entity.UpdatedAtUtc = now;
        AddTimeline(
            entity.Id,
            KeyEnvelopeTimelineEvents.AssignmentAdded,
            $"إسناد مبدئي للصك {deed}",
            actorUserId,
            actorDisplayName,
            now);

        await SaveAndDetachAsync(cancellationToken);
        return (await GetAsync(envelopeId, cancellationToken), null);
    }

    public async Task<(KeyEnvelopeDto? Envelope, string? Error)> ConfirmAssignmentAsync(
        Guid envelopeId,
        Guid assignmentId,
        ConfirmKeyAssignmentRequest request,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        actorDisplayName = await _people.ResolveActorDisplayNameAsync(
            actorUserId,
            actorDisplayName,
            cancellationToken);
        var entity = await LoadTrackedAsync(envelopeId, cancellationToken);
        if (entity is null) return (null, "الظرف غير موجود");

        var assignment = entity.Assignments.FirstOrDefault(a => a.Id == assignmentId);
        if (assignment is null) return (null, "الإسناد غير موجود");

        var status = request.Status.Trim().ToLowerInvariant();
        if (!KeyAssignmentStatuses.IsConfirmResult(status))
            return (null, "حالة الإسناد غير صالحة — اختر نتيجة المطابقة الميدانية");

        var now = DateTime.UtcNow;
        var deedNumber = assignment.DeedNumber;
        var unmatchedPropertyId = assignment.PropertyId;
        assignment.Status = status;
        assignment.Notes = NullIfBlank(request.Notes) ?? assignment.Notes;
        assignment.ConfirmedByUserId = actorUserId;
        assignment.ConfirmedByName = actorDisplayName.Trim();
        assignment.ConfirmedAtUtc = now;
        entity.UpdatedAtUtc = now;
        AddTimeline(
            entity.Id,
            KeyEnvelopeTimelineEvents.AssignmentConfirmed,
            $"تأكيد ميداني للصك {deedNumber}: {KeyEnvelopeLifecycleRules.AssignmentResultTimelineLabel(status)}",
            actorUserId,
            actorDisplayName,
            now);

        await SaveAndDetachAsync(cancellationToken);

        if (KeyAssignmentStatuses.IsUnmatchedOutcome(status) && unmatchedPropertyId is Guid unmatchedPid)
        {
            await _holds.EnsureKeyUnmatchedFailureAsync(
                unmatchedPid,
                deedNumber,
                actorDisplayName,
                cancellationToken);
        }

        return (await GetAsync(envelopeId, cancellationToken), null);
    }

    public async Task<(KeyEnvelopeDto? Envelope, string? Error)> CreateHandoffAsync(
        Guid envelopeId,
        CreateKeyEnvelopeHandoffRequest request,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        actorDisplayName = await _people.ResolveActorDisplayNameAsync(
            actorUserId,
            actorDisplayName,
            cancellationToken);
        var entity = await LoadEnvelopeOnlyAsync(envelopeId, cancellationToken);
        if (entity is null) return (null, "الظرف غير موجود");

        var kind = request.Kind.Trim().ToLowerInvariant();
        if (kind is not (
            KeyHandoffKinds.Internal or
            KeyHandoffKinds.External or
            KeyHandoffKinds.ReceiveBack or
            KeyHandoffKinds.ReturnCourt))
            return (null, "نوع المناولة غير صالح");

        var fromParty = await _people.ResolvePartyLabelAsync(
            request.FromParty,
            actorUserId,
            cancellationToken);
        var toParty = await _people.ResolvePartyLabelAsync(
            request.ToParty,
            request.ToUserId,
            cancellationToken);
        if (fromParty.Length == 0 || toParty.Length == 0)
            return (null, "من وإلى مطلوبان");

        // HTML parity: internal / return_court / receive_back need no letter.
        // External delivery requires proof file (or explicit letter fields).
        var needsLetter = kind == KeyHandoffKinds.External;
        if (needsLetter)
        {
            if (request.LetterAttachmentId is null || request.LetterAttachmentId == Guid.Empty)
                return (null, "ملف إثبات التسليم مطلوب");
            if (!await AttachmentExistsAsync(request.LetterAttachmentId.Value, cancellationToken))
                return (null, "ملف إثبات التسليم غير موجود");
        }

        var now = DateTime.UtcNow;
        var handoff = new KeyEnvelopeHandoff
        {
            Id = Guid.NewGuid(),
            EnvelopeId = entity.Id,
            Kind = kind,
            FromParty = fromParty,
            ToParty = toParty,
            ToUserId = NullIfBlank(request.ToUserId),
            LetterNumber = NullIfBlank(request.LetterNumber),
            LetterAttachmentId = EmptyToNull(request.LetterAttachmentId),
            Notes = NullIfBlank(request.Notes),
            Status = kind == KeyHandoffKinds.Internal
                ? KeyHandoffStatuses.PendingConfirm
                : KeyHandoffStatuses.Completed,
            CreatedByUserId = actorUserId,
            CreatedByName = actorDisplayName.Trim(),
            CreatedAtUtc = now,
        };

        if (kind != KeyHandoffKinds.Internal)
        {
            KeyEnvelopeLifecycleRules.ApplyHandoffStatus(entity, kind);
            handoff.ConfirmedAtUtc = now;
        }

        _db.KeyEnvelopeHandoffs.Add(handoff);
        entity.UpdatedAtUtc = now;
        AddTimeline(
            entity.Id,
            KeyEnvelopeTimelineEvents.HandoffCreated,
            KeyEnvelopeLifecycleRules.HandoffSummary(kind, fromParty, toParty),
            actorUserId,
            actorDisplayName,
            now);

        await SaveAndDetachAsync(cancellationToken);
        return (await GetAsync(envelopeId, cancellationToken), null);
    }

    public async Task<(KeyEnvelopeDto? Envelope, string? Error)> ConfirmHandoffAsync(
        Guid envelopeId,
        Guid handoffId,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        actorDisplayName = await _people.ResolveActorDisplayNameAsync(
            actorUserId,
            actorDisplayName,
            cancellationToken);
        var entity = await LoadEnvelopeOnlyAsync(envelopeId, cancellationToken);
        if (entity is null) return (null, "الظرف غير موجود");

        var handoff = await _db.KeyEnvelopeHandoffs.FirstOrDefaultAsync(h => h.Id == handoffId && h.EnvelopeId == envelopeId, cancellationToken);
        if (handoff is null) return (null, "المناولة غير موجودة");
        if (handoff.Kind != KeyHandoffKinds.Internal)
            return (null, "التأكيد مطلوب للتسليم الداخلي فقط");
        if (handoff.Status != KeyHandoffStatuses.PendingConfirm)
            return (null, "المناولة مؤكدة مسبقاً");

        var now = DateTime.UtcNow;
        handoff.Status = KeyHandoffStatuses.Confirmed;
        handoff.ConfirmedByUserId = actorUserId;
        handoff.ConfirmedByName = actorDisplayName.Trim();
        handoff.ConfirmedAtUtc = now;
        KeyEnvelopeLifecycleRules.ApplyHandoffStatus(entity, handoff.Kind);
        entity.UpdatedAtUtc = now;
        AddTimeline(
            entity.Id,
            KeyEnvelopeTimelineEvents.HandoffConfirmed,
            $"تأكيد استلام الظرف من {handoff.ToParty}",
            actorUserId,
            actorDisplayName,
            now);
        AddTimeline(
            entity.Id,
            KeyEnvelopeTimelineEvents.StatusChanged,
            $"حالة الظرف → {entity.Status}",
            actorUserId,
            actorDisplayName,
            now);

        await SaveAndDetachAsync(cancellationToken);
        return (await GetAsync(envelopeId, cancellationToken), null);
    }

    public async Task<IReadOnlyList<PropertyCourtAccessDto>> ListCourtAccessAsync(
        string? requestNumber = null,
        CancellationToken cancellationToken = default)
    {
        var query = _db.PropertyCourtAccesses.AsNoTracking().AsQueryable();
        var key = requestNumber?.Trim();
        if (!string.IsNullOrEmpty(key))
            query = query.Where(x => x.RequestNumber == key);

        return await query
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Select(x => KeyEnvelopeMapper.ToAccessDto(x))
            .ToListAsync(cancellationToken);
    }

    public async Task<(PropertyCourtAccessDto? Access, string? Error)> UpsertCourtAccessAsync(
        UpsertPropertyCourtAccessRequest request,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        var property = await _db.WorkOrderProperties
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && !p.IsRemoved, cancellationToken);
        if (property is null) return (null, "العقار غير موجود");

        if (request.HasEnablingLetter)
        {
            if (request.EnablingLetterAttachmentId is null
                || request.EnablingLetterAttachmentId == Guid.Empty)
                return (null, "مرفق خطاب التمكين مطلوب");
            if (!await AttachmentExistsAsync(request.EnablingLetterAttachmentId.Value, cancellationToken))
                return (null, "ملف خطاب التمكين غير موجود");
        }

        if (request.HasEvictionNotice)
        {
            if (request.EvictionNoticeAttachmentId is null
                || request.EvictionNoticeAttachmentId == Guid.Empty)
                return (null, "مرفق محظر الإخلاء مطلوب");
            if (!await AttachmentExistsAsync(request.EvictionNoticeAttachmentId.Value, cancellationToken))
                return (null, "ملف محظر الإخلاء غير موجود");
        }

        var now = DateTime.UtcNow;
        var row = await _db.PropertyCourtAccesses
            .FirstOrDefaultAsync(x => x.PropertyId == request.PropertyId, cancellationToken);

        if (row is null)
        {
            row = new PropertyCourtAccess
            {
                Id = Guid.NewGuid(),
                PropertyId = property.Id,
            };
            _db.PropertyCourtAccesses.Add(row);
        }

        var previousHold = row.StudyHoldStatus;

        row.PoNumber = property.WorkOrder?.PoNumber ?? "";
        row.DeedNumber = property.DeedNumber;
        row.RequestNumber = property.RequestNumber ?? "";

        if (request.HasEnablingLetter)
        {
            row.HasEnablingLetter = true;
            row.EnablingLetterAttachmentId = request.EnablingLetterAttachmentId;
        }
        else
        {
            row.HasEnablingLetter = false;
            row.EnablingLetterAttachmentId = null;
        }

        if (request.HasEvictionNotice)
        {
            row.HasEvictionNotice = true;
            row.EvictionNoticeAttachmentId = request.EvictionNoticeAttachmentId;
        }
        else
        {
            row.HasEvictionNotice = false;
            row.EvictionNoticeAttachmentId = null;
        }

        if (row.HasEvictionNotice)
            row.StudyHoldStatus = PropertyCourtAccessStatuses.SuspendedEviction;
        else if (row.HasEnablingLetter)
            row.StudyHoldStatus = PropertyCourtAccessStatuses.EnabledNoKey;
        else
            row.StudyHoldStatus = PropertyCourtAccessStatuses.None;

        row.ContactPhones = NullIfBlank(request.ContactPhones);
        row.Notes = NullIfBlank(request.Notes);
        row.UpdatedByUserId = actorUserId;
        row.UpdatedByName = actorDisplayName.Trim();
        row.UpdatedAtUtc = now;

        var holdStatus = row.StudyHoldStatus;
        var propertyId = row.PropertyId;
        await SaveAndDetachAsync(cancellationToken);

        if (holdStatus == PropertyCourtAccessStatuses.SuspendedEviction)
        {
            await _holds.EnsureEvictionHoldAsync(
                propertyId,
                actorDisplayName,
                cancellationToken);
        }
        else if (previousHold == PropertyCourtAccessStatuses.SuspendedEviction)
        {
            await _holds.ResolveEvictionHoldAsync(
                propertyId,
                actorDisplayName,
                cancellationToken);
        }

        var access = await _db.PropertyCourtAccesses.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PropertyId == propertyId, cancellationToken);
        return (access is null ? null : KeyEnvelopeMapper.ToAccessDto(access), null);
    }

    private async Task SaveAndDetachAsync(CancellationToken cancellationToken)
    {
        await _db.SaveChangesAsync(cancellationToken);
        _db.ChangeTracker.Clear();
    }

    private IQueryable<KeyEnvelope> QueryEnvelopes() =>
        _db.KeyEnvelopes.AsNoTracking()
            .Include(x => x.Assignments)
            .Include(x => x.Handoffs)
            .Include(x => x.Timeline);

    private async Task<KeyEnvelope?> LoadTrackedAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        await _db.KeyEnvelopes
            .Include(x => x.Assignments)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    private async Task<KeyEnvelope?> LoadEnvelopeOnlyAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        await _db.KeyEnvelopes.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    private void AddTimeline(
        Guid envelopeId,
        string eventType,
        string summary,
        string actorUserId,
        string actorDisplayName,
        DateTime at) =>
        _db.KeyEnvelopeTimelineEntries.Add(new KeyEnvelopeTimelineEntry
        {
            Id = Guid.NewGuid(),
            EnvelopeId = envelopeId,
            EventType = eventType,
            Summary = summary,
            ActorUserId = actorUserId,
            ActorName = actorDisplayName.Trim(),
            CreatedAtUtc = at,
        });

    private static void AddTimelineOnCreate(
        KeyEnvelope entity,
        string eventType,
        string summary,
        string actorUserId,
        string actorDisplayName,
        DateTime at) =>
        entity.Timeline.Add(new KeyEnvelopeTimelineEntry
        {
            Id = Guid.NewGuid(),
            EnvelopeId = entity.Id,
            EventType = eventType,
            Summary = summary,
            ActorUserId = actorUserId,
            ActorName = actorDisplayName.Trim(),
            CreatedAtUtc = at,
        });

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

        var rows = await _db.WorkOrderProperties.AsNoTracking()
            .Include(p => p.WorkOrder)
            .Where(p =>
                !p.IsRemoved &&
                p.RequestNumber != null &&
                requestNumbers.Contains(p.RequestNumber))
            .OrderBy(p => p.WorkOrder!.PoNumber)
            .ThenBy(p => p.DeedNumber)
            .Select(p => new KeyEnvelopeLinkedPropertyDto
            {
                PropertyId = p.Id,
                PoNumber = p.WorkOrder != null ? p.WorkOrder.PoNumber : "",
                DeedNumber = p.DeedNumber,
                OwnerName = p.OwnerName ?? "",
                City = p.City,
                Court = p.Court ?? "",
                Circuit = p.Circuit ?? "",
                RequestNumber = p.RequestNumber ?? "",
            })
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(r => r.RequestNumber, StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<KeyEnvelopeLinkedPropertyDto>)g.ToList(),
                StringComparer.Ordinal);
    }

    private async Task<bool> AttachmentExistsAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        await _db.FileAttachments.AsNoTracking()
            .AnyAsync(a => a.Id == id, cancellationToken);

    private async Task<string?> ValidateCourtVisitTaskLinkAsync(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var task = await _db.OperationsTasks.AsNoTracking()
            .Where(t => t.Id == taskId)
            .Select(t => new { t.Type, t.Status, t.CourtVisitResultJson })
            .FirstOrDefaultAsync(cancellationToken);

        if (task is null)
            return "مهمة العمليات المرتبطة غير موجودة";
        if (task.Type != OperationsTaskType.CourtVisit)
            return "ربط الظرف مسموح فقط بمهمة زيارة محكمة";
        if (task.Status is not (OperationsTaskStatus.InProgress or OperationsTaskStatus.Completed))
            return "يجب أن تكون مهمة زيارة المحكمة قيد التنفيذ أو مكتملة لربط الظرف";

        if (task.Status == OperationsTaskStatus.Completed
            && !string.IsNullOrWhiteSpace(task.CourtVisitResultJson))
        {
            try
            {
                var result = JsonSerializer.Deserialize<OperationsTaskCourtVisitResultDto>(
                    task.CourtVisitResultJson,
                    JsonOpts);
                if (result is not null
                    && !string.IsNullOrWhiteSpace(result.Kind)
                    && result.Kind.Trim() != "received")
                {
                    return "تسجيل الظرف مرتبط بنتيجة «استُلم ظرف» فقط";
                }
            }
            catch
            {
                // Legacy / malformed JSON — allow link for completed court_visit.
            }
        }

        return null;
    }

    private async Task<decimal> ResolveKeyReceiptFeeAsync(CancellationToken cancellationToken)
    {
        // Key-receipt fee only — never create a visit fee here.
        // Visit fees are stamped on court_visit ops-task completion (CourtVisitFeeCharge).
        var pricing = await _db.PartyFeePricingTables.AsNoTracking()
            .Where(x => x.Category == PartyFeePricingCategories.GovernmentReview && x.IsActive)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (pricing is not null && pricing.KeyReceiptFeeSar > 0)
            return pricing.KeyReceiptFeeSar;
        // Legacy fallback when KeyReceiptFeeSar was never set independently.
        if (pricing is not null && pricing.GovernmentReviewFeeSar > 0)
            return pricing.GovernmentReviewFeeSar;
        return DefaultKeyReceiptFeeSar;
    }

    private static Guid? EmptyToNull(Guid? id) =>
        id is null || id == Guid.Empty ? null : id;

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

}
