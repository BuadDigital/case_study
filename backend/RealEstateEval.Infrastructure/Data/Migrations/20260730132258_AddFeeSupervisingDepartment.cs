using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFeeSupervisingDepartment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SupervisingDepartment",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "case_study");

            migrationBuilder.Sql(
                """
                UPDATE case_study."InspectorFeeLedgers" AS ledger
                SET "SupervisingDepartment" = 'valuation'
                FROM case_study."WorkflowTasks" AS task
                WHERE task."Id" = ledger."WorkflowTaskId"
                  AND task."Kind" IN ('field-inspection', 'engineering-survey',
                                      'property-appraisal', 'valuation-coordination');

                ALTER TABLE case_study."InspectorFeeLedgers"
                ADD CONSTRAINT "CK_InspectorFeeLedgers_SupervisingDepartment"
                CHECK ("SupervisingDepartment" IN
                       ('case_study', 'valuation', 'finance_dept', 'external'));
                """);

            migrationBuilder.CreateIndex(
                name: "IX_InspectorFeeLedgers_SupervisingDepartment",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                column: "SupervisingDepartment");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InspectorFeeLedgers_SupervisingDepartment",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "SupervisingDepartment",
                schema: "case_study",
                table: "InspectorFeeLedgers");
        }
    }
}
