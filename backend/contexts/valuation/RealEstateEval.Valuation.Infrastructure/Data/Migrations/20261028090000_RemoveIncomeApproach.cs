using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <summary>
    /// Removes the income approach (direct capitalisation) from the valuation stream: the approach is
    /// back to «قيد الإنشاء» and cannot be enabled.
    /// How it works: every settings row is switched off (the IncomeApproachEnabled column stays, always
    /// false), the reconciliation rows of kind «income» are deleted so they no longer weigh into the
    /// final opinion, and the ValuationIncomeApproaches table is dropped.
    /// Edge cases: a valuation whose weights included an income row no longer sums to 100% — the
    /// reconciliation-weights gate asks the appraiser to re-weight and save. Down recreates the empty
    /// table only; the deleted inputs, reconciliation rows and settings flags are not restored.
    /// </summary>
    public partial class RemoveIncomeApproach : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE valuation."ValuationApproachSettings"
                SET "IncomeApproachEnabled" = false
                WHERE "IncomeApproachEnabled";

                DELETE FROM valuation."ValuationReconciliationMethodLines"
                WHERE lower(btrim("ApproachKind")) = 'income';
                """);

            migrationBuilder.DropTable(
                name: "ValuationIncomeApproaches",
                schema: "valuation");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ValuationIncomeApproaches",
                schema: "valuation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ValuationRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    CapRateRationale = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CapitalisationRatePct = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: true),
                    GrossPotentialIncome = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OperatingExpensesAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OperatingExpensesMode = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false, defaultValue: "pct_of_egi"),
                    OperatingExpensesPct = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false),
                    OtherIncome = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VacancyCollectionLossPct = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false)
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

            migrationBuilder.CreateIndex(
                name: "IX_ValuationIncomeApproaches_ValuationRequestId",
                schema: "valuation",
                table: "ValuationIncomeApproaches",
                column: "ValuationRequestId",
                unique: true);
        }
    }
}
