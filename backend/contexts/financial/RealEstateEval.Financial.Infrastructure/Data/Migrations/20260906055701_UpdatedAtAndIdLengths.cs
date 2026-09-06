using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Financial.Infrastructure.Data.Contexts.Financial.Migrations
{
    /// <inheritdoc />
    public partial class UpdatedAtAndIdLengths : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "CreatedByUserId",
                schema: "financial",
                table: "PoEnfazFollowups",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450);

            migrationBuilder.AlterColumn<string>(
                name: "SetByUserId",
                schema: "financial",
                table: "PoEnfazFinanceFlags",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450);

            // Backfilled from the row's creation time where one exists, otherwise "now"; no column default stays behind.
            migrationBuilder.Sql(
                """
                ALTER TABLE financial."PoEnfazFinanceFlags" ADD COLUMN "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
                ALTER TABLE financial."PoEnfazFinanceFlags" ALTER COLUMN "UpdatedAtUtc" DROP DEFAULT;
                """);

            // Backfilled from the row's creation time where one exists, otherwise "now"; no column default stays behind.
            migrationBuilder.Sql(
                """
                ALTER TABLE financial."PartyFeePricingTiers" ADD COLUMN "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
                ALTER TABLE financial."PartyFeePricingTiers" ALTER COLUMN "UpdatedAtUtc" DROP DEFAULT;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "VendorInvoiceSubmittedByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "VendorInvoiceMatchedByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "IssuedByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CreatedByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450);

            migrationBuilder.AlterColumn<string>(
                name: "ClosedByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CancelledByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450,
                oldNullable: true);

            // Backfilled from the row's creation time where one exists, otherwise "now"; no column default stays behind.
            migrationBuilder.Sql(
                """
                ALTER TABLE financial."PartyBillingStatements" ADD COLUMN "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
                UPDATE financial."PartyBillingStatements" SET "UpdatedAtUtc" = "CreatedAtUtc";
                ALTER TABLE financial."PartyBillingStatements" ALTER COLUMN "UpdatedAtUtc" DROP DEFAULT;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "CreatedByUserId",
                schema: "financial",
                table: "KeyReceiptFeeCharges",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."InspectorFeeTransitions" ALTER COLUMN "ActorUserId" TYPE character varying(128);
                """);

            migrationBuilder.AlterColumn<string>(
                name: "UserId",
                schema: "financial",
                table: "IncentiveSuspensions",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450);

            migrationBuilder.AlterColumn<string>(
                name: "LiftedByUserId",
                schema: "financial",
                table: "IncentiveSuspensions",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CreatedByUserId",
                schema: "financial",
                table: "IncentiveSuspensions",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450);

            // Backfilled from the row's creation time where one exists, otherwise "now"; no column default stays behind.
            migrationBuilder.Sql(
                """
                ALTER TABLE financial."IncentiveSuspensions" ADD COLUMN "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
                UPDATE financial."IncentiveSuspensions" SET "UpdatedAtUtc" = "CreatedAtUtc";
                ALTER TABLE financial."IncentiveSuspensions" ALTER COLUMN "UpdatedAtUtc" DROP DEFAULT;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "FlaggedByUserId",
                schema: "financial",
                table: "DiscountFlags",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450);

            migrationBuilder.AlterColumn<string>(
                name: "ApprovedByUserId",
                schema: "financial",
                table: "DiscountFlags",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(450)",
                oldMaxLength: 450,
                oldNullable: true);

            // Backfilled from the row's creation time where one exists, otherwise "now"; no column default stays behind.
            migrationBuilder.Sql(
                """
                ALTER TABLE financial."DiscountFlags" ADD COLUMN "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
                UPDATE financial."DiscountFlags" SET "UpdatedAtUtc" = "CreatedAtUtc";
                ALTER TABLE financial."DiscountFlags" ALTER COLUMN "UpdatedAtUtc" DROP DEFAULT;
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."DisbursementBatches" ALTER COLUMN "CreatedByUserId" TYPE character varying(128);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "financial",
                table: "PoEnfazFinanceFlags");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "financial",
                table: "PartyFeePricingTiers");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "financial",
                table: "PartyBillingStatements");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "financial",
                table: "IncentiveSuspensions");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                schema: "financial",
                table: "DiscountFlags");

            migrationBuilder.AlterColumn<string>(
                name: "CreatedByUserId",
                schema: "financial",
                table: "PoEnfazFollowups",
                type: "character varying(450)",
                maxLength: 450,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128);

            migrationBuilder.AlterColumn<string>(
                name: "SetByUserId",
                schema: "financial",
                table: "PoEnfazFinanceFlags",
                type: "character varying(450)",
                maxLength: 450,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128);

            migrationBuilder.AlterColumn<string>(
                name: "VendorInvoiceSubmittedByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "VendorInvoiceMatchedByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "IssuedByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CreatedByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(450)",
                maxLength: 450,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128);

            migrationBuilder.AlterColumn<string>(
                name: "ClosedByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CancelledByUserId",
                schema: "financial",
                table: "PartyBillingStatements",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CreatedByUserId",
                schema: "financial",
                table: "KeyReceiptFeeCharges",
                type: "character varying(450)",
                maxLength: 450,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."InspectorFeeTransitions" ALTER COLUMN "ActorUserId" TYPE character varying(450);
                """);

            migrationBuilder.AlterColumn<string>(
                name: "UserId",
                schema: "financial",
                table: "IncentiveSuspensions",
                type: "character varying(450)",
                maxLength: 450,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128);

            migrationBuilder.AlterColumn<string>(
                name: "LiftedByUserId",
                schema: "financial",
                table: "IncentiveSuspensions",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CreatedByUserId",
                schema: "financial",
                table: "IncentiveSuspensions",
                type: "character varying(450)",
                maxLength: 450,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128);

            migrationBuilder.AlterColumn<string>(
                name: "FlaggedByUserId",
                schema: "financial",
                table: "DiscountFlags",
                type: "character varying(450)",
                maxLength: 450,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128);

            migrationBuilder.AlterColumn<string>(
                name: "ApprovedByUserId",
                schema: "financial",
                table: "DiscountFlags",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."DisbursementBatches" ALTER COLUMN "CreatedByUserId" TYPE character varying(450);
                """);
        }
    }
}
