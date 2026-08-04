using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Messaging.Migrations;

/// <summary>
/// Empty baseline. Messaging tables already exist from the legacy stream; this
/// migration only records that <see cref="MessagingDbContext"/> owns the model
/// going forward and seeds <c>messaging.__EFMigrationsHistory</c>.
/// </summary>
public partial class InitialMessagingBaseline : Migration
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
