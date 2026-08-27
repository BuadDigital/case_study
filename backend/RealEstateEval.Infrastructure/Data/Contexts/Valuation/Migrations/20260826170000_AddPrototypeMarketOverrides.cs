using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Valuation.Migrations;

/// <summary>
/// مواصفة النموذج التفاعلي: تجاوزات سعر/مساحة المقارن لكل تقييم (compEdit)،
/// وصف المقارن لكل عامل تسوية (compSpec)، وأوصاف العقار محل التقييم (subjSpec).
/// </summary>
[DbContext(typeof(ValuationDbContext))]
[Migration("20260826170000_AddPrototypeMarketOverrides")]
public partial class AddPrototypeMarketOverrides : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "PriceOverrideSar",
            schema: "valuation",
            table: "ValuationComparableSelections",
            type: "numeric(18,2)",
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "AreaOverrideSqm",
            schema: "valuation",
            table: "ValuationComparableSelections",
            type: "numeric(18,2)",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "DescriptionAr",
            schema: "valuation",
            table: "ValuationComparableAdjustmentLines",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SubjectSpecJson",
            schema: "valuation",
            table: "ValuationMarketApproaches",
            type: "character varying(4000)",
            maxLength: 4000,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "PriceOverrideSar",
            schema: "valuation",
            table: "ValuationComparableSelections");

        migrationBuilder.DropColumn(
            name: "AreaOverrideSqm",
            schema: "valuation",
            table: "ValuationComparableSelections");

        migrationBuilder.DropColumn(
            name: "DescriptionAr",
            schema: "valuation",
            table: "ValuationComparableAdjustmentLines");

        migrationBuilder.DropColumn(
            name: "SubjectSpecJson",
            schema: "valuation",
            table: "ValuationMarketApproaches");
    }
}
