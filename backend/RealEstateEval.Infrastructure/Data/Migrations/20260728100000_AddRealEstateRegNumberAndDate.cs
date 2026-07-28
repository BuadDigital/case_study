using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <inheritdoc />
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260728100000_AddRealEstateRegNumberAndDate")]
public partial class AddRealEstateRegNumberAndDate : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "RealEstateRegNumber",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "RealEstateRegDate",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "HasRequestNumber",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "boolean",
            nullable: false,
            defaultValue: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "RealEstateRegNumber",
            schema: "case_study",
            table: "WorkOrderProperties");

        migrationBuilder.DropColumn(
            name: "RealEstateRegDate",
            schema: "case_study",
            table: "WorkOrderProperties");

        migrationBuilder.DropColumn(
            name: "HasRequestNumber",
            schema: "case_study",
            table: "WorkOrderProperties");
    }
}
