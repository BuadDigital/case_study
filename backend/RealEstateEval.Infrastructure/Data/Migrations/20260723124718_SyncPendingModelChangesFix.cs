using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SyncPendingModelChangesFix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EngineeringBillingStatementId",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EngineeringBillingStatements",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReferenceNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AssigneeId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    TotalNetSar = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IssuedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IssuedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    ClosedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    ExternalInvoiceNumber = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    TransferReceiptAttachmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    TransferReceiptRef = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    PaidAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EngineeringBillingStatements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EngineeringBillingStatementLines",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StatementId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkflowTaskId = table.Column<Guid>(type: "uuid", nullable: false),
                    NetFeeSar = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EngineeringBillingStatementLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EngineeringBillingStatementLines_EngineeringBillingStatemen~",
                        column: x => x.StatementId,
                        principalSchema: "financial",
                        principalTable: "EngineeringBillingStatements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InspectorFeeLedgers_EngineeringBillingStatementId",
                schema: "case_study",
                table: "InspectorFeeLedgers",
                column: "EngineeringBillingStatementId");

            migrationBuilder.CreateIndex(
                name: "IX_EngineeringBillingStatementLines_StatementId",
                schema: "financial",
                table: "EngineeringBillingStatementLines",
                column: "StatementId");

            migrationBuilder.CreateIndex(
                name: "IX_EngineeringBillingStatementLines_WorkflowTaskId",
                schema: "financial",
                table: "EngineeringBillingStatementLines",
                column: "WorkflowTaskId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EngineeringBillingStatements_AssigneeId",
                schema: "financial",
                table: "EngineeringBillingStatements",
                column: "AssigneeId");

            migrationBuilder.CreateIndex(
                name: "IX_EngineeringBillingStatements_CreatedAtUtc",
                schema: "financial",
                table: "EngineeringBillingStatements",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_EngineeringBillingStatements_ReferenceNumber",
                schema: "financial",
                table: "EngineeringBillingStatements",
                column: "ReferenceNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EngineeringBillingStatements_Status",
                schema: "financial",
                table: "EngineeringBillingStatements",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EngineeringBillingStatementLines",
                schema: "financial");

            migrationBuilder.DropTable(
                name: "EngineeringBillingStatements",
                schema: "financial");

            migrationBuilder.DropIndex(
                name: "IX_InspectorFeeLedgers_EngineeringBillingStatementId",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "EngineeringBillingStatementId",
                schema: "case_study",
                table: "InspectorFeeLedgers");
        }
    }
}
