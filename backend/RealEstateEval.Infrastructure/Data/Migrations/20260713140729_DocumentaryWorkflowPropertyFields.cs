using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class DocumentaryWorkflowPropertyFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "TaskNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                newName: "RequestNumber");

            migrationBuilder.DropColumn(
                name: "SubdivisionRecordNumber",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "BuildLicenseNumber",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.AddColumn<string>(
                name: "AssignmentMandateDate",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AssignmentMandateNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LocationMapUrl",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlanNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlotNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AssignmentMandateDate",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "AssignmentMandateNumber",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "LocationMapUrl",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "PlanNumber",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "PlotNumber",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.RenameColumn(
                name: "RequestNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                newName: "TaskNumber");

            migrationBuilder.AddColumn<string>(
                name: "BuildLicenseNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubdivisionRecordNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);
        }
    }
}
