using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ValuationTwentySevenFixes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DepositCodeKey",
                schema: "valuation",
                table: "ValuationReportIssuances",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "valuation",
                table: "ValuationReportIssuances",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<string>(
                name: "ActualAgeRationale",
                schema: "valuation",
                table: "ValuationCostApproaches",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EconomicAgeRationale",
                schema: "valuation",
                table: "ValuationCostApproaches",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnershipInterestKey",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "freehold");

            migrationBuilder.AddColumn<decimal>(
                name: "RemainingLeaseYears",
                schema: "valuation",
                table: "ValuationApproachSettings",
                type: "numeric(6,2)",
                precision: 6,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ValuationIncomeApproaches",
                schema: "valuation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    GrossPotentialIncome = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    VacancyCollectionLossPct = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false),
                    OtherIncome = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OperatingExpensesMode = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false, defaultValue: "pct_of_egi"),
                    OperatingExpensesAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OperatingExpensesPct = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false),
                    CapitalisationRatePct = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: true),
                    CapRateRationale = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ValuationIncomeApproaches", x => x.Id);
                    table.CheckConstraint("CK_ValuationIncomeApproaches_GrossPotentialIncome_NonNegative", "\"GrossPotentialIncome\" IS NULL OR \"GrossPotentialIncome\" >= 0");
                    table.CheckConstraint("CK_ValuationIncomeApproaches_OperatingExpensesAmount_NonNegati~", "\"OperatingExpensesAmount\" IS NULL OR \"OperatingExpensesAmount\" >= 0");
                    table.CheckConstraint("CK_ValuationIncomeApproaches_OperatingExpensesMode", "\"OperatingExpensesMode\" IS NULL OR \"OperatingExpensesMode\" IN ('amount', 'pct_of_egi')");
                    table.CheckConstraint("CK_ValuationIncomeApproaches_OperatingExpensesPct_NonNegative", "\"OperatingExpensesPct\" IS NULL OR \"OperatingExpensesPct\" >= 0");
                    table.CheckConstraint("CK_ValuationIncomeApproaches_OtherIncome_NonNegative", "\"OtherIncome\" IS NULL OR \"OtherIncome\" >= 0");
                    table.CheckConstraint("CK_ValuationIncomeApproaches_VacancyCollectionLossPct_NonNegat~", "\"VacancyCollectionLossPct\" IS NULL OR \"VacancyCollectionLossPct\" >= 0");
                    table.ForeignKey(
                        name: "FK_ValuationIncomeApproaches_ValuationRequests_ValuationReques~",
                        column: x => x.ValuationRequestId,
                        principalSchema: "valuation",
                        principalTable: "ValuationRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // D15 backfill (same rule as ValuationReportIssuance.NormalizeDepositCode / DepositCodeKeyOf):
            // codes stored with Latin digits and single spaces; the key without spaces, upper-case.
            // The final PDF's recorded code gets the same normalisation, so an issued PDF still counts
            // as current (FinalPdfDepositCode is compared Ordinal with DepositCode). U+00A0 counts as
            // whitespace like C# char.IsWhiteSpace.
            migrationBuilder.Sql("""
                UPDATE valuation."ValuationReportIssuances"
                SET "DepositCodeKey" = NULLIF(upper(regexp_replace(translate("DepositCode", '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[\s ]', '', 'g')), ''),
                    "DepositCode" = NULLIF(btrim(regexp_replace(translate("DepositCode", '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[\s ]+', ' ', 'g')), '')
                WHERE "DepositCode" IS NOT NULL;

                UPDATE valuation."ValuationReportIssuances"
                SET "FinalPdfDepositCode" = NULLIF(btrim(regexp_replace(translate("FinalPdfDepositCode", '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[\s ]+', ' ', 'g')), '')
                WHERE "FinalPdfDepositCode" IS NOT NULL;
                """);

            // A code already used by two current reports keeps its key only on the latest one,
            // so the unique index can be created; the older copies are found by their code, not the key.
            migrationBuilder.Sql("""
                UPDATE valuation."ValuationReportIssuances" i
                SET "DepositCodeKey" = NULL
                FROM (
                    SELECT "Id", row_number() OVER (
                        PARTITION BY "DepositCodeKey"
                        ORDER BY "CertificateUploadedAtUtc" DESC NULLS LAST, "Id" DESC) AS rn
                    FROM valuation."ValuationReportIssuances"
                    WHERE "SupersededAtUtc" IS NULL AND "DepositCodeKey" IS NOT NULL
                ) d
                WHERE i."Id" = d."Id" AND d.rn > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_ValuationReportIssuances_DepositCodeKey_Current",
                schema: "valuation",
                table: "ValuationReportIssuances",
                column: "DepositCodeKey",
                unique: true,
                filter: "\"SupersededAtUtc\" IS NULL AND \"DepositCodeKey\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ValuationIncomeApproaches_ValuationRequestId",
                schema: "valuation",
                table: "ValuationIncomeApproaches",
                column: "ValuationRequestId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ValuationIncomeApproaches",
                schema: "valuation");

            migrationBuilder.DropIndex(
                name: "IX_ValuationReportIssuances_DepositCodeKey_Current",
                schema: "valuation",
                table: "ValuationReportIssuances");

            migrationBuilder.DropColumn(
                name: "DepositCodeKey",
                schema: "valuation",
                table: "ValuationReportIssuances");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "valuation",
                table: "ValuationReportIssuances");

            migrationBuilder.DropColumn(
                name: "ActualAgeRationale",
                schema: "valuation",
                table: "ValuationCostApproaches");

            migrationBuilder.DropColumn(
                name: "EconomicAgeRationale",
                schema: "valuation",
                table: "ValuationCostApproaches");

            migrationBuilder.DropColumn(
                name: "OwnershipInterestKey",
                schema: "valuation",
                table: "ValuationApproachSettings");

            migrationBuilder.DropColumn(
                name: "RemainingLeaseYears",
                schema: "valuation",
                table: "ValuationApproachSettings");
        }
    }
}
