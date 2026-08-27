using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

/// <summary>
/// نطاق التقييم بالتكلفة (مواصفة النموذج التفاعلي): أرض ومبنى (الافتراضي) أو مبنى فقط.
/// </summary>
[DbContext(typeof(ValuationDbContext))]
[Migration("20260826160000_AddCostScopeToApproachSettings")]
public partial class AddCostScopeToApproachSettings : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "CostScopeKey",
            schema: "valuation",
            table: "ValuationApproachSettings",
            type: "character varying(32)",
            maxLength: 32,
            nullable: false,
            defaultValue: "land_and_building");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "CostScopeKey",
            schema: "valuation",
            table: "ValuationApproachSettings");
    }
}
