using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations
{
    /// <inheritdoc />
    public partial class WorkOrderPropertyRowVersionAndWorkspaceIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FieldInspectionWorkspaces_Status",
                schema: "case_study",
                table: "FieldInspectionWorkspaces");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.CreateIndex(
                name: "IX_FieldInspectionWorkspaces_Status",
                schema: "case_study",
                table: "FieldInspectionWorkspaces",
                column: "Status");
        }
    }
}
