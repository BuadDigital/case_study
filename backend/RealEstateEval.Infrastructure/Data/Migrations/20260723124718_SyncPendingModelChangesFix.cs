using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <summary>
/// Creates engineering billing statement tables + ledger link.
/// Idempotent so databases that already applied the older hand-written
/// <c>20260723150000_AddEngineeringBillingStatements</c> can still advance.
/// </summary>
public partial class SyncPendingModelChangesFix : Migration
{
    /// <inheritdoc />
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

        migrationBuilder.Sql(
            """
            CREATE TABLE IF NOT EXISTS financial."EngineeringBillingStatements" (
                "Id" uuid NOT NULL,
                "ReferenceNumber" character varying(32) NOT NULL,
                "AssigneeId" character varying(128) NOT NULL,
                "Status" character varying(32) NOT NULL,
                "TotalNetSar" numeric(14,2) NOT NULL,
                "CreatedByUserId" character varying(450) NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "IssuedAtUtc" timestamp with time zone NULL,
                "IssuedByUserId" character varying(450) NULL,
                "ClosedAtUtc" timestamp with time zone NULL,
                "ClosedByUserId" character varying(450) NULL,
                "ExternalInvoiceNumber" character varying(128) NULL,
                "TransferReceiptAttachmentId" uuid NULL,
                "TransferReceiptRef" character varying(256) NULL,
                "PaidAtUtc" timestamp with time zone NULL,
                "Notes" character varying(2000) NULL,
                CONSTRAINT "PK_EngineeringBillingStatements" PRIMARY KEY ("Id")
            );
            """);

        migrationBuilder.Sql(
            """
            CREATE TABLE IF NOT EXISTS financial."EngineeringBillingStatementLines" (
                "Id" uuid NOT NULL,
                "StatementId" uuid NOT NULL,
                "WorkflowTaskId" uuid NOT NULL,
                "NetFeeSar" numeric(12,2) NOT NULL,
                CONSTRAINT "PK_EngineeringBillingStatementLines" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_EngineeringBillingStatementLines_EngineeringBillingStatements_StatementId"
                    FOREIGN KEY ("StatementId")
                    REFERENCES financial."EngineeringBillingStatements" ("Id")
                    ON DELETE CASCADE
            );
            """);

        migrationBuilder.Sql(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_EngineeringBillingStatements_ReferenceNumber"
            ON financial."EngineeringBillingStatements" ("ReferenceNumber");

            CREATE INDEX IF NOT EXISTS "IX_EngineeringBillingStatements_AssigneeId"
            ON financial."EngineeringBillingStatements" ("AssigneeId");

            CREATE INDEX IF NOT EXISTS "IX_EngineeringBillingStatements_Status"
            ON financial."EngineeringBillingStatements" ("Status");

            CREATE INDEX IF NOT EXISTS "IX_EngineeringBillingStatements_CreatedAtUtc"
            ON financial."EngineeringBillingStatements" ("CreatedAtUtc");

            CREATE INDEX IF NOT EXISTS "IX_EngineeringBillingStatementLines_StatementId"
            ON financial."EngineeringBillingStatementLines" ("StatementId");

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_EngineeringBillingStatementLines_WorkflowTaskId"
            ON financial."EngineeringBillingStatementLines" ("WorkflowTaskId");
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP TABLE IF EXISTS financial."EngineeringBillingStatementLines";
            DROP TABLE IF EXISTS financial."EngineeringBillingStatements";
            DROP INDEX IF EXISTS case_study."IX_InspectorFeeLedgers_EngineeringBillingStatementId";
            ALTER TABLE case_study."InspectorFeeLedgers"
            DROP COLUMN IF EXISTS "EngineeringBillingStatementId";
            """);
    }
}
