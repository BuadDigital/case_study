using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFlatPricingAndIncentiveSuspensions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "FlatAmountSar",
                schema: "financial",
                table: "PartyFeePricingTables",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "ManagedBy",
                schema: "financial",
                table: "PartyFeePricingTables",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "system-admin");

            migrationBuilder.AddColumn<string>(
                name: "PricingKind",
                schema: "financial",
                table: "PartyFeePricingTables",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "party-rates");

            migrationBuilder.Sql(
                """
                UPDATE financial."PartyFeePricingTables"
                SET "PricingKind" = 'tiered',
                    "ManagedBy" = 'system-admin'
                WHERE "Category" = 'engineering-survey';

                UPDATE financial."PartyFeePricingTables"
                SET "PricingKind" = 'party-rates',
                    "ManagedBy" = 'system-admin'
                WHERE "Category" <> 'engineering-survey'
                  AND ("PricingKind" = '' OR "PricingKind" = 'party-rates');
                """);

            migrationBuilder.CreateTable(
                name: "IncentiveSuspensions",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    AssigneeId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    TransactionKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    PeriodFrom = table.Column<DateOnly>(type: "date", nullable: true),
                    PeriodTo = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LiftedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LiftedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IncentiveSuspensions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PartyFeePricingTables_PricingKind",
                schema: "financial",
                table: "PartyFeePricingTables",
                column: "PricingKind");

            migrationBuilder.CreateIndex(
                name: "IX_IncentiveSuspensions_ActiveAssigneeTransaction",
                schema: "financial",
                table: "IncentiveSuspensions",
                columns: new[] { "AssigneeId", "TransactionKey" },
                unique: true,
                filter: "\"LiftedAtUtc\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IncentiveSuspensions",
                schema: "financial");

            migrationBuilder.DropIndex(
                name: "IX_PartyFeePricingTables_PricingKind",
                schema: "financial",
                table: "PartyFeePricingTables");

            migrationBuilder.DropColumn(
                name: "FlatAmountSar",
                schema: "financial",
                table: "PartyFeePricingTables");

            migrationBuilder.DropColumn(
                name: "ManagedBy",
                schema: "financial",
                table: "PartyFeePricingTables");

            migrationBuilder.DropColumn(
                name: "PricingKind",
                schema: "financial",
                table: "PartyFeePricingTables");
        }
    }
}
