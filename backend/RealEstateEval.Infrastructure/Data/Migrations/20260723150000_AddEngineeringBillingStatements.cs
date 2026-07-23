using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>
/// Engineering-office monthly billing statements (stages 6–8) + ledger link + deferred/in-statement statuses.
/// </summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260723150000_AddEngineeringBillingStatements")]
public partial class AddEngineeringBillingStatements : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE case_study."InspectorFeeLedgers"
            ADD COLUMN IF NOT EXISTS "EngineeringBillingStatementId" uuid NULL;
            """);

        migrationBuilder.Sql(
            """
            CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_EngineeringBillingStatementId"
            ON case_study."InspectorFeeLedgers" ("EngineeringBillingStatementId");
            """);

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
                Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
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
                NetFeeSar = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_EngineeringBillingStatementLines", x => x.Id);
                table.ForeignKey(
                    name: "FK_EngineeringBillingStatementLines_EngineeringBillingStatements_StatementId",
                    column: x => x.StatementId,
                    principalSchema: "financial",
                    principalTable: "EngineeringBillingStatements",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_EngineeringBillingStatements_ReferenceNumber",
            schema: "financial",
            table: "EngineeringBillingStatements",
            column: "ReferenceNumber",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_EngineeringBillingStatements_AssigneeId",
            schema: "financial",
            table: "EngineeringBillingStatements",
            column: "AssigneeId");

        migrationBuilder.CreateIndex(
            name: "IX_EngineeringBillingStatements_Status",
            schema: "financial",
            table: "EngineeringBillingStatements",
            column: "Status");

        migrationBuilder.CreateIndex(
            name: "IX_EngineeringBillingStatements_CreatedAtUtc",
            schema: "financial",
            table: "EngineeringBillingStatements",
            column: "CreatedAtUtc");

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
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "EngineeringBillingStatementLines",
            schema: "financial");

        migrationBuilder.DropTable(
            name: "EngineeringBillingStatements",
            schema: "financial");

        migrationBuilder.Sql(
            """
            DROP INDEX IF EXISTS case_study."IX_InspectorFeeLedgers_EngineeringBillingStatementId";
            ALTER TABLE case_study."InspectorFeeLedgers"
            DROP COLUMN IF EXISTS "EngineeringBillingStatementId";
            """);
    }
}
