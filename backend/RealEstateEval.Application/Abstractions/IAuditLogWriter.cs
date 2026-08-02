using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Builds consistently serialized audit rows. The caller adds the returned row to its
/// own DbContext so the audit record commits atomically with the business change.
/// </summary>
public interface IAuditLogWriter
{
    AuditLog Create(
        string actorId,
        string action,
        string entityType,
        string entityId,
        object? before,
        object? after);

    AuditLog CreateFromChanges(
        string actorId,
        string action,
        string entityType,
        string entityId,
        IReadOnlyDictionary<string, AuditValueChange> changes);
}
