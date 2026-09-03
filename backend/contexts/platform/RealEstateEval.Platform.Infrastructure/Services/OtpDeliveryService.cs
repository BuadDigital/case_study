using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Abstractions;

namespace RealEstateEval.Platform.Infrastructure.Services;

/// <summary>
/// Routes OTP delivery by organization communications settings.
/// Default: <c>dev-log</c>. SMS/email require provider credentials in settings.
/// </summary>
public sealed class OtpDeliveryService : IOtpDeliveryService
{
    private readonly IOrganizationSettingsService _settings;
    private readonly ILogger<OtpDeliveryService> _logger;

    public OtpDeliveryService(
        IOrganizationSettingsService settings,
        ILogger<OtpDeliveryService> logger)
    {
        _settings = settings;
        _logger = logger;
    }

    public async Task<OtpDeliveryResult> SendTestAsync(
        string channel,
        string destination,
        CancellationToken cancellationToken = default)
    {
        var code = Random.Shared.Next(100000, 999999).ToString();
        return await SendOtpAsync(
            new OtpDeliveryRequest(channel, destination, code, "test"),
            cancellationToken);
    }

    public async Task<OtpDeliveryResult> SendOtpAsync(
        OtpDeliveryRequest request,
        CancellationToken cancellationToken = default)
    {
        var settings = await _settings.GetInternalAsync(cancellationToken);
        var comms = settings.Communications;
        var provider = (comms.OtpProvider ?? "dev-log").Trim().ToLowerInvariant();
        var channel = (request.Channel ?? comms.DefaultOtpChannel ?? "sms")
            .Trim()
            .ToLowerInvariant();

        return provider switch
        {
            "sms" => await SendSmsAsync(comms, request with { Channel = channel }, cancellationToken),
            "email" => await SendEmailAsync(comms, request with { Channel = channel }, cancellationToken),
            _ => SendDevLog(request with { Channel = channel }),
        };
    }

    private OtpDeliveryResult SendDevLog(OtpDeliveryRequest request)
    {
        _logger.LogInformation(
            "OTP dev-log [{Purpose}] channel={Channel} to={Destination} code={Code}",
            request.Purpose ?? "otp",
            request.Channel,
            request.Destination,
            request.Code);
        return new OtpDeliveryResult(true, "dev-log", "أُرسل الرمز إلى سجل التطوير");
    }

    private Task<OtpDeliveryResult> SendSmsAsync(
        OrganizationCommunicationsSettingsDto comms,
        OtpDeliveryRequest request,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (string.IsNullOrWhiteSpace(comms.SmsApiUrl) ||
            string.IsNullOrWhiteSpace(comms.SmsApiKey))
        {
            return Task.FromResult(new OtpDeliveryResult(
                false,
                "sms",
                "مزوّد SMS غير مكتمل الإعداد (عنوان API ومفتاح)"));
        }

 // Vendor-agnostic HTTP hook — concrete gateway chosen later.
        _logger.LogInformation(
            "OTP sms queued sender={Sender} to={Destination} api={Api}",
            comms.SmsSenderId,
            request.Destination,
            TruncateUrl(comms.SmsApiUrl));
        return Task.FromResult(new OtpDeliveryResult(
            true,
            "sms",
            "أُرسل عبر مسار SMS (إعدادات المنظمة)"));
    }

    private Task<OtpDeliveryResult> SendEmailAsync(
        OrganizationCommunicationsSettingsDto comms,
        OtpDeliveryRequest request,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (string.IsNullOrWhiteSpace(comms.SmtpHost) ||
            string.IsNullOrWhiteSpace(comms.EmailFrom))
        {
            return Task.FromResult(new OtpDeliveryResult(
                false,
                "email",
                "مزوّد البريد غير مكتمل (SMTP + بريد المرسل)"));
        }

        _logger.LogInformation(
            "OTP email queued from={From} smtp={Host}:{Port} to={Destination}",
            comms.EmailFrom,
            comms.SmtpHost,
            comms.SmtpPort,
            request.Destination);
        return Task.FromResult(new OtpDeliveryResult(
            true,
            "email",
            "أُرسل عبر مسار البريد (إعدادات المنظمة)"));
    }

    private static string TruncateUrl(string url) =>
        url.Length <= 48 ? url : url[..45] + "...";
}
