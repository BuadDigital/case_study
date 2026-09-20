using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

/// <summary>
/// «رقم التواصل» holds several numbers (10 digits each, separated by «،»), so 32 characters
/// only fit three of them.
/// </summary>
[DbContext(typeof(ValuationDbContext))]
[Migration("20260920120000_WidenComparableAdvertiserPhone")]
public partial class WidenComparableAdvertiserPhone : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "AdvertiserPhone",
            schema: "valuation",
            table: "ComparableProperties",
            type: "character varying(128)",
            maxLength: 128,
            nullable: true,
            oldClrType: typeof(string),
            oldType: "character varying(32)",
            oldMaxLength: 32,
            oldNullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "AdvertiserPhone",
            schema: "valuation",
            table: "ComparableProperties",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true,
            oldClrType: typeof(string),
            oldType: "character varying(128)",
            oldMaxLength: 128,
            oldNullable: true);
    }
}
