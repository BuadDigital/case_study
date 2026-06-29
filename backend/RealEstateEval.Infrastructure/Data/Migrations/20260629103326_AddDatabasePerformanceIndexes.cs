using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDatabasePerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_CreatedAtUtc",
                schema: "case_study",
                table: "WorkOrders",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderProperties_DeedNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                column: "DeedNumber");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowTasks_CreatedAtUtc",
                schema: "case_study",
                table: "WorkflowTasks",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowTasks_Kind_Status",
                schema: "case_study",
                table: "WorkflowTasks",
                columns: new[] { "Kind", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowTasks_PoNumber_PropertyId",
                schema: "case_study",
                table: "WorkflowTasks",
                columns: new[] { "PoNumber", "PropertyId" });

            migrationBuilder.CreateIndex(
                name: "IX_PropertyFailures_Status",
                schema: "failures",
                table: "PropertyFailures",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PropertyFailures_Status",
                schema: "failures",
                table: "PropertyFailures");

            migrationBuilder.DropIndex(
                name: "IX_WorkflowTasks_PoNumber_PropertyId",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropIndex(
                name: "IX_WorkflowTasks_Kind_Status",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropIndex(
                name: "IX_WorkflowTasks_CreatedAtUtc",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrderProperties_DeedNumber",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrders_CreatedAtUtc",
                schema: "case_study",
                table: "WorkOrders");
        }
    }
}
