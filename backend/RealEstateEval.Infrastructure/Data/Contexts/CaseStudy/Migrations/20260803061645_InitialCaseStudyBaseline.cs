using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.CaseStudy.Migrations;

/// <summary>
/// Empty baseline. Case Study–owned tables already exist from the legacy stream;
/// this migration only records that <see cref="CaseStudyDbContext"/> owns the model
/// going forward and seeds <c>case_study.__EFMigrationsHistory</c>.
/// </summary>
public partial class InitialCaseStudyBaseline : Migration
{
 /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
    }

 /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
