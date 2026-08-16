using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.CaseStudy.Migrations;

/// <summary>
/// Valuation package نوع الصك على العقار + مخرج مطابقة الصك/الطبيعة على دراسة الحالة.
/// </summary>
[DbContext(typeof(CaseStudyDbContext))]
[Migration("20260816093000_AddDeedKindAndNatureMatch")]
public partial class AddDeedKindAndNatureMatch : Migration
{
 /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "DeedKind",
            schema: "case_study",
            table: "WorkOrderProperties",
            type: "integer",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.AddColumn<string>(
            name: "DeedNatureMatchOutcome",
            schema: "case_study",
            table: "CaseStudyForms",
            type: "character varying(32)",
            maxLength: 32,
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<string>(
            name: "DeedNatureMatchNotes",
            schema: "case_study",
            table: "CaseStudyForms",
            type: "character varying(4000)",
            maxLength: 4000,
            nullable: false,
            defaultValue: "");

 // سجّل عقاري كمعرّف ⟵ اقترح سجل عيني كنوع صك.
        migrationBuilder.Sql(
            """
            UPDATE case_study."WorkOrderProperties"
            SET "DeedKind" = 1
            WHERE "IdentifierType" = 1;
            """);
    }

 /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "DeedNatureMatchNotes",
            schema: "case_study",
            table: "CaseStudyForms");

        migrationBuilder.DropColumn(
            name: "DeedNatureMatchOutcome",
            schema: "case_study",
            table: "CaseStudyForms");

        migrationBuilder.DropColumn(
            name: "DeedKind",
            schema: "case_study",
            table: "WorkOrderProperties");
    }
}
