using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class WorkOrderPropertyReadyForUpload : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ReadyForUploadAtUtc",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReadyForUploadByUserId",
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
                name: "ReadyForUploadAtUtc",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "ReadyForUploadByUserId",
                schema: "case_study",
                table: "WorkOrderProperties");
        }
    }
}
