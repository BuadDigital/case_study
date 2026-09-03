using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts.Valuation.Migrations;

[DbContext(typeof(ValuationDbContext))]
[Migration("20260816120000_AddComparableProperties")]
public partial class AddComparableProperties : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ComparableProperties",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ReferenceCode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                ComparablePropertyType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                TransactionKind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                PriceDescription = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                Source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                ListingNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                AdvertiserPhone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                ListingImageFileName = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                Latitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: false),
                Longitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: false),
                AreaSqm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                TransactionDate = table.Column<DateOnly>(type: "date", nullable: false),
                Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                PricePerSqm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                City = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                District = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                IntakeChannel = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                EnteredByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                EnteredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                SourceWorkOrderNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                SourcePropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ComparableProperties", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ComparableProperties_ReferenceCode",
            schema: "valuation",
            table: "ComparableProperties",
            column: "ReferenceCode",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_ComparableProperties_IsActive_District",
            schema: "valuation",
            table: "ComparableProperties",
            columns: new[] { "IsActive", "District" });

        migrationBuilder.CreateIndex(
            name: "IX_ComparableProperties_TransactionDate",
            schema: "valuation",
            table: "ComparableProperties",
            column: "TransactionDate");

        migrationBuilder.CreateIndex(
            name: "IX_ComparableProperties_IntakeChannel",
            schema: "valuation",
            table: "ComparableProperties",
            column: "IntakeChannel");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "ComparableProperties",
            schema: "valuation");
    }
}
