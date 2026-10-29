using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations
{
    /// <inheritdoc />
    public partial class TransactionCancellation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CancellationId",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAtUtc",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreCancelDeedStatus",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreCancelStatus",
                schema: "case_study",
                table: "WorkflowTasks",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TransactionCancellations",
                schema: "case_study",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Scope = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ScopeRef = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PoNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DeedIdsJson = table.Column<string>(type: "jsonb", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ReasonCode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    AttachmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequestedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    RequestedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    RequestedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DecidedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    DecidedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    DecidedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecisionNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ReactivatedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ReactivatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ReactivatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReactivationNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransactionCancellations", x => x.Id);
                    table.CheckConstraint("CK_TransactionCancellations_ReasonCode", "\"ReasonCode\" IS NULL OR \"ReasonCode\" IN ('duplicate', 'wrong_entry', 'other')");
                    table.CheckConstraint("CK_TransactionCancellations_Scope", "\"Scope\" IS NULL OR \"Scope\" IN ('transaction', 'work-order')");
                    table.CheckConstraint("CK_TransactionCancellations_Status", "\"Status\" IS NULL OR \"Status\" IN ('pending', 'approved', 'rejected', 'reactivated')");
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderProperties_CancellationId",
                schema: "case_study",
                table: "WorkOrderProperties",
                column: "CancellationId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderProperties_CancelledAtUtc",
                schema: "case_study",
                table: "WorkOrderProperties",
                column: "CancelledAtUtc");

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkflowTasks_PreCancelStatus",
                schema: "case_study",
                table: "WorkflowTasks",
                sql: "\"PreCancelStatus\" IS NULL OR \"PreCancelStatus\" IN ('open', 'completed', 'cancelled', 'blocked')");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionCancellations_PoNumber",
                schema: "case_study",
                table: "TransactionCancellations",
                column: "PoNumber");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionCancellations_Status",
                schema: "case_study",
                table: "TransactionCancellations",
                column: "Status");

            migrationBuilder.AddForeignKey(
                name: "FK_WorkOrderProperties_TransactionCancellations_CancellationId",
                schema: "case_study",
                table: "WorkOrderProperties",
                column: "CancellationId",
                principalSchema: "case_study",
                principalTable: "TransactionCancellations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkOrderProperties_TransactionCancellations_CancellationId",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropTable(
                name: "TransactionCancellations",
                schema: "case_study");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrderProperties_CancellationId",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrderProperties_CancelledAtUtc",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkflowTasks_PreCancelStatus",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropColumn(
                name: "CancellationId",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "CancelledAtUtc",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "PreCancelDeedStatus",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "PreCancelStatus",
                schema: "case_study",
                table: "WorkflowTasks");
        }
    }
}
