using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260816170000_AddBasisOfValueToReconciliation")]
public partial class AddBasisOfValueToReconciliation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "BasisOfValueKey",
            schema: "valuation",
            table: "ValuationReconciliations",
            type: "character varying(32)",
            maxLength: 32,
            nullable: false,
            defaultValue: "market");

        migrationBuilder.AddColumn<string>(
            name: "ValuePremiseKey",
            schema: "valuation",
            table: "ValuationReconciliations",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "BasisOfValueKey",
            schema: "valuation",
            table: "ValuationReconciliations");

        migrationBuilder.DropColumn(
            name: "ValuePremiseKey",
            schema: "valuation",
            table: "ValuationReconciliations");
    }
}
