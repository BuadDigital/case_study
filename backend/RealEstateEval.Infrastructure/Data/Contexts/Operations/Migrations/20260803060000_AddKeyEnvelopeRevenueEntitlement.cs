using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Operations.Migrations;

/// <summary>
/// Revenue entitlement timestamp on KeyEnvelopes. Introduced on the legacy stream as part of
/// <c>20260730120755_KeyReceiptRevenueOutOfPricing</c>; after Operations extraction the column
/// is owned here. Idempotent so databases that already applied the legacy dual-write stay safe.
/// </summary>
[DbContext(typeof(OperationsDbContext))]
[Migration("20260803060000_AddKeyEnvelopeRevenueEntitlement")]
public class AddKeyEnvelopeRevenueEntitlement : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE operations."KeyEnvelopes"
            ADD COLUMN IF NOT EXISTS "RevenueEntitlementAtUtc" timestamp with time zone;
            """);

        migrationBuilder.Sql(
            """
            CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopes_RevenueEntitlementAtUtc"
            ON operations."KeyEnvelopes" ("RevenueEntitlementAtUtc");
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP INDEX IF EXISTS operations."IX_KeyEnvelopes_RevenueEntitlementAtUtc";
            """);

        migrationBuilder.Sql(
            """
            ALTER TABLE operations."KeyEnvelopes"
            DROP COLUMN IF EXISTS "RevenueEntitlementAtUtc";
            """);
    }
}
