using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Messaging.Migrations
{
    /// <inheritdoc />
    public partial class AddCommandIdempotencyExecutionLease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Container migration tests intentionally apply all dedicated streams to one
            // database; owner-local streams may already have created this per-producer table.
            migrationBuilder.Sql(
                """
                ALTER TABLE messaging."CommandIdempotencyRecords"
                    ADD COLUMN IF NOT EXISTS "ExecutionId" character varying(64) NULL;
                ALTER TABLE messaging."CommandIdempotencyRecords"
                    ADD COLUMN IF NOT EXISTS "Location" character varying(2048) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE messaging."CommandIdempotencyRecords"
                    DROP COLUMN IF EXISTS "ExecutionId";
                ALTER TABLE messaging."CommandIdempotencyRecords"
                    DROP COLUMN IF EXISTS "Location";
                """);
        }
    }
}
