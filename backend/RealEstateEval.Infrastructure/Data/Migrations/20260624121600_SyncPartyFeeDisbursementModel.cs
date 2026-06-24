using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SyncPartyFeeDisbursementModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD COLUMN IF NOT EXISTS "ReturnTo" character varying(32);

                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD COLUMN IF NOT EXISTS "DisbursementBatchId" uuid;

                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'case_study'
                          AND table_name = 'InspectorFeeLedgers'
                          AND column_name = 'InvoiceNumber'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'case_study'
                          AND table_name = 'InspectorFeeLedgers'
                          AND column_name = 'DisbursementVoucher'
                    ) THEN
                        ALTER TABLE case_study."InspectorFeeLedgers"
                            RENAME COLUMN "InvoiceNumber" TO "DisbursementVoucher";
                    END IF;
                END $$;

                ALTER TABLE case_study."InspectorFeeLedgers"
                    ADD COLUMN IF NOT EXISTS "DisbursementVoucher" character varying(128);

                CREATE TABLE IF NOT EXISTS case_study."DisbursementBatches"
                (
                    "Id" uuid NOT NULL,
                    "AssigneeId" character varying(128) NOT NULL,
                    "CreatedByUserId" character varying(450) NOT NULL,
                    "TotalNetSar" numeric(14,2) NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_DisbursementBatches" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS financial."PoEnfazRevenueLines"
                (
                    "Id" uuid NOT NULL,
                    "PoNumber" character varying(64) NOT NULL,
                    "PropertyId" uuid NOT NULL,
                    "EnfazFeeSar" numeric(12,2) NOT NULL,
                    "IncludedInBilling" boolean NOT NULL DEFAULT TRUE,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_PoEnfazRevenueLines" PRIMARY KEY ("Id")
                );

                CREATE INDEX IF NOT EXISTS "IX_InspectorFeeLedgers_DisbursementBatchId"
                    ON case_study."InspectorFeeLedgers" ("DisbursementBatchId");

                CREATE INDEX IF NOT EXISTS "IX_DisbursementBatches_AssigneeId"
                    ON case_study."DisbursementBatches" ("AssigneeId");

                CREATE INDEX IF NOT EXISTS "IX_DisbursementBatches_CreatedAtUtc"
                    ON case_study."DisbursementBatches" ("CreatedAtUtc");

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_PoEnfazRevenueLines_PoNumber_PropertyId"
                    ON financial."PoEnfazRevenueLines" ("PoNumber", "PropertyId");

                UPDATE case_study."InspectorFeeLedgers"
                SET "BillingStatus" = CASE "BillingStatus"
                    WHEN 'pre-billing' THEN 'draft'
                    WHEN 'ready-for-billing' THEN 'at-finance'
                    WHEN 'invoiced' THEN 'disb-req'
                    WHEN 'paid' THEN 'disbursed'
                    WHEN 'returned' THEN 'returned'
                    ELSE "BillingStatus"
                END
                WHERE "BillingStatus" IN (
                    'pre-billing', 'ready-for-billing', 'invoiced', 'paid', 'returned'
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE case_study."InspectorFeeLedgers"
                SET "BillingStatus" = CASE "BillingStatus"
                    WHEN 'draft' THEN 'pre-billing'
                    WHEN 'sup-review' THEN 'pre-billing'
                    WHEN 'at-finance' THEN 'ready-for-billing'
                    WHEN 'disb-req' THEN 'invoiced'
                    WHEN 'disbursed' THEN 'paid'
                    WHEN 'inquiry' THEN 'returned'
                    ELSE "BillingStatus"
                END;

                DROP TABLE IF EXISTS financial."PoEnfazRevenueLines";
                DROP TABLE IF EXISTS case_study."DisbursementBatches";

                ALTER TABLE case_study."InspectorFeeLedgers"
                    DROP COLUMN IF EXISTS "ReturnTo";

                ALTER TABLE case_study."InspectorFeeLedgers"
                    DROP COLUMN IF EXISTS "DisbursementBatchId";

                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'case_study'
                          AND table_name = 'InspectorFeeLedgers'
                          AND column_name = 'DisbursementVoucher'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'case_study'
                          AND table_name = 'InspectorFeeLedgers'
                          AND column_name = 'InvoiceNumber'
                    ) THEN
                        ALTER TABLE case_study."InspectorFeeLedgers"
                            RENAME COLUMN "DisbursementVoucher" TO "InvoiceNumber";
                    END IF;
                END $$;
                """);
        }
    }
}
