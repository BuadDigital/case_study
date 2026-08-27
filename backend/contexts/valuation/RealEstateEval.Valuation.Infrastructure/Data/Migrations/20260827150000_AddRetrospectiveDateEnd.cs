using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

/// <summary>أثر رجعي: تاريخ محدد أو فترة بين تاريخين (RetrospectiveDateEnd).</summary>
[DbContext(typeof(ValuationDbContext))]
[Migration("20260827150000_AddRetrospectiveDateEnd")]
public partial class AddRetrospectiveDateEnd : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateOnly>(
            name: "RetrospectiveDateEnd",
            schema: "valuation",
            table: "ValuationApproachSettings",
            type: "date",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "RetrospectiveDateEnd",
            schema: "valuation",
            table: "ValuationApproachSettings");
    }
}
