using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Financial.Infrastructure.Data.Contexts.Financial.Migrations
{
    /// <inheritdoc />
    public partial class FinancialForeignKeysAndChecks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // D1 tables (inspector-fee ledgers, disbursement batches) are named in case_study on the
            // financial database and are shaped by raw SQL here, exactly like the standalone
            // baseline that created them. A ledger line pointing at a batch that no longer exists
            // is released to the unbatched pool before the link is enforced.
            migrationBuilder.Sql(
                """
                DROP INDEX IF EXISTS case_study."IX_InspectorFeeLedgers_ExcludedFromBatch";

                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD CONSTRAINT "CK_InspectorFeeLedgers_AgreedFeeSar_NonNegative"
                    CHECK ("AgreedFeeSar" IS NULL OR "AgreedFeeSar" >= 0);
                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD CONSTRAINT "CK_InspectorFeeLedgers_BillingStatus"
                    CHECK ("BillingStatus" IS NULL OR "BillingStatus" IN ('draft', 'office-review', 'disputed', 'sup-review', 'at-finance', 'deferred', 'in-statement', 'disb-req', 'disbursed', 'returned', 'inquiry', 'suspended'));
                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD CONSTRAINT "CK_InspectorFeeLedgers_NetFeeSar_NonNegative"
                    CHECK ("NetFeeSar" IS NULL OR "NetFeeSar" >= 0);
                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD CONSTRAINT "CK_InspectorFeeLedgers_PaidAmountSar_NonNegative"
                    CHECK ("PaidAmountSar" IS NULL OR "PaidAmountSar" >= 0);
                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD CONSTRAINT "CK_InspectorFeeLedgers_PreSuspensionStatus"
                    CHECK ("PreSuspensionStatus" IS NULL OR "PreSuspensionStatus" IN ('draft', 'office-review', 'disputed', 'sup-review', 'at-finance', 'deferred', 'in-statement', 'disb-req', 'disbursed', 'returned', 'inquiry', 'suspended'));
                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD CONSTRAINT "CK_InspectorFeeLedgers_SupervisorDiscountSar_NonNegative"
                    CHECK ("SupervisorDiscountSar" IS NULL OR "SupervisorDiscountSar" >= 0);
                ALTER TABLE case_study."DisbursementBatches"
                    ADD CONSTRAINT "CK_DisbursementBatches_TotalNetSar_NonNegative"
                    CHECK ("TotalNetSar" IS NULL OR "TotalNetSar" >= 0);

                UPDATE case_study."InspectorFeeLedgers" l
                SET "DisbursementBatchId" = NULL
                WHERE l."DisbursementBatchId" IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM case_study."DisbursementBatches" b WHERE b."Id" = l."DisbursementBatchId");

                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD CONSTRAINT "FK_InspectorFeeLedgers_DisbursementBatches_DisbursementBatchId"
                    FOREIGN KEY ("DisbursementBatchId") REFERENCES case_study."DisbursementBatches" ("Id") ON DELETE SET NULL;

                UPDATE financial."CourtVisitFeeCharges" c
                SET "PricingTableId" = NULL
                WHERE c."PricingTableId" IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM financial."PartyFeePricingTables" t WHERE t."Id" = c."PricingTableId");
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_PoEnfazRevenueLines_CaseStudyFeeSar_NonNegative",
                schema: "financial",
                table: "PoEnfazRevenueLines",
                sql: "\"CaseStudyFeeSar\" IS NULL OR \"CaseStudyFeeSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PoEnfazRevenueLines_KeyFeeSar_NonNegative",
                schema: "financial",
                table: "PoEnfazRevenueLines",
                sql: "\"KeyFeeSar\" IS NULL OR \"KeyFeeSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PoEnfazRevenueLines_SurveyFeeSar_NonNegative",
                schema: "financial",
                table: "PoEnfazRevenueLines",
                sql: "\"SurveyFeeSar\" IS NULL OR \"SurveyFeeSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PoEnfazInvoices_CollectedAmountSar_NonNegative",
                schema: "financial",
                table: "PoEnfazInvoices",
                sql: "\"CollectedAmountSar\" IS NULL OR \"CollectedAmountSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PoEnfazInvoices_Status",
                schema: "financial",
                table: "PoEnfazInvoices",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('issued', 'partially_collected', 'collected')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PoEnfazInvoices_SubtotalSar_NonNegative",
                schema: "financial",
                table: "PoEnfazInvoices",
                sql: "\"SubtotalSar\" IS NULL OR \"SubtotalSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PoEnfazInvoices_TotalSar_NonNegative",
                schema: "financial",
                table: "PoEnfazInvoices",
                sql: "\"TotalSar\" IS NULL OR \"TotalSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PoEnfazInvoices_VatSar_NonNegative",
                schema: "financial",
                table: "PoEnfazInvoices",
                sql: "\"VatSar\" IS NULL OR \"VatSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PartyFeePricingTiers_FeeSar_NonNegative",
                schema: "financial",
                table: "PartyFeePricingTiers",
                sql: "\"FeeSar\" IS NULL OR \"FeeSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PartyFeePricingTiers_MaxAreaM2_NonNegative",
                schema: "financial",
                table: "PartyFeePricingTiers",
                sql: "\"MaxAreaM2\" IS NULL OR \"MaxAreaM2\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PartyFeePricingTables_CourtVisitFeeSar_NonNegative",
                schema: "financial",
                table: "PartyFeePricingTables",
                sql: "\"CourtVisitFeeSar\" IS NULL OR \"CourtVisitFeeSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PartyFeePricingTables_FieldInspectorIndividualFeeSar_NonNeg~",
                schema: "financial",
                table: "PartyFeePricingTables",
                sql: "\"FieldInspectorIndividualFeeSar\" IS NULL OR \"FieldInspectorIndividualFeeSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PartyFeePricingTables_FieldInspectorOrganizationFeeSar_NonN~",
                schema: "financial",
                table: "PartyFeePricingTables",
                sql: "\"FieldInspectorOrganizationFeeSar\" IS NULL OR \"FieldInspectorOrganizationFeeSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PartyFeePricingTables_FlatAmountSar_NonNegative",
                schema: "financial",
                table: "PartyFeePricingTables",
                sql: "\"FlatAmountSar\" IS NULL OR \"FlatAmountSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PartyBillingStatements_Status",
                schema: "financial",
                table: "PartyBillingStatements",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('draft', 'issued', 'invoice_received', 'closed', 'cancelled')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PartyBillingStatements_TotalNetSar_NonNegative",
                schema: "financial",
                table: "PartyBillingStatements",
                sql: "\"TotalNetSar\" IS NULL OR \"TotalNetSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PartyBillingStatementLines_NetFeeSar_NonNegative",
                schema: "financial",
                table: "PartyBillingStatementLines",
                sql: "\"NetFeeSar\" IS NULL OR \"NetFeeSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_KeyReceiptFeeCharges_AmountSar_NonNegative",
                schema: "financial",
                table: "KeyReceiptFeeCharges",
                sql: "\"AmountSar\" IS NULL OR \"AmountSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_KeyReceiptFeeCharges_CollectionStatus",
                schema: "financial",
                table: "KeyReceiptFeeCharges",
                sql: "\"CollectionStatus\" IS NULL OR \"CollectionStatus\" IN ('open', 'collected')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_DiscountFlags_ProposedDiscountSar_NonNegative",
                schema: "financial",
                table: "DiscountFlags",
                sql: "\"ProposedDiscountSar\" IS NULL OR \"ProposedDiscountSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_DiscountFlags_Status",
                schema: "financial",
                table: "DiscountFlags",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('pending', 'approved', 'rejected')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_CourtVisitFeeCharges_AmountSar_NonNegative",
                schema: "financial",
                table: "CourtVisitFeeCharges",
                sql: "\"AmountSar\" IS NULL OR \"AmountSar\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_CourtVisitFeeCharges_Status",
                schema: "financial",
                table: "CourtVisitFeeCharges",
                sql: "\"Status\" IS NULL OR \"Status\" IN ('open', 'settled')");

            migrationBuilder.AddForeignKey(
                name: "FK_CourtVisitFeeCharges_PartyFeePricingTables_PricingTableId",
                schema: "financial",
                table: "CourtVisitFeeCharges",
                column: "PricingTableId",
                principalSchema: "financial",
                principalTable: "PartyFeePricingTables",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CourtVisitFeeCharges_PartyFeePricingTables_PricingTableId",
                schema: "financial",
                table: "CourtVisitFeeCharges");

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."InspectorFeeLedgers" DROP CONSTRAINT IF EXISTS "FK_InspectorFeeLedgers_DisbursementBatches_DisbursementBatchId";
                ALTER TABLE case_study."InspectorFeeLedgers" DROP CONSTRAINT IF EXISTS "CK_InspectorFeeLedgers_AgreedFeeSar_NonNegative";
                ALTER TABLE case_study."InspectorFeeLedgers" DROP CONSTRAINT IF EXISTS "CK_InspectorFeeLedgers_BillingStatus";
                ALTER TABLE case_study."InspectorFeeLedgers" DROP CONSTRAINT IF EXISTS "CK_InspectorFeeLedgers_NetFeeSar_NonNegative";
                ALTER TABLE case_study."InspectorFeeLedgers" DROP CONSTRAINT IF EXISTS "CK_InspectorFeeLedgers_PaidAmountSar_NonNegative";
                ALTER TABLE case_study."InspectorFeeLedgers" DROP CONSTRAINT IF EXISTS "CK_InspectorFeeLedgers_PreSuspensionStatus";
                ALTER TABLE case_study."InspectorFeeLedgers" DROP CONSTRAINT IF EXISTS "CK_InspectorFeeLedgers_SupervisorDiscountSar_NonNegative";
                ALTER TABLE case_study."DisbursementBatches" DROP CONSTRAINT IF EXISTS "CK_DisbursementBatches_TotalNetSar_NonNegative";
                CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_ExcludedFromBatch"
                    ON case_study."InspectorFeeLedgers" ("ExcludedFromBatch");
                """);

            migrationBuilder.DropCheckConstraint(
                name: "CK_PoEnfazRevenueLines_CaseStudyFeeSar_NonNegative",
                schema: "financial",
                table: "PoEnfazRevenueLines");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PoEnfazRevenueLines_KeyFeeSar_NonNegative",
                schema: "financial",
                table: "PoEnfazRevenueLines");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PoEnfazRevenueLines_SurveyFeeSar_NonNegative",
                schema: "financial",
                table: "PoEnfazRevenueLines");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PoEnfazInvoices_CollectedAmountSar_NonNegative",
                schema: "financial",
                table: "PoEnfazInvoices");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PoEnfazInvoices_Status",
                schema: "financial",
                table: "PoEnfazInvoices");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PoEnfazInvoices_SubtotalSar_NonNegative",
                schema: "financial",
                table: "PoEnfazInvoices");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PoEnfazInvoices_TotalSar_NonNegative",
                schema: "financial",
                table: "PoEnfazInvoices");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PoEnfazInvoices_VatSar_NonNegative",
                schema: "financial",
                table: "PoEnfazInvoices");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PartyFeePricingTiers_FeeSar_NonNegative",
                schema: "financial",
                table: "PartyFeePricingTiers");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PartyFeePricingTiers_MaxAreaM2_NonNegative",
                schema: "financial",
                table: "PartyFeePricingTiers");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PartyFeePricingTables_CourtVisitFeeSar_NonNegative",
                schema: "financial",
                table: "PartyFeePricingTables");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PartyFeePricingTables_FieldInspectorIndividualFeeSar_NonNeg~",
                schema: "financial",
                table: "PartyFeePricingTables");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PartyFeePricingTables_FieldInspectorOrganizationFeeSar_NonN~",
                schema: "financial",
                table: "PartyFeePricingTables");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PartyFeePricingTables_FlatAmountSar_NonNegative",
                schema: "financial",
                table: "PartyFeePricingTables");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PartyBillingStatements_Status",
                schema: "financial",
                table: "PartyBillingStatements");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PartyBillingStatements_TotalNetSar_NonNegative",
                schema: "financial",
                table: "PartyBillingStatements");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PartyBillingStatementLines_NetFeeSar_NonNegative",
                schema: "financial",
                table: "PartyBillingStatementLines");

            migrationBuilder.DropCheckConstraint(
                name: "CK_KeyReceiptFeeCharges_AmountSar_NonNegative",
                schema: "financial",
                table: "KeyReceiptFeeCharges");

            migrationBuilder.DropCheckConstraint(
                name: "CK_KeyReceiptFeeCharges_CollectionStatus",
                schema: "financial",
                table: "KeyReceiptFeeCharges");

            migrationBuilder.DropCheckConstraint(
                name: "CK_DiscountFlags_ProposedDiscountSar_NonNegative",
                schema: "financial",
                table: "DiscountFlags");

            migrationBuilder.DropCheckConstraint(
                name: "CK_DiscountFlags_Status",
                schema: "financial",
                table: "DiscountFlags");

            migrationBuilder.DropCheckConstraint(
                name: "CK_CourtVisitFeeCharges_AmountSar_NonNegative",
                schema: "financial",
                table: "CourtVisitFeeCharges");

            migrationBuilder.DropCheckConstraint(
                name: "CK_CourtVisitFeeCharges_Status",
                schema: "financial",
                table: "CourtVisitFeeCharges");

        }
    }
}
