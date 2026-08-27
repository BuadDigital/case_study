namespace RealEstateEval.Platform.Application.Abstractions;

public sealed record OtpDeliveryRequest(
    string Channel,
    string Destination,
    string Code,
    string? Purpose = null);

public sealed record OtpDeliveryResult(bool Ok, string Provider, string? Detail = null);

/// <summary>
/// Replaceable OTP / invitation delivery.
/// Implementations must not be called directly from UI — go through this interface.
/// </summary>
public interface IOtpDeliveryService
{
    Task<OtpDeliveryResult> SendOtpAsync(
        OtpDeliveryRequest request,
        CancellationToken cancellationToken = default);

    Task<OtpDeliveryResult> SendTestAsync(
        string channel,
        string destination,
        CancellationToken cancellationToken = default);
}
