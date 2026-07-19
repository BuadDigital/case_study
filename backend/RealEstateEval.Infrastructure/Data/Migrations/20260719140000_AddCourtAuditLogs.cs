using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <inheritdoc />
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260719140000_AddCourtAuditLogs")]
public partial class AddCourtAuditLogs : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "CourtAuditLogs",
            schema: "platform",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                EntityType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                ActorId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                ChangesJson = table.Column<string>(type: "jsonb", nullable: false),
                TimestampUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CourtAuditLogs", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_CourtAuditLogs_Action",
            schema: "platform",
            table: "CourtAuditLogs",
            column: "Action");

        migrationBuilder.CreateIndex(
            name: "IX_CourtAuditLogs_EntityType_EntityId",
            schema: "platform",
            table: "CourtAuditLogs",
            columns: new[] { "EntityType", "EntityId" });

        migrationBuilder.CreateIndex(
            name: "IX_CourtAuditLogs_TimestampUtc",
            schema: "platform",
            table: "CourtAuditLogs",
            column: "TimestampUtc");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "CourtAuditLogs",
            schema: "platform");
    }
}
