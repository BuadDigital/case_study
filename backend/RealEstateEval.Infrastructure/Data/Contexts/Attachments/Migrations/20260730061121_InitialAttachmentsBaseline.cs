using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Attachments.Migrations;

/// <summary>
/// Empty baseline. The <c>attachments</c> tables already exist from the legacy stream;
/// this migration only records that <see cref="AttachmentsDbContext"/> owns the model
/// going forward and seeds its per-schema history table.
/// </summary>
public partial class InitialAttachmentsBaseline : Migration
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
