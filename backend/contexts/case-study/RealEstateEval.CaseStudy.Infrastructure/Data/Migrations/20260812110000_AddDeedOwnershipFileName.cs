using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations;

/// <summary>
/// Primary-data + bourse attachments: ownership deed (optional) and bourse deed image (required at bourse).
/// </summary>
[DbContext(typeof(CaseStudyDbContext))]
[Migration("20260812110000_AddDeedOwnershipFileName")]
public partial class AddDeedOwnershipFileName : Migration
{
 /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "DeedOwnershipFileName",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "BourseDeedImageFileName",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "text",
            nullable: true);
    }

 /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "BourseDeedImageFileName",
            schema: "case_study",
            table: "WorkOrderProperties");

        migrationBuilder.DropColumn(
            name: "DeedOwnershipFileName",
            schema: "case_study",
            table: "WorkOrderProperties");
    }
}
