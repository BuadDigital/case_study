using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260816200000_AddIndirectCostsAndDepreciation")]
public partial class AddIndirectCostsAndDepreciation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "FinancingAnnualRatePct",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "numeric(9,4)",
            precision: 9,
            scale: 4,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<int>(
            name: "FinancingMonths",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "integer",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.AddColumn<decimal>(
            name: "ActualAgeYears",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "numeric(9,2)",
            precision: 9,
            scale: 2,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "EconomicAgeYears",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "numeric(9,2)",
            precision: 9,
            scale: 2,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "LifeExtensionYears",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "numeric(9,2)",
            precision: 9,
            scale: 2,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<string>(
            name: "LifeExtensionBasis",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "character varying(2000)",
            maxLength: 2000,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "FunctionalObsolescencePct",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "numeric(9,4)",
            precision: 9,
            scale: 4,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<string>(
            name: "FunctionalObsolescenceRationale",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "character varying(2000)",
            maxLength: 2000,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "ExternalObsolescencePct",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "numeric(9,4)",
            precision: 9,
            scale: 4,
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<string>(
            name: "ExternalObsolescenceRationale",
            schema: "valuation",
            table: "ValuationCostApproaches",
            type: "character varying(2000)",
            maxLength: 2000,
            nullable: true);

        migrationBuilder.CreateTable(
            name: "ValuationIndirectCostItems",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CostApproachId = table.Column<Guid>(type: "uuid", nullable: false),
                ItemKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                Pct = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false),
                Rationale = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                SortOrder = table.Column<int>(type: "integer", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ValuationIndirectCostItems", x => x.Id);
                table.ForeignKey(
                    name: "FK_ValuationIndirectCostItems_ValuationCostApproaches_CostAppr~",
                    column: x => x.CostApproachId,
                    principalSchema: "valuation",
                    principalTable: "ValuationCostApproaches",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ValuationIndirectCostItems_CostApproachId",
            schema: "valuation",
            table: "ValuationIndirectCostItems",
            column: "CostApproachId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "ValuationIndirectCostItems",
            schema: "valuation");

        migrationBuilder.DropColumn(name: "FinancingAnnualRatePct", schema: "valuation", table: "ValuationCostApproaches");
        migrationBuilder.DropColumn(name: "FinancingMonths", schema: "valuation", table: "ValuationCostApproaches");
        migrationBuilder.DropColumn(name: "ActualAgeYears", schema: "valuation", table: "ValuationCostApproaches");
        migrationBuilder.DropColumn(name: "EconomicAgeYears", schema: "valuation", table: "ValuationCostApproaches");
        migrationBuilder.DropColumn(name: "LifeExtensionYears", schema: "valuation", table: "ValuationCostApproaches");
        migrationBuilder.DropColumn(name: "LifeExtensionBasis", schema: "valuation", table: "ValuationCostApproaches");
        migrationBuilder.DropColumn(name: "FunctionalObsolescencePct", schema: "valuation", table: "ValuationCostApproaches");
        migrationBuilder.DropColumn(name: "FunctionalObsolescenceRationale", schema: "valuation", table: "ValuationCostApproaches");
        migrationBuilder.DropColumn(name: "ExternalObsolescencePct", schema: "valuation", table: "ValuationCostApproaches");
        migrationBuilder.DropColumn(name: "ExternalObsolescenceRationale", schema: "valuation", table: "ValuationCostApproaches");
    }
}
