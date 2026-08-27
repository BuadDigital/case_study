using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260826150000_AddMarketApproachValueRoundDecimals")]
public partial class AddMarketApproachValueRoundDecimals : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "ValueRoundDecimals",
            schema: "valuation",
            table: "ValuationMarketApproaches",
            type: "integer",
            nullable: false,
            defaultValue: 4);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "ValueRoundDecimals",
            schema: "valuation",
            table: "ValuationMarketApproaches");
    }
}
