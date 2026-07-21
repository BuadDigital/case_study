using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260721160000_ShortenDefaultPricingTableNames")]
public partial class ShortenDefaultPricingTableNames : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE financial."PartyFeePricingTables"
            SET "Name" = N'افتراضي'
            WHERE "Name" IN (
                N'التسعيرة الافتراضية',
                N'التسعيرة الافتراضية — مكاتب هندسية',
                N'المراجع الحكومي — افتراضي',
                N'المعاين الميداني — افتراضي'
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Data-only cleanup — no rollback.
    }
}
