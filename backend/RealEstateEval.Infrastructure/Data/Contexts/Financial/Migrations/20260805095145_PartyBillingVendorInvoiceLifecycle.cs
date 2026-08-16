using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Financial.Migrations
{
 /// <summary>
 /// Vendor invoice lifecycle on party billing statements.
 /// Idempotent: columns may already exist if applied via an earlier ad-hoc path.
 /// </summary>
    public partial class PartyBillingVendorInvoiceLifecycle : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // PostgreSQL: add only when missing (hand-applied/dev DBs may already have columns).
            migrationBuilder.Sql(
                """
                ALTER TABLE financial."PartyBillingStatements"
                  ADD COLUMN IF NOT EXISTS "CancelReason" character varying(1000),
                  ADD COLUMN IF NOT EXISTS "CancelledAtUtc" timestamp with time zone,
                  ADD COLUMN IF NOT EXISTS "CancelledByUserId" character varying(450),
                  ADD COLUMN IF NOT EXISTS "DisbursementVoucher" character varying(128),
                  ADD COLUMN IF NOT EXISTS "PayeeType" character varying(32) NOT NULL DEFAULT 'vendor',
                  ADD COLUMN IF NOT EXISTS "RejectedInvoicesJson" jsonb,
                  ADD COLUMN IF NOT EXISTS "TaskKind" character varying(64),
                  ADD COLUMN IF NOT EXISTS "TransferReference" character varying(256),
                  ADD COLUMN IF NOT EXISTS "VendorInvoiceAttachmentId" uuid,
                  ADD COLUMN IF NOT EXISTS "VendorInvoiceDate" timestamp with time zone,
                  ADD COLUMN IF NOT EXISTS "VendorInvoiceMatchedAtUtc" timestamp with time zone,
                  ADD COLUMN IF NOT EXISTS "VendorInvoiceMatchedByUserId" character varying(450),
                  ADD COLUMN IF NOT EXISTS "VendorInvoiceNumber" character varying(128),
                  ADD COLUMN IF NOT EXISTS "VendorInvoiceSubmittedAtUtc" timestamp with time zone,
                  ADD COLUMN IF NOT EXISTS "VendorInvoiceSubmittedByUserId" character varying(450);

                UPDATE financial."PartyBillingStatements"
                SET "PayeeType" = 'vendor'
                WHERE "PayeeType" IS NULL OR "PayeeType" = '';

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_PartyBillingStatements_DisbursementVoucher"
                  ON financial."PartyBillingStatements" ("DisbursementVoucher")
                  WHERE "DisbursementVoucher" IS NOT NULL;
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP INDEX IF EXISTS financial."IX_PartyBillingStatements_DisbursementVoucher";
                ALTER TABLE financial."PartyBillingStatements"
                  DROP COLUMN IF EXISTS "CancelReason",
                  DROP COLUMN IF EXISTS "CancelledAtUtc",
                  DROP COLUMN IF EXISTS "CancelledByUserId",
                  DROP COLUMN IF EXISTS "DisbursementVoucher",
                  DROP COLUMN IF EXISTS "PayeeType",
                  DROP COLUMN IF EXISTS "RejectedInvoicesJson",
                  DROP COLUMN IF EXISTS "TaskKind",
                  DROP COLUMN IF EXISTS "TransferReference",
                  DROP COLUMN IF EXISTS "VendorInvoiceAttachmentId",
                  DROP COLUMN IF EXISTS "VendorInvoiceDate",
                  DROP COLUMN IF EXISTS "VendorInvoiceMatchedAtUtc",
                  DROP COLUMN IF EXISTS "VendorInvoiceMatchedByUserId",
                  DROP COLUMN IF EXISTS "VendorInvoiceNumber",
                  DROP COLUMN IF EXISTS "VendorInvoiceSubmittedAtUtc",
                  DROP COLUMN IF EXISTS "VendorInvoiceSubmittedByUserId";
                """);
        }
    }
}
