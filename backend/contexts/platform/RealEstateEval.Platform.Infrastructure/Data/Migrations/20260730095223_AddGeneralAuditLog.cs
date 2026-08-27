using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Platform.Infrastructure.Data.Contexts.Platform.Migrations
{
 /// <inheritdoc />
    public partial class AddGeneralAuditLog : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditLogs",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Action = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    EntityId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    BeforeJson = table.Column<string>(type: "jsonb", nullable: false),
                    AfterJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Action",
                schema: "platform",
                table: "AuditLogs",
                column: "Action");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ActorId",
                schema: "platform",
                table: "AuditLogs",
                column: "ActorId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_CreatedAtUtc",
                schema: "platform",
                table: "AuditLogs",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_EntityType_EntityId",
                schema: "platform",
                table: "AuditLogs",
                columns: new[] { "EntityType", "EntityId" });

 // Preserve the existing court audit history while moving all future writes to
 // the unified before/after shape.
            migrationBuilder.Sql(
                """
                INSERT INTO platform."AuditLogs"
                    ("Id", "ActorId", "Action", "EntityType", "EntityId",
                     "BeforeJson", "AfterJson", "CreatedAtUtc")
                SELECT
                    old."Id",
                    old."ActorId",
                    old."Action",
                    old."EntityType",
                    old."EntityId"::text,
                    COALESCE(
                        (
                            SELECT jsonb_object_agg(change.key, change.value -> 'before')
                            FROM jsonb_each(old."ChangesJson") AS change
                        ),
                        '{}'::jsonb),
                    COALESCE(
                        (
                            SELECT jsonb_object_agg(change.key, change.value -> 'after')
                            FROM jsonb_each(old."ChangesJson") AS change
                        ),
                        '{}'::jsonb),
                    old."TimestampUtc"
                FROM platform."CourtAuditLogs" AS old
                ON CONFLICT ("Id") DO NOTHING;

                CREATE OR REPLACE FUNCTION platform."PreventAuditLogMutation"()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RAISE EXCEPTION 'platform.AuditLogs is append-only';
                END;
                $$;

                CREATE TRIGGER "TR_AuditLogs_AppendOnly"
                BEFORE UPDATE OR DELETE ON platform."AuditLogs"
                FOR EACH ROW EXECUTE FUNCTION platform."PreventAuditLogMutation"();
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP TRIGGER IF EXISTS "TR_AuditLogs_AppendOnly" ON platform."AuditLogs";
                DROP FUNCTION IF EXISTS platform."PreventAuditLogMutation"();
                """);

            migrationBuilder.DropTable(
                name: "AuditLogs",
                schema: "platform");
        }
    }
}
