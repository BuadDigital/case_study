using Microsoft.Extensions.Logging;
using RealEstateEval.Identity.Application.Abstractions;

namespace RealEstateEval.Identity.Infrastructure.Sms;

/// <summary>
/// Development fallback when no SMS provider is configured: the message goes to the log so
/// the code can be read from the identity service output.
/// </summary>
public sealed class LoggingSmsSender(ILogger<LoggingSmsSender> logger) : ISmsSender
{
    public string Channel => SmsChannels.Dev;

    public Task<SmsSendResult> SendAsync(
        string mobileE164,
        string text,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation("[dev-sms] to {Mobile}: {Text}", mobileE164, text);
        return Task.FromResult(SmsSendResult.Ok());
    }
}
