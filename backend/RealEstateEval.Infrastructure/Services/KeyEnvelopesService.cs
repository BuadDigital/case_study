using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Infrastructure.Services;

public sealed class KeyEnvelopesService : IKeyEnvelopesService
{
    private const int MaxListRows = 500;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly OperationsDbContext _ops;
    private readonly CaseStudyDbContext _caseStudy;
    private readonly FinancialDbContext _financial;
    private readonly AttachmentsDbContext _attachments;
    private readonly IPropertyAccessHoldService _holds;
    private readonly IKeyEnvelopePeopleResolver _people;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;

    public KeyEnvelopesService(
        OperationsDbContext ops,
        CaseStudyDbContext caseStudy,
        FinancialDbContext financial,
        AttachmentsDbContext attachments,
        IPropertyAccessHoldService holds,
        IKeyEnvelopePeopleResolver people,
        INotificationService notifications,
        NotificationRecipientResolver recipients)
    {
        _ops = ops;
        _caseStudy = caseStudy;
        _financial = financial;
        _attachments = attachments;
        _holds = holds;
        _people = people;
        _notifications = notifications;
        _recipients = recipients;
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
        var charges = await _financial.KeyReceiptFeeCharges.AsNoTracking()
            .OrderByDescending(c => c.CreatedAtUtc)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);

        var chargedEnvelopeIds = charges.Select(c => c.EnvelopeId).ToHashSet();

 // Entitlements and the historical stamped charges are one report, not an either/or: reading
 // only the charges hid every envelope registered since the amount left the pricing table, and
 // reading only the envelopes hid what finance had already collected.
        var entitlements = await _ops.KeyEnvelopes.AsNoTracking()
            .Where(x => x.RevenueEntitlementAtUtc != null || (x.FeeGenerated && x.FeeAmountSar != null))
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);

        var envelopes = entitlements.ToDictionary(e => e.Id);
        if (chargedEnvelopeIds.Except(envelopes.Keys).Any())
        {
            var missing = await _ops.KeyEnvelopes.AsNoTracking()
                .Where(e => chargedEnvelopeIds.Contains(e.Id) && !envelopes.Keys.Contains(e.Id))
                .ToListAsync(cancellationToken);
            foreach (var envelope in missing)
                envelopes[envelope.Id] = envelope;
        }

        var entitlementIds = entitlements.Select(e => e.Id).ToList();
        var enfazKeyLines = entitlementIds.Count == 0
            ? []
            : await _financial.PoEnfazRevenueLines.AsNoTracking()
                .Where(l => l.KeyEntitlementEnvelopeId != null
                    && entitlementIds.Contains(l.KeyEntitlementEnvelopeId.Value)
                    && l.KeyFeeSar > 0)
                .ToListAsync(cancellationToken);
        var enfazInvoiceByPo = enfazKeyLines.Count == 0
            ? new Dictionary<string, PoEnfazInvoice>(StringComparer.Ordinal)
            : await _financial.PoEnfazInvoices.AsNoTracking()
                .Where(i => enfazKeyLines.Select(l => l.PoNumber).Contains(i.PoNumber))
                .ToDictionaryAsync(i => i.PoNumber.Trim(), StringComparer.Ordinal, cancellationToken);
        var enfazByEnvelope = enfazKeyLines
            .Where(l => l.KeyEntitlementEnvelopeId.HasValue)
            .GroupBy(l => l.KeyEntitlementEnvelopeId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.UpdatedAtUtc).First());

        var rows = charges.Select(c =>
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

        rows.AddRange(entitlements
            .Where(e => !chargedEnvelopeIds.Contains(e.Id))
            .Select(e =>
            {
                enfazByEnvelope.TryGetValue(e.Id, out var line);
                PoEnfazInvoice? invoice = null;
                if (line is not null)
                    enfazInvoiceByPo.TryGetValue(line.PoNumber.Trim(), out invoice);
                var collectedViaEnfaz = invoice is not null
                    && invoice.Status == PoEnfazInvoiceStatus.Collected;
                return new KeyEnvelopeFeeReportRowDto
                {
                    EnvelopeId = e.Id,
                    RequestNumber = e.RequestNumber,
                    Court = e.Court,
                    Circuit = e.Circuit,
                    PhotoAttachmentId = e.PhotoAttachmentId,
                    ReceiptAttachmentId = e.ReceiptAttachmentId,
                    FeeAmountSar = line?.KeyFeeSar > 0 ? line.KeyFeeSar : e.FeeAmountSar,
                    CollectionStatus = collectedViaEnfaz
                        ? KeyReceiptFeeStatuses.Collected
                        : KeyReceiptFeeStatuses.Open,
                    InvoiceReference = collectedViaEnfaz
                        ? $"مُحصَّل عبر فاتورة إنفاذ {invoice!.InvoiceNumber}"
                        : invoice?.InvoiceNumber is string inv
                            ? $"فوترة إنفاذ {inv}"
                            : null,
                    CollectedAtUtc = collectedViaEnfaz ? invoice!.CollectedAtUtc : null,
                    CreatedByName = e.CreatedByName,
                    CreatedAtUtc = e.CreatedAtUtc,
                };
            }));

        return rows
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(MaxListRows)
            .ToList();
    }

    public async Task<bool> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var envelope = await _ops.KeyEnvelopes
            .Include(e => e.Assignments)
            .Include(e => e.Handoffs)
            .Include(e => e.Timeline)
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (envelope is null) return false;

 // The fee charge is intentionally independent of the envelope FK,
 // so remove it explicitly. Assignments, handoffs, and timeline entries
 // are deleted through the envelope cascade configuration.
        var charges = await _financial.KeyReceiptFeeCharges
            .Where(c => c.EnvelopeId == id)
            .ToListAsync(cancellationToken);
        if (charges.Count > 0)
            _financial.KeyReceiptFeeCharges.RemoveRange(charges);

        _ops.KeyEnvelopes.Remove(envelope);
        await _ops.SaveChangesAsync(cancellationToken);
        await _financial.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<(KeyEnvelopeFeeReportRowDto? Row, string? Error)> MarkFeeCollectedAsync(
        Guid envelopeId,
        string? invoiceReference,
        CancellationToken cancellationToken = default)
    {
        var charge = await _financial.KeyReceiptFeeCharges
            .FirstOrDefaultAsync(c => c.EnvelopeId == envelopeId, cancellationToken);
        if (charge is null)
        {
 // Only the historical stamped charges are collectable here. An entitlement carries no
 // amount, so there is nothing for finance to confirm until enforcement billing prices it.
            var isEntitlement = await _ops.KeyEnvelopes.AsNoTracking()
                .AnyAsync(e => e.Id == envelopeId && e.RevenueEntitlementAtUtc != null, cancellationToken);
            return (
                null,
                isEntitlement
                    ? "لا مبلغ مختوم لهذا الظرف — تحصيل أتعاب الاستلام يتم ضمن فوترة إنفاذ"
                    : "بند الأتعاب غير موجود لهذا الظرف");
        }

        var now = DateTime.UtcNow;
        charge.CollectionStatus = KeyReceiptFeeStatuses.Collected;
        charge.CollectedAtUtc = now;
        charge.UpdatedAtUtc = now;
        if (!string.IsNullOrWhiteSpace(invoiceReference))
            charge.InvoiceReference = invoiceReference.Trim();

        await _ops.SaveChangesAsync(cancellationToken);
        await _financial.SaveChangesAsync(cancellationToken);

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
        var entity = KeyEnvelope.Create(
            Guid.NewGuid(),
            requestNumber,
            court,
            circuit,
            request.KeysCountLabeled,
            request.KeysCountActual,
            scenario,
            actorUserId,
            actorDisplayName.Trim(),
            now,
            EmptyToNull(request.ReceiptAttachmentId),
            EmptyToNull(request.PhotoAttachmentId),
            EmptyToNull(request.ThirdPartyLetterAttachmentId),
            NullIfBlank(request.ContactPhones),
            NullIfBlank(request.Notes),
            operationsTaskId);

        foreach (var item in request.Assignments ?? [])
        {
            var deed = item.DeedNumber.Trim();
            if (deed.Length == 0) continue;
            entity.AddPendingAssignment(
                Guid.NewGuid(),
                deed,
                item.PropertyId,
                NullIfBlank(item.Notes),
                now);
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
 // Receipt revenue is billed to إنفاذ by finance, not owed to a party at a configured rate,
 // so registration marks the entitlement and stops there. Stamping an amount from the
 // pricing table produced a figure nobody had agreed to bill.
            entity.MarkCourtRevenueEntitlement(now);
            AddTimelineOnCreate(
                entity,
                KeyEnvelopeTimelineEvents.RevenueEntitlement,
                "استحقاق إيراد استلام المفاتيح — المبلغ تُدخله المالية عند فوترة إنفاذ",
                actorUserId,
                actorDisplayName,
                now);
        }

        _ops.KeyEnvelopes.Add(entity);
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
        entity.AddPendingAssignment(
            Guid.NewGuid(),
            deed,
            request.PropertyId,
            NullIfBlank(request.Notes),
            now);
        AddTimeline(
            entity.Id,
            KeyEnvelopeTimelineEvents.AssignmentAdded,
            $"إسناد مبدئي للصك {deed}",
            actorUserId,
            actorDisplayName,
            now);

        await SaveAndDetachAsync(cancellationToken);

        if (request.PropertyId is Guid assignedPropertyId)
        {
            await NotifyCaseSpecialistForPropertyAsync(
                assignedPropertyId,
                "إسناد مفتاح لعقارك",
                $"سُجّل إسناد مبدئي لمفتاح الصك {deed} — بانتظار التأكيد الميداني.",
                $"key-assignment-added:{envelopeId}:{deed}",
                cancellationToken);
        }

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
        entity.ConfirmAssignmentField(
            assignment,
            status,
            NullIfBlank(request.Notes),
            actorUserId,
            actorDisplayName.Trim(),
            now);
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
        else if (unmatchedPropertyId is Guid matchedPropertyId)
        {
            await NotifyCaseSpecialistForPropertyAsync(
                matchedPropertyId,
                "تأكيد مفتاح العقار",
                $"تم تأكيد مطابقة مفتاح الصك {deedNumber} ميدانياً.",
                $"key-assignment-confirmed:{envelopeId}:{deedNumber}",
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

        _ops.KeyEnvelopeHandoffs.Add(handoff);
        entity.Touch(now);
        AddTimeline(
            entity.Id,
            KeyEnvelopeTimelineEvents.HandoffCreated,
            KeyEnvelopeLifecycleRules.HandoffSummary(kind, fromParty, toParty),
            actorUserId,
            actorDisplayName,
            now);

        await SaveAndDetachAsync(cancellationToken);

        var toUserId = NullIfBlank(request.ToUserId);
        if (toUserId is not null)
        {
            await _notifications.CreateForUserAsync(
                toUserId,
                new CreateUserNotificationRequest
                {
                    Title = "تسليم ظرف مفاتيح",
                    Body = $"سُلّم إليك ظرف المفاتيح {entity.RequestNumber} من {fromParty}.",
                    Tone = "info",
                    Href = "/keys",
                    Category = "workflow",
                    EntityType = "property",
                    EntityId = entity.Id.ToString(),
                    SourceEvent = $"key-handoff-created:{handoff.Id}",
                },
                cancellationToken);
        }

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

        var handoff = await _ops.KeyEnvelopeHandoffs.FirstOrDefaultAsync(h => h.Id == handoffId && h.EnvelopeId == envelopeId, cancellationToken);
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
        entity.Touch(now);
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

        var createdByUserId = NullIfBlank(handoff.CreatedByUserId);
        if (createdByUserId is not null)
        {
            await _notifications.CreateForUserAsync(
                createdByUserId,
                new CreateUserNotificationRequest
                {
                    Title = "تأكيد استلام ظرف مفاتيح",
                    Body = $"أكّد {actorDisplayName.Trim()} استلام ظرف المفاتيح {entity.RequestNumber}.",
                    Tone = "success",
                    Href = "/keys",
                    Category = "workflow",
                    EntityType = "property",
                    EntityId = entity.Id.ToString(),
                    SourceEvent = $"key-handoff-confirmed:{handoff.Id}",
                },
                cancellationToken);
        }

        return (await GetAsync(envelopeId, cancellationToken), null);
    }

    public async Task<IReadOnlyList<PropertyCourtAccessDto>> ListCourtAccessAsync(
        string? requestNumber = null,
        CancellationToken cancellationToken = default)
    {
        var query = _ops.PropertyCourtAccesses.AsNoTracking().AsQueryable();
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
        var property = await _caseStudy.WorkOrderProperties
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
        var row = await _ops.PropertyCourtAccesses
            .FirstOrDefaultAsync(x => x.PropertyId == request.PropertyId, cancellationToken);

        if (row is null)
        {
            row = new PropertyCourtAccess
            {
                Id = Guid.NewGuid(),
                PropertyId = property.Id,
            };
            _ops.PropertyCourtAccesses.Add(row);
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

        var access = await _ops.PropertyCourtAccesses.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PropertyId == propertyId, cancellationToken);
        return (access is null ? null : KeyEnvelopeMapper.ToAccessDto(access), null);
    }

    private async Task SaveAndDetachAsync(CancellationToken cancellationToken)
    {
        await _ops.SaveChangesAsync(cancellationToken);
        await _financial.SaveChangesAsync(cancellationToken);
        _ops.ChangeTracker.Clear();
    }

    private IQueryable<KeyEnvelope> QueryEnvelopes() =>
        _ops.KeyEnvelopes.AsNoTracking()
            .Include(x => x.Assignments)
            .Include(x => x.Handoffs)
            .Include(x => x.Timeline);

    private async Task<KeyEnvelope?> LoadTrackedAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        await _ops.KeyEnvelopes
            .Include(x => x.Assignments)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    private async Task<KeyEnvelope?> LoadEnvelopeOnlyAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        await _ops.KeyEnvelopes.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    private void AddTimeline(
        Guid envelopeId,
        string eventType,
        string summary,
        string actorUserId,
        string actorDisplayName,
        DateTime at) =>
        _ops.KeyEnvelopeTimelineEntries.Add(new KeyEnvelopeTimelineEntry
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

        var rows = await _caseStudy.WorkOrderProperties.AsNoTracking()
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
        await _attachments.FileAttachments.AsNoTracking()
            .AnyAsync(a => a.Id == id, cancellationToken);

    private async Task<string?> ValidateCourtVisitTaskLinkAsync(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var task = await _ops.OperationsTasks.AsNoTracking()
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

    private static Guid? EmptyToNull(Guid? id) =>
        id is null || id == Guid.Empty ? null : id;

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

 /// <summary>
 /// Resolves the case specialist for a property's case-study parent task and
 /// notifies them — the specialist is the one waiting on the key to unblock
 /// field work, but had no visibility into key-envelope changes before this.
 /// </summary>
    private async Task NotifyCaseSpecialistForPropertyAsync(
        Guid propertyId,
        string title,
        string body,
        string sourceEvent,
        CancellationToken cancellationToken)
    {
        var specialistAssigneeId = await _caseStudy.WorkflowTasks.AsNoTracking()
            .Where(t => t.PropertyId == propertyId && t.Kind == WorkflowTaskKind.CaseStudyProperty)
            .Select(t => t.AssigneeId)
            .FirstOrDefaultAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(specialistAssigneeId)) return;

        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            specialistAssigneeId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = "info",
                Href = "/keys",
                Category = "workflow",
                EntityType = "property",
                EntityId = propertyId.ToString(),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }
}