using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AppraiserHandoverRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppraiserHandoverRequests",
                schema: "case_study",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    AppraisalTaskId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    RequestedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    RequestedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    RequestedByAssigneeId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    RequestedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    HandlerSubRole = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    HandingUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    EscalatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RemindedOn = table.Column<DateOnly>(type: "date", nullable: true),
                    TakenByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    TakenByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    TakenAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PeerAssigneeId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    PeerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Direction = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    ClosedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ClosedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ClosedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosingNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppraiserHandoverRequests", x => x.Id);
                    table.CheckConstraint("CK_AppraiserHandoverRequests_Kind", "\"Kind\" IS NULL OR \"Kind\" IN ('reassign', 'peer')");
                    table.CheckConstraint("CK_AppraiserHandoverRequests_Status", "\"Status\" IS NULL OR \"Status\" IN ('pending', 'taken', 'done', 'declined', 'cancelled')");
                    table.ForeignKey(
                        name: "FK_AppraiserHandoverRequests_WorkflowTasks_AppraisalTaskId",
                        column: x => x.AppraisalTaskId,
                        principalSchema: "case_study",
                        principalTable: "WorkflowTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AppraiserHandoverRequests_AppraisalTaskId",
                schema: "case_study",
                table: "AppraiserHandoverRequests",
                column: "AppraisalTaskId",
                unique: true,
                filter: "\"Status\" IN ('pending', 'taken')");

            migrationBuilder.CreateIndex(
                name: "IX_AppraiserHandoverRequests_Status",
                schema: "case_study",
                table: "AppraiserHandoverRequests",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AppraiserHandoverRequests",
                schema: "case_study");
        }
    }
}
