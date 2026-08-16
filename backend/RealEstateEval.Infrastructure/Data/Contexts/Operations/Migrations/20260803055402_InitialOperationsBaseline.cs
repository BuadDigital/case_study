using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Operations.Migrations;

/// <summary>
/// Empty baseline. Operations tables (and D2 tasks still in <c>case_study</c>) already exist
/// from the legacy stream; this migration only records that
/// <see cref="OperationsDbContext"/> owns the model going forward and seeds
/// <c>operations.__EFMigrationsHistory</c>.
/// </summary>
public partial class InitialOperationsBaseline : Migration
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
