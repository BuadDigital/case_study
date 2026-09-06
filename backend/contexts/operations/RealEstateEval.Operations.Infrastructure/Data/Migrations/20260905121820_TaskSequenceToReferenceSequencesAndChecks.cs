using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts.Operations.Migrations
{
    /// <inheritdoc />
    public partial class TaskSequenceToReferenceSequencesAndChecks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // D2 tables are named in case_study on the operations database and are shaped by raw
            // SQL here, exactly like the standalone baseline that created them. The per-year task
            // counter moves into the operations ReferenceSequences table under prefix "T" so that
            // T-{year}-{seq} numbering continues from the last allocated value; CHECK constraints on
            // OperationsTasks follow the same route.
            migrationBuilder.Sql(
                """
                INSERT INTO operations."OperationsReferenceSequences"
                    ("Id", "Prefix", "Year", "LastValue", "UpdatedAtUtc")
                SELECT gen_random_uuid(), 'T', s."Year", GREATEST(s."NextSeq" - 1, 0), s."UpdatedAtUtc"
                FROM case_study."OperationsTaskSequences" s
                ON CONFLICT ("Prefix", "Year") DO UPDATE SET
                    "LastValue" = GREATEST(operations."OperationsReferenceSequences"."LastValue", EXCLUDED."LastValue"),
                    "UpdatedAtUtc" = GREATEST(operations."OperationsReferenceSequences"."UpdatedAtUtc", EXCLUDED."UpdatedAtUtc");

                DROP TABLE IF EXISTS case_study."OperationsTaskSequences";

                ALTER TABLE case_study."OperationsTasks"
                    ADD CONSTRAINT "CK_OperationsTasks_AgreedVisitFeeSar_NonNegative"
                    CHECK ("AgreedVisitFeeSar" IS NULL OR "AgreedVisitFeeSar" >= 0);
                ALTER TABLE case_study."OperationsTasks"
                    ADD CONSTRAINT "CK_OperationsTasks_PrevStatus"
                    CHECK ("PrevStatus" IS NULL OR "PrevStatus" IN ('created', 'in_progress', 'paused', 'completed', 'cancelled'));
                ALTER TABLE case_study."OperationsTasks"
                    ADD CONSTRAINT "CK_OperationsTasks_Status"
                    CHECK ("Status" IS NULL OR "Status" IN ('created', 'in_progress', 'paused', 'completed', 'cancelled'));
                """);

            migrationBuilder.DropIndex(
                name: "IX_KeyEnvelopes_FeeGenerated",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PropertyKeyRecords_WorkflowStatus",
                schema: "operations",
                table: "PropertyKeyRecords",
                sql: "\"WorkflowStatus\" IS NULL OR \"WorkflowStatus\" IN ('progress', 'done')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PropertyCourtAccesses_StudyHoldStatus",
                schema: "operations",
                table: "PropertyCourtAccesses",
                sql: "\"StudyHoldStatus\" IS NULL OR \"StudyHoldStatus\" IN ('none', 'enabled_no_key', 'suspended_eviction')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_KeyEnvelopes_FeeAmountSar_NonNegative",
                schema: "operations",
                table: "KeyEnvelopes",
                sql: "\"FeeAmountSar\" IS NULL OR \"FeeAmountSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_KeyEnvelopes_Status",
                schema: "operations",
                table: "KeyEnvelopes",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('reviewer', 'assessor', 'external', 'returned')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_KeyEnvelopeHandoffs_Status",
                schema: "operations",
                table: "KeyEnvelopeHandoffs",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('pending_confirm', 'confirmed', 'completed')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_KeyEnvelopeAssignments_Status",
                schema: "operations",
                table: "KeyEnvelopeAssignments",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('pending', 'matched', 'partial', 'unmatched', 'unmatched_inspected', 'missing')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_PropertyKeyRecords_WorkflowStatus",
                schema: "operations",
                table: "PropertyKeyRecords");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PropertyCourtAccesses_StudyHoldStatus",
                schema: "operations",
                table: "PropertyCourtAccesses");

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."OperationsTasks" DROP CONSTRAINT IF EXISTS "CK_OperationsTasks_AgreedVisitFeeSar_NonNegative";
                ALTER TABLE case_study."OperationsTasks" DROP CONSTRAINT IF EXISTS "CK_OperationsTasks_PrevStatus";
                ALTER TABLE case_study."OperationsTasks" DROP CONSTRAINT IF EXISTS "CK_OperationsTasks_Status";

                CREATE TABLE IF NOT EXISTS case_study."OperationsTaskSequences"
                (
                    "Id" uuid NOT NULL,
                    "Year" integer NOT NULL,
                    "NextSeq" integer NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_OperationsTaskSequences" PRIMARY KEY ("Id")
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_OperationsTaskSequences_Year"
                    ON case_study."OperationsTaskSequences" ("Year");

                INSERT INTO case_study."OperationsTaskSequences" ("Id", "Year", "NextSeq", "UpdatedAtUtc")
                SELECT gen_random_uuid(), r."Year", r."LastValue" + 1, r."UpdatedAtUtc"
                FROM operations."OperationsReferenceSequences" r
                WHERE r."Prefix" = 'T'
                ON CONFLICT ("Year") DO NOTHING;
                """);

            migrationBuilder.DropCheckConstraint(
                name: "CK_KeyEnvelopes_FeeAmountSar_NonNegative",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_KeyEnvelopes_Status",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_KeyEnvelopeHandoffs_Status",
                schema: "operations",
                table: "KeyEnvelopeHandoffs");

            migrationBuilder.DropCheckConstraint(
                name: "CK_KeyEnvelopeAssignments_Status",
                schema: "operations",
                table: "KeyEnvelopeAssignments");

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopes_FeeGenerated",
                schema: "operations",
                table: "KeyEnvelopes",
                column: "FeeGenerated");
        }
    }
}
