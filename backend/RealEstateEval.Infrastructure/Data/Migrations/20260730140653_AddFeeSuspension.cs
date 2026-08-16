using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class AddFeeSuspension : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PreSuspensionStatus",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SuspensionReason",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

 // The restore point and the reason only mean something while the line is withheld, and a
 // suspended line without them cannot be lifted back to where it came from.
            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."InspectorFeeLedgers"
                ADD CONSTRAINT "CK_InspectorFeeLedgers_Suspension"
                CHECK (
                    ("BillingStatus" = 'suspended'
                     AND "PreSuspensionStatus" IS NOT NULL
                     AND "SuspensionReason" IS NOT NULL)
                    OR ("BillingStatus" <> 'suspended'
                        AND "PreSuspensionStatus" IS NULL
                        AND "SuspensionReason" IS NULL));
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."InspectorFeeLedgers"
                DROP CONSTRAINT IF EXISTS "CK_InspectorFeeLedgers_Suspension";
                """);

            migrationBuilder.DropColumn(
                name: "PreSuspensionStatus",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "SuspensionReason",
                schema: "case_study",
                table: "InspectorFeeLedgers");
        }
    }
}
