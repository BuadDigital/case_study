using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFieldInspectionWorkspaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FieldInspectionWorkspaces",
                schema: "case_study",
                columns: table => new
                {
                    WorkflowTaskId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartyTaskSubmissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    InspectionDate = table.Column<DateOnly>(type: "date", nullable: true),
                    InspectionTime = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    MapLatitude = table.Column<decimal>(type: "numeric(10,6)", precision: 10, scale: 6, nullable: true),
                    MapLongitude = table.Column<decimal>(type: "numeric(10,6)", precision: 10, scale: 6, nullable: true),
                    InspectionConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    RequiredPhotoSlots = table.Column<int>(type: "integer", nullable: false),
                    CompletedPhotoSlots = table.Column<int>(type: "integer", nullable: false),
                    PendingPhotoApprovals = table.Column<int>(type: "integer", nullable: false),
                    ObservationCount = table.Column<int>(type: "integer", nullable: false),
                    AttachmentCount = table.Column<int>(type: "integer", nullable: false),
                    SubmittedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FieldInspectionWorkspaces", x => x.WorkflowTaskId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FieldInspectionWorkspaces_PartyTaskSubmissionId",
                schema: "case_study",
                table: "FieldInspectionWorkspaces",
                column: "PartyTaskSubmissionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FieldInspectionWorkspaces_PoNumber",
                schema: "case_study",
                table: "FieldInspectionWorkspaces",
                column: "PoNumber");

            migrationBuilder.CreateIndex(
                name: "IX_FieldInspectionWorkspaces_PropertyId",
                schema: "case_study",
                table: "FieldInspectionWorkspaces",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_FieldInspectionWorkspaces_Status",
                schema: "case_study",
                table: "FieldInspectionWorkspaces",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FieldInspectionWorkspaces",
                schema: "case_study");
        }
    }
}
