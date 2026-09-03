using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations;

[DbContext(typeof(CaseStudyDbContext))]
[Migration("20260816100000_AddBuildingInventory")]
public partial class AddBuildingInventory : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "HasStructuresToValue",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(8)",
            maxLength: 8,
            nullable: false,
            defaultValue: "");

        migrationBuilder.CreateTable(
            name: "BuildingInventoryLines",
            schema: "case_study",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                SortOrder = table.Column<int>(type: "integer", nullable: false),
                StructureKind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                Label = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                AreaSqm = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_BuildingInventoryLines", x => x.Id);
                table.ForeignKey(
                    name: "FK_BuildingInventoryLines_WorkOrderProperties_PropertyId",
                    column: x => x.PropertyId,
                    principalSchema: "case_study",
                    principalTable: "WorkOrderProperties",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_BuildingInventoryLines_PropertyId",
            schema: "case_study",
            table: "BuildingInventoryLines",
            column: "PropertyId");

        migrationBuilder.CreateIndex(
            name: "IX_BuildingInventoryLines_PropertyId_SortOrder",
            schema: "case_study",
            table: "BuildingInventoryLines",
            columns: new[] { "PropertyId", "SortOrder" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "BuildingInventoryLines",
            schema: "case_study");

        migrationBuilder.DropColumn(
            name: "HasStructuresToValue",
            schema: "case_study",
            table: "WorkOrderProperties");
    }
}
