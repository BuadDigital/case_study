using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class AddWorkflowTasksAndCaseStudyForms : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CaseStudyForms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TaskId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsPartyForm = table.Column<bool>(type: "boolean", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CurrentStep = table.Column<int>(type: "integer", nullable: false),
                    RequestNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    RequestDate = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    DeedNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    AnswersJson = table.Column<string>(type: "jsonb", nullable: false),
                    DeedRemarks = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    SurveyRemarks = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    ComponentsRemarks = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    OccupancyRemarks = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    MeterType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MeterNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    HoaFee = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SigDeed = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    SigApprover = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    SigDate = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SpecialistReviewApprovedJson = table.Column<string>(type: "jsonb", nullable: true),
                    SavedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CaseStudyForms", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowTasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                    PropertyOrdinal = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Phase = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AssigneeRole = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AssigneeName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    AssigneeId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ParentTaskId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    DistributionJson = table.Column<string>(type: "jsonb", nullable: true),
                    ObstructionReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ObstructionPriorPhase = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    AssignmentType = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowTasks", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CaseStudyForms_TaskId_IsPartyForm",
                table: "CaseStudyForms",
                columns: new[] { "TaskId", "IsPartyForm" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowTasks_ParentTaskId",
                table: "WorkflowTasks",
                column: "ParentTaskId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowTasks_PoNumber",
                table: "WorkflowTasks",
                column: "PoNumber");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowTasks_PoNumber_PropertyOrdinal",
                table: "WorkflowTasks",
                columns: new[] { "PoNumber", "PropertyOrdinal" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowTasks_PropertyId",
                table: "WorkflowTasks",
                column: "PropertyId");
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CaseStudyForms");

            migrationBuilder.DropTable(
                name: "WorkflowTasks");
        }
    }
}
