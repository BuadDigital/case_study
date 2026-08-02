using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLedgerNetAndPaidAmounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Snapshot also reflects Platform/Identity columns mirrored on ApplicationDbContext;
            // those streams own OrganizationSettings / LastLoginAtUtc — do not create them here.

            migrationBuilder.AddColumn<decimal>(
                name: "NetFeeSar",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PaidAmountSar",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.Sql(
                """
                UPDATE case_study."InspectorFeeLedgers"
                SET "NetFeeSar" = GREATEST(0, "AgreedFeeSar" - GREATEST(0, "SupervisorDiscountSar")),
                    "PaidAmountSar" = CASE
                        WHEN "BillingStatus" = 'disbursed'
                        THEN GREATEST(0, "AgreedFeeSar" - GREATEST(0, "SupervisorDiscountSar"))
                        ELSE 0
                    END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NetFeeSar",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "PaidAmountSar",
                schema: "case_study",
                table: "InspectorFeeLedgers");
        }
    }
}
