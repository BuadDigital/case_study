using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// Owner database capable of storing durable HTTP command reservations and responses.
/// </summary>
public interface ICommandIdempotencyDbContext
{
    DbSet<CommandIdempotencyRecord> CommandIdempotencyRecords { get; }
}
