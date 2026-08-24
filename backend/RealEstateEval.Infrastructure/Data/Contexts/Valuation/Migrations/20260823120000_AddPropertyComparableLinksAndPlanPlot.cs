using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Valuation.Migrations;

public partial class AddPropertyComparableLinksAndPlanPlot : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "PlanNumber",
            schema: "valuation",
            table: "ComparableProperties",
            type: "character varying(64)",
            maxLength: 64,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "PlotNumber",
            schema: "valuation",
            table: "ComparableProperties",
            type: "character varying(64)",
            maxLength: 64,
            nullable: true);

        migrationBuilder.CreateTable(
            name: "PropertyComparableLinks",
            schema: "valuation",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                ComparablePropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                LinkedByUserId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                LinkedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PropertyComparableLinks", x => x.Id);
                table.ForeignKey(
                    name: "FK_PropertyComparableLinks_ComparableProperties_ComparablePropertyId",
                    column: x => x.ComparablePropertyId,
                    principalSchema: "valuation",
                    principalTable: "ComparableProperties",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_PropertyComparableLinks_Property_Comp",
            schema: "valuation",
            table: "PropertyComparableLinks",
            columns: new[] { "PropertyId", "ComparablePropertyId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_PropertyComparableLinks_PropertyId",
            schema: "valuation",
            table: "PropertyComparableLinks",
            column: "PropertyId");

        migrationBuilder.CreateIndex(
            name: "IX_PropertyComparableLinks_ComparablePropertyId",
            schema: "valuation",
            table: "PropertyComparableLinks",
            column: "ComparablePropertyId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "PropertyComparableLinks",
            schema: "valuation");

        migrationBuilder.DropColumn(
            name: "PlanNumber",
            schema: "valuation",
            table: "ComparableProperties");

        migrationBuilder.DropColumn(
            name: "PlotNumber",
            schema: "valuation",
            table: "ComparableProperties");
    }
}
