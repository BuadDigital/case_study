using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>Pushes notification DTOs to connected SSE clients for a user.</summary>
public interface INotificationRealtimePublisher
{
    void Publish(string userId, UserNotificationDto notification);
}
