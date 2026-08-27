using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Failures.Migrations;

/// <summary>
/// Empty baseline. The <c>failures</c> tables already exist from the legacy stream;
/// this migration only records that <see cref="FailuresDbContext"/> owns the model
/// going forward and seeds its per-schema history table.
/// </summary>
public partial class InitialFailuresBaseline : Migration
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
