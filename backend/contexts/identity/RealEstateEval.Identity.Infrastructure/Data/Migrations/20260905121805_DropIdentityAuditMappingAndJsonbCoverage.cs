using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Identity.Infrastructure.Data.Contexts.Identity.Migrations
{
    /// <inheritdoc />
    public partial class DropIdentityAuditMappingAndJsonbCoverage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The identity model no longer maps audit.AuditLogs: Identity appends audit rows through
            // the Platform-owned ledger, and its own database never held that table. Only the
            // reviewer city coverage column changes shape here; blanks become NULL.
            migrationBuilder.Sql(
                """
                ALTER TABLE identity."UserProfiles"
                    ALTER COLUMN "ReviewerCityCoverageJson" TYPE jsonb
                    USING NULLIF("ReviewerCityCoverageJson", '')::jsonb;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE identity."UserProfiles"
                    ALTER COLUMN "ReviewerCityCoverageJson" TYPE character varying(1024)
                    USING "ReviewerCityCoverageJson"::text;
                """);
        }
    }
}
