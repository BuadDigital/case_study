using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Platform.Infrastructure.Data.Contexts.Platform.Migrations
{
 /// <summary>
 /// Moves the shared audit ledger out of the platform owner's schema. Identity, platform and
 /// case-study all append to it, and leaving it in <c>platform</c> would force every writer to
 /// be granted the whole platform schema — courts, regions and configuration included. A
 /// schema holding this one table lets grant INSERT on the ledger alone (audit-schema decision).
 /// </summary>
    public partial class RelocateAuditLogToAuditSchema : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "audit");

            migrationBuilder.RenameTable(
                name: "AuditLogs",
                schema: "platform",
                newName: "AuditLogs",
                newSchema: "audit");

 // The trigger follows the table, but its function does not; recreate both in the
 // new schema so the append-only guard survives a platform-only revocation.
            migrationBuilder.Sql(
                """
                DROP TRIGGER IF EXISTS "TR_AuditLogs_AppendOnly" ON audit."AuditLogs";
                DROP FUNCTION IF EXISTS platform."PreventAuditLogMutation"();

                CREATE FUNCTION audit."PreventAuditLogMutation"()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RAISE EXCEPTION 'audit.AuditLogs is append-only';
                END;
                $$;

                CREATE TRIGGER "TR_AuditLogs_AppendOnly"
                BEFORE UPDATE OR DELETE ON audit."AuditLogs"
                FOR EACH ROW EXECUTE FUNCTION audit."PreventAuditLogMutation"();
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP TRIGGER IF EXISTS "TR_AuditLogs_AppendOnly" ON audit."AuditLogs";
                DROP FUNCTION IF EXISTS audit."PreventAuditLogMutation"();
                """);

            migrationBuilder.RenameTable(
                name: "AuditLogs",
                schema: "audit",
                newName: "AuditLogs",
                newSchema: "platform");

            migrationBuilder.Sql(
                """
                CREATE FUNCTION platform."PreventAuditLogMutation"()
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
    }
}
