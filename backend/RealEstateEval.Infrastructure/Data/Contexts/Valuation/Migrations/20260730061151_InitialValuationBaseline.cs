using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Valuation.Migrations;

/// <summary>
/// Empty baseline. The <c>valuation</c> tables and the shared <c>messaging.OutboxMessages</c>
/// table already exist from the legacy stream; this migration only records that
/// <see cref="ValuationDbContext"/> owns the model going forward and seeds its per-schema
/// history table. It does not recreate the outbox.
/// </summary>
public partial class InitialValuationBaseline : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
