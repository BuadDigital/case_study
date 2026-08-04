using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Financial.Migrations;

/// <summary>
/// Empty baseline. Financial tables (and D1 inspector-fee rows still in <c>case_study</c>)
/// already exist from the legacy stream; this migration only records that
/// <see cref="FinancialDbContext"/> owns the model going forward and seeds
/// <c>financial.__EFMigrationsHistory</c>.
/// </summary>
public partial class InitialFinancialBaseline : Migration
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
