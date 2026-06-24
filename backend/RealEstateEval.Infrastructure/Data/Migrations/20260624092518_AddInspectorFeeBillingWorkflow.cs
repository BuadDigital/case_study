using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInspectorFeeBillingWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD COLUMN IF NOT EXISTS "ExcludedFromBatch" boolean NOT NULL DEFAULT FALSE;

                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD COLUMN IF NOT EXISTS "ExclusionReason" character varying(2000);

                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD COLUMN IF NOT EXISTS "InvoiceNumber" character varying(128);

                CREATE TABLE IF NOT EXISTS case_study."InspectorFeeTransitions"
                (
                    "Id" uuid NOT NULL,
                    "WorkflowTaskId" uuid NOT NULL,
                    "FromStatus" character varying(32) NOT NULL,
                    "ToStatus" character varying(32) NOT NULL,
                    "Reason" character varying(2000),
                    "ActorUserId" character varying(450) NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_InspectorFeeTransitions" PRIMARY KEY ("Id")
                );

                CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_ExcludedFromBatch"
                    ON case_study."InspectorFeeLedgers" ("ExcludedFromBatch");

                CREATE INDEX IF NOT EXISTS "IX_InspectorFeeTransitions_CreatedAtUtc"
                    ON case_study."InspectorFeeTransitions" ("CreatedAtUtc");

                CREATE INDEX IF NOT EXISTS "IX_InspectorFeeTransitions_WorkflowTaskId"
                    ON case_study."InspectorFeeTransitions" ("WorkflowTaskId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InspectorFeeTransitions",
                schema: "case_study");

            migrationBuilder.DropIndex(
                name: "IX_InspectorFeeLedgers_ExcludedFromBatch",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "ExcludedFromBatch",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "ExclusionReason",
                schema: "case_study",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                schema: "case_study",
                table: "InspectorFeeLedgers");
        }
    }
}
