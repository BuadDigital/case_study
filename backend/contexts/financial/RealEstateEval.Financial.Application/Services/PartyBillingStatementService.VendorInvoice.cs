using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Application.Rules;

namespace RealEstateEval.Financial.Application.Services;

public partial class PartyBillingStatementService
{
    public async Task<(PartyBillingStatementDto? Statement, string? Error)> SubmitVendorInvoiceAsync(
        Guid statementId,
        SubmitVendorInvoiceRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.FindStatementAsync(statementId, track: true, cancellationToken);
        if (statement is null)
            return (null, "مسير الصرف غير موجود.");
        if (statement.PayeeType != PartyBillingPayeeType.Vendor)
            return (null, "رفع الفاتورة للمورّدين فقط.");
        if (statement.Status != PartyBillingStatementStatus.Issued)
            return (null, "لا تُرفع فاتورة إلا على مسير أُرسل للمكتب.");

        var invoiceNo = (request.InvoiceNumber ?? "").Trim();
        if (invoiceNo.Length == 0)
            return (null, "رقم الفاتورة مطلوب.");
        if (!Guid.TryParse(request.AttachmentId, out var attachmentId))
            return (null, "مرفق PDF الفاتورة مطلوب.");

        var exists = await _attachments.ExistsAsync(attachmentId, cancellationToken);
        if (!exists)
            return (null, "مرفق الفاتورة غير موجود.");

        var now = _time.UtcNow();
        statement.Status = PartyBillingStatementStatus.InvoiceReceived;
        statement.VendorInvoiceNumber = invoiceNo;
        statement.VendorInvoiceDate = request.InvoiceDate?.ToUniversalTime() ?? now.Date;
        statement.VendorInvoiceAttachmentId = attachmentId;
        statement.VendorInvoiceSubmittedAtUtc = now;
        statement.VendorInvoiceSubmittedByUserId = actorUserId;
        statement.VendorInvoiceMatchedAtUtc = null;
        statement.VendorInvoiceMatchedByUserId = null;
        statement.ExternalInvoiceNumber = invoiceNo;

        await _db.SaveChangesAsync(cancellationToken);

        var supervisors = await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
            "financial-officer",
            cancellationToken);
        if (supervisors.Count == 0)
        {
            supervisors = await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
                "section-supervisor",
                cancellationToken);
        }
        if (supervisors.Count > 0)
        {
            await _notifications.CreateForUsersAsync(
                supervisors,
                new CreateUserNotificationRequest
                {
                    Title = "فاتورة مورّد واردة",
                    Body = $"{statement.ReferenceNumber} — فاتورة {invoiceNo} بمبلغ مقفل {statement.TotalNetSar:0.##} ر.س",
                    Category = "financial",
                    Tone = "info",
                    Href = $"/financial?area=costs&section=statements&statement={statement.Id}&party={Uri.EscapeDataString(statement.AssigneeId ?? "")}",
                },
                cancellationToken);
        }

        return (await GetStatementAsync(statementId, cancellationToken), null);
    }

    public async Task<(PartyBillingStatementDto? Statement, string? Error)> MatchVendorInvoiceAsync(
        Guid statementId,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.FindStatementAsync(statementId, track: true, cancellationToken);
        if (statement is null)
            return (null, "مسير الصرف غير موجود.");
        if (statement.PayeeType != PartyBillingPayeeType.Vendor)
            return (null, "المطابقة للمورّدين فقط.");
        if (statement.Status != PartyBillingStatementStatus.InvoiceReceived)
            return (null, "لا مطابقة إلا بعد ورود فاتورة.");
        if (string.IsNullOrWhiteSpace(statement.VendorInvoiceNumber)
            || statement.VendorInvoiceAttachmentId is null)
            return (null, "بيانات الفاتورة ناقصة.");

        statement.VendorInvoiceMatchedAtUtc = _time.UtcNow();
        statement.VendorInvoiceMatchedByUserId = actorUserId;
        await _db.SaveChangesAsync(cancellationToken);
        return (await GetStatementAsync(statementId, cancellationToken), null);
    }

    public async Task<(PartyBillingStatementDto? Statement, string? Error)> RejectVendorInvoiceAsync(
        Guid statementId,
        RejectVendorInvoiceRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.FindStatementAsync(statementId, track: true, cancellationToken);
        if (statement is null)
            return (null, "مسير الصرف غير موجود.");
        if (statement.PayeeType != PartyBillingPayeeType.Vendor)
            return (null, "إعادة الفاتورة للمورّدين فقط.");
        if (statement.Status != PartyBillingStatementStatus.InvoiceReceived)
            return (null, "لا إعادة إلا لفاتورة واردة.");

        var reason = (request.Reason ?? "").Trim();
        if (reason.Length < 3)
            return (null, "سبب الإعادة للتصحيح إلزامي.");

        var rejected = PartyBillingRowMapper.ParseRejected(statement.RejectedInvoicesJson);
        rejected.Add(new PartyBillingRejectedInvoiceDto
        {
            InvoiceNumber = statement.VendorInvoiceNumber ?? "",
            InvoiceDate = statement.VendorInvoiceDate,
            AttachmentId = statement.VendorInvoiceAttachmentId?.ToString(),
            Reason = reason,
            RejectedByUserId = actorUserId,
            RejectedAtUtc = _time.UtcNow(),
        });

        statement.RejectedInvoicesJson = PartyBillingRowMapper.SerializeRejected(rejected);
        statement.VendorInvoiceNumber = null;
        statement.VendorInvoiceDate = null;
        statement.VendorInvoiceAttachmentId = null;
        statement.VendorInvoiceSubmittedAtUtc = null;
        statement.VendorInvoiceSubmittedByUserId = null;
        statement.VendorInvoiceMatchedAtUtc = null;
        statement.VendorInvoiceMatchedByUserId = null;
        statement.ExternalInvoiceNumber = null;
        statement.Status = PartyBillingStatementStatus.Issued;

        await _db.SaveChangesAsync(cancellationToken);

        return (await GetStatementAsync(statementId, cancellationToken), null);
    }
}
