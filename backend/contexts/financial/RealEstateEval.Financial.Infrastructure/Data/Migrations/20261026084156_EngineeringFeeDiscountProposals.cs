using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Financial.Infrastructure.Data.Contexts.Financial.Migrations
{
    /// <inheritdoc />
    public partial class EngineeringFeeDiscountProposals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_InspectorFeeLedgers_BillingStatus",
                schema: "financial",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropCheckConstraint(
                name: "CK_InspectorFeeLedgers_PreSuspensionStatus",
                schema: "financial",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropCheckConstraint(
                name: "CK_DiscountFlags_Status",
                schema: "financial",
                table: "DiscountFlags");

            migrationBuilder.DropColumn(
                name: "DisputeDeadlineUtc",
                schema: "financial",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropColumn(
                name: "DisputeNotifiedStages",
                schema: "financial",
                table: "InspectorFeeLedgers");

            migrationBuilder.RenameColumn(
                name: "ApprovedByUserId",
                schema: "financial",
                table: "DiscountFlags",
                newName: "ResolvedByUserId");

            migrationBuilder.AddColumn<string>(
                name: "FlaggedByName",
                schema: "financial",
                table: "DiscountFlags",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ResolvedDiscountSar",
                schema: "financial",
                table: "DiscountFlags",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            // The office approve/dispute loop is retired (ruling of 2026-10-26). A line still waiting
            // on the office, or disputed, becomes a pending proposal for the department supervisor to
            // decide: its discount moves onto the proposal and the line waits at full amount.
            // How: one flag per task (GROUP BY task, SUM of its lines' discounts — a multi-deed task
            // gets one proposal), then the lines move to sup-review with the discount cleared.
            // Edge cases: a line in those states with no discount has nothing to decide and goes
            // straight to at-finance; the flags are inserted before the update so they still read
            // the old discount; the new CHECK constraint is added only after no row uses the old
            // statuses. Dry-run on the dev database inside BEGIN … ROLLBACK before applying.
            migrationBuilder.Sql(
                """
                INSERT INTO financial."DiscountFlags"
                    ("Id", "TransactionKey", "WorkflowTaskId", "TargetAssigneeId", "FlaggedByUserId",
                     "FlaggedByName", "Reason", "ProposedDiscountSar", "Status", "CreatedAtUtc", "UpdatedAtUtc")
                SELECT gen_random_uuid(),
                       COALESCE(MAX(l."PoNumber"), ''),
                       l."WorkflowTaskId",
                       COALESCE(MAX(l."AssigneeId"), ''),
                       'system',
                       NULL,
                       COALESCE(NULLIF(MAX(l."DiscountReason"), ''), 'حسم سابق بانتظار قرار المشرف'),
                       SUM(l."SupervisorDiscountSar"),
                       'pending',
                       now(),
                       now()
                FROM financial."InspectorFeeLedgers" l
                WHERE l."BillingStatus" IN ('office-review', 'disputed')
                  AND l."SupervisorDiscountSar" > 0
                GROUP BY l."WorkflowTaskId";

                UPDATE financial."InspectorFeeLedgers"
                SET "BillingStatus" = CASE WHEN "SupervisorDiscountSar" > 0 THEN 'sup-review' ELSE 'at-finance' END,
                    "SupervisorDiscountSar" = 0,
                    "DiscountReason" = NULL,
                    "NetFeeSar" = "AgreedFeeSar"
                WHERE "BillingStatus" IN ('office-review', 'disputed');
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_InspectorFeeLedgers_BillingStatus",
                schema: "financial",
                table: "InspectorFeeLedgers",
                sql: "\"BillingStatus\" IS NULL OR \"BillingStatus\" IN ('draft', 'sup-review', 'at-finance', 'deferred', 'in-statement', 'disb-req', 'disbursed', 'returned', 'inquiry', 'suspended')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_InspectorFeeLedgers_PreSuspensionStatus",
                schema: "financial",
                table: "InspectorFeeLedgers",
                sql: "\"PreSuspensionStatus\" IS NULL OR \"PreSuspensionStatus\" IN ('draft', 'sup-review', 'at-finance', 'deferred', 'in-statement', 'disb-req', 'disbursed', 'returned', 'inquiry', 'suspended')");

            migrationBuilder.CreateIndex(
                name: "UX_DiscountFlags_PendingTask",
                schema: "financial",
                table: "DiscountFlags",
                column: "WorkflowTaskId",
                unique: true,
                filter: "\"Status\" = 'pending'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_DiscountFlags_Status",
                schema: "financial",
                table: "DiscountFlags",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('pending', 'approved', 'amended', 'waived')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_InspectorFeeLedgers_BillingStatus",
                schema: "financial",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropCheckConstraint(
                name: "CK_InspectorFeeLedgers_PreSuspensionStatus",
                schema: "financial",
                table: "InspectorFeeLedgers");

            migrationBuilder.DropIndex(
                name: "UX_DiscountFlags_PendingTask",
                schema: "financial",
                table: "DiscountFlags");

            migrationBuilder.DropCheckConstraint(
                name: "CK_DiscountFlags_Status",
                schema: "financial",
                table: "DiscountFlags");

            migrationBuilder.DropColumn(
                name: "FlaggedByName",
                schema: "financial",
                table: "DiscountFlags");

            migrationBuilder.DropColumn(
                name: "ResolvedDiscountSar",
                schema: "financial",
                table: "DiscountFlags");

            migrationBuilder.RenameColumn(
                name: "ResolvedByUserId",
                schema: "financial",
                table: "DiscountFlags",
                newName: "ApprovedByUserId");

            migrationBuilder.AddColumn<DateTime>(
                name: "DisputeDeadlineUtc",
                schema: "financial",
                table: "InspectorFeeLedgers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisputeNotifiedStages",
                schema: "financial",
                table: "InspectorFeeLedgers",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_InspectorFeeLedgers_BillingStatus",
                schema: "financial",
                table: "InspectorFeeLedgers",
                sql: "\"BillingStatus\" IS NULL OR \"BillingStatus\" IN ('draft', 'office-review', 'disputed', 'sup-review', 'at-finance', 'deferred', 'in-statement', 'disb-req', 'disbursed', 'returned', 'inquiry', 'suspended')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_InspectorFeeLedgers_PreSuspensionStatus",
                schema: "financial",
                table: "InspectorFeeLedgers",
                sql: "\"PreSuspensionStatus\" IS NULL OR \"PreSuspensionStatus\" IN ('draft', 'office-review', 'disputed', 'sup-review', 'at-finance', 'deferred', 'in-statement', 'disb-req', 'disbursed', 'returned', 'inquiry', 'suspended')");

            // Down: the old CHECK only knows pending / approved / rejected, so map the new decision
            // statuses onto the closest old ones before re-adding it. The status change of the
            // ledgers is not reversed — the old office states cannot be reconstructed faithfully.
            migrationBuilder.Sql(
                """
                UPDATE financial."DiscountFlags" SET "Status" = 'approved' WHERE "Status" = 'amended';
                UPDATE financial."DiscountFlags" SET "Status" = 'rejected' WHERE "Status" = 'waived';
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_DiscountFlags_Status",
                schema: "financial",
                table: "DiscountFlags",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('pending', 'approved', 'rejected')");
        }
    }
}
