using System.Collections.Concurrent;
using System.Threading.Channels;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Notifications;

public sealed class NotificationRealtimeHub : INotificationRealtimePublisher
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<Guid, Channel<UserNotificationDto>>> _connections =
        new(StringComparer.Ordinal);

    public (Guid ConnectionId, ChannelReader<UserNotificationDto> Reader) Subscribe(string userId)
    {
        var connectionId = Guid.NewGuid();
        var channel = Channel.CreateUnbounded<UserNotificationDto>(
            new UnboundedChannelOptions { SingleReader = true, SingleWriter = false });

        var userConnections = _connections.GetOrAdd(userId, _ => new ConcurrentDictionary<Guid, Channel<UserNotificationDto>>());
        userConnections[connectionId] = channel;
        return (connectionId, channel.Reader);
    }

    public void Unsubscribe(string userId, Guid connectionId)
    {
        if (!_connections.TryGetValue(userId, out var userConnections))
            return;

        if (userConnections.TryRemove(connectionId, out var channel))
            channel.Writer.TryComplete();

        if (userConnections.IsEmpty)
            _connections.TryRemove(userId, out _);
    }

    public void Publish(string userId, UserNotificationDto notification)
    {
        if (!_connections.TryGetValue(userId, out var userConnections))
            return;

        foreach (var (_, channel) in userConnections)
            channel.Writer.TryWrite(notification);
    }
}
