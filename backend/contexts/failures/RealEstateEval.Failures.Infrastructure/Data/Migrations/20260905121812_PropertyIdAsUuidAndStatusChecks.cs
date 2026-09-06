using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Failures.Infrastructure.Data.Contexts.Failures.Migrations
{
    /// <inheritdoc />
    public partial class PropertyIdAsUuidAndStatusChecks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // PropertyId becomes the work-order property uuid. Every consumer already required a
            // Guid to act on a failure (timeline, task hold, property lookup), so a row whose key is
            // not one was never reachable from a property and is removed rather than cast.
            migrationBuilder.Sql(
                """
                DELETE FROM failures."PropertyFailures"
                WHERE "PropertyId" !~* '^\{?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\}?$';

                ALTER TABLE failures."PropertyFailures"
                    ALTER COLUMN "PropertyId" TYPE uuid USING "PropertyId"::uuid;
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_PropertyFailures_Severity",
                schema: "failures",
                table: "PropertyFailures",
                sql: "\"Severity\" IS NULL OR \"Severity\" IN ('suspected', 'internal')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PropertyFailures_Status",
                schema: "failures",
                table: "PropertyFailures",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('internal', 'review', 'approved', 'returned', 'suspended', 'resolved')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_PropertyFailures_Severity",
                schema: "failures",
                table: "PropertyFailures");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PropertyFailures_Status",
                schema: "failures",
                table: "PropertyFailures");

            migrationBuilder.Sql(
                """
                ALTER TABLE failures."PropertyFailures"
                    ALTER COLUMN "PropertyId" TYPE character varying(128) USING "PropertyId"::text;
                """);
        }
    }
}
