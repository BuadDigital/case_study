using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations
{
    /// <inheritdoc />
    public partial class RequestDateAsDateAndSelectionUpdatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE valuation."ValuationRequests"
                    ALTER COLUMN "RequestDate" TYPE date
                    USING (CASE WHEN "RequestDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN "RequestDate"::date ELSE "UpdatedAtUtc"::date END);
                """);

            // Backfilled from the row's creation time where one exists, otherwise "now"; no column default stays behind.
            migrationBuilder.Sql(
                """
                ALTER TABLE valuation."ValuationComparableSelections" ADD COLUMN "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
                UPDATE valuation."ValuationComparableSelections" SET "UpdatedAtUtc" = "SelectedAtUtc";
                ALTER TABLE valuation."ValuationComparableSelections" ALTER COLUMN "UpdatedAtUtc" DROP DEFAULT;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "valuation",
                table: "ValuationComparableSelections");

            migrationBuilder.Sql(
                """
                ALTER TABLE valuation."ValuationRequests"
                    ALTER COLUMN "RequestDate" TYPE character varying(32) USING to_char("RequestDate", 'YYYY-MM-DD');
                """);
        }
    }
}
