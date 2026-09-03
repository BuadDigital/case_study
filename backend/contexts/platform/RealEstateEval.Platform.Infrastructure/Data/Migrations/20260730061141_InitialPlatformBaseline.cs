using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Platform.Infrastructure.Data.Contexts.Platform.Migrations;

/// <summary>
/// Empty baseline. The <c>platform</c> tables already exist from the legacy stream;
/// this migration only records that <see cref="PlatformDbContext"/> owns the model
/// going forward and seeds its per-schema history table.
/// </summary>
public partial class InitialPlatformBaseline : Migration
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
