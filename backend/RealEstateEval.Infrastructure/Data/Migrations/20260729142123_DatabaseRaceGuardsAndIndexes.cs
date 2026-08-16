using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations
{
 /// <inheritdoc />
    public partial class DatabaseRaceGuardsAndIndexes : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ValuationRequests_DisplayId",
                schema: "valuation",
                table: "ValuationRequests");

            migrationBuilder.DropIndex(
                name: "IX_UserNotifications_UserId_SourceEvent",
                schema: "messaging",
                table: "UserNotifications");

            migrationBuilder.DropIndex(
                name: "IX_OutboxMessages_ProcessedAtUtc_DeadLetteredAtUtc_LockedUntil~",
                schema: "messaging",
                table: "OutboxMessages");

            migrationBuilder.CreateSequence<int>(
                name: "ValuationRequestDisplayId",
                schema: "valuation",
                startValue: 445L);

 // Start past whatever the retired COUNT(*) generator already handed out, so the
 // first sequence-generated identifier cannot collide with an existing row.
            migrationBuilder.Sql(
                """
                SELECT setval(
                    'valuation."ValuationRequestDisplayId"',
                    GREATEST(
                        444,
                        COALESCE(
                            MAX(substring("DisplayId" FROM '^VR-([0-9]+)$')::bigint),
                            0)),
                    true)
                FROM valuation."ValuationRequests";
                """);

 // That generator could hand the same number to concurrent callers, so an existing
 // database may already carry duplicates. Keep the oldest row's identifier and
 // renumber the rest from the sequence, otherwise the unique index cannot be built.
            migrationBuilder.Sql(
                """
                UPDATE valuation."ValuationRequests" AS v
                SET "DisplayId" = 'VR-' || nextval('valuation."ValuationRequestDisplayId"')
                WHERE EXISTS (
                    SELECT 1
                    FROM valuation."ValuationRequests" AS other
                    WHERE other."DisplayId" = v."DisplayId"
                      AND (other."UpdatedAtUtc" < v."UpdatedAtUtc"
                           OR (other."UpdatedAtUtc" = v."UpdatedAtUtc"
                               AND other."Id" < v."Id")));
                """);

 // One open request per property becomes a hard rule below. Existing violations
 // need a business decision, so fail with something actionable instead of the raw
 // index error.
            migrationBuilder.Sql(
                """
                DO $$
                DECLARE conflicting integer;
                BEGIN
                    SELECT count(*) INTO conflicting FROM (
                        SELECT "PropertyId"
                        FROM valuation."ValuationRequests"
                        WHERE "Status" <> 'done'
                        GROUP BY "PropertyId"
                        HAVING count(*) > 1) duplicates;
                    IF conflicting > 0 THEN
                        RAISE EXCEPTION
                            'Cannot enforce one open valuation request per property: % property(ies) already have more than one. Submit or close the extra requests, then re-run the migration.',
                            conflicting;
                    END IF;
                END $$;
                """);

 // Same story for the notification dedupe rule: keep the newest unread copy of a
 // source event and mark the older duplicates read rather than deleting history.
            migrationBuilder.Sql(
                """
                UPDATE messaging."UserNotifications" AS n
                SET "ReadAtUtc" = n."CreatedAtUtc"
                WHERE n."SourceEvent" IS NOT NULL
                  AND n."ReadAtUtc" IS NULL
                  AND EXISTS (
                      SELECT 1
                      FROM messaging."UserNotifications" AS newer
                      WHERE newer."UserId" = n."UserId"
                        AND newer."SourceEvent" = n."SourceEvent"
                        AND newer."ReadAtUtc" IS NULL
                        AND (newer."CreatedAtUtc" > n."CreatedAtUtc"
                             OR (newer."CreatedAtUtc" = n."CreatedAtUtc"
                                 AND newer."Id" > n."Id")));
                """);

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowTasks_AssigneeId",
                schema: "case_study",
                table: "WorkflowTasks",
                column: "AssigneeId");

            migrationBuilder.CreateIndex(
                name: "IX_ValuationRequests_DisplayId",
                schema: "valuation",
                table: "ValuationRequests",
                column: "DisplayId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ValuationRequests_PropertyId_Open",
                schema: "valuation",
                table: "ValuationRequests",
                column: "PropertyId",
                unique: true,
                filter: "\"Status\" <> 'done'");

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_UserId_SourceEvent_Unread",
                schema: "messaging",
                table: "UserNotifications",
                columns: new[] { "UserId", "SourceEvent" },
                unique: true,
                filter: "\"SourceEvent\" IS NOT NULL AND \"ReadAtUtc\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_Pending_CreatedAtUtc",
                schema: "messaging",
                table: "OutboxMessages",
                column: "CreatedAtUtc",
                filter: "\"ProcessedAtUtc\" IS NULL AND \"DeadLetteredAtUtc\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsTasks_CreatedBy",
                schema: "case_study",
                table: "OperationsTasks",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_OperationsTasks_PoNumber",
                schema: "case_study",
                table: "OperationsTasks",
                column: "PoNumber");
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkflowTasks_AssigneeId",
                schema: "case_study",
                table: "WorkflowTasks");

            migrationBuilder.DropIndex(
                name: "IX_ValuationRequests_DisplayId",
                schema: "valuation",
                table: "ValuationRequests");

            migrationBuilder.DropIndex(
                name: "IX_ValuationRequests_PropertyId_Open",
                schema: "valuation",
                table: "ValuationRequests");

            migrationBuilder.DropIndex(
                name: "IX_UserNotifications_UserId_SourceEvent_Unread",
                schema: "messaging",
                table: "UserNotifications");

            migrationBuilder.DropIndex(
                name: "IX_OutboxMessages_Pending_CreatedAtUtc",
                schema: "messaging",
                table: "OutboxMessages");

            migrationBuilder.DropIndex(
                name: "IX_OperationsTasks_CreatedBy",
                schema: "case_study",
                table: "OperationsTasks");

            migrationBuilder.DropIndex(
                name: "IX_OperationsTasks_PoNumber",
                schema: "case_study",
                table: "OperationsTasks");

            migrationBuilder.DropSequence(
                name: "ValuationRequestDisplayId",
                schema: "valuation");

            migrationBuilder.CreateIndex(
                name: "IX_ValuationRequests_DisplayId",
                schema: "valuation",
                table: "ValuationRequests",
                column: "DisplayId");

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_UserId_SourceEvent",
                schema: "messaging",
                table: "UserNotifications",
                columns: new[] { "UserId", "SourceEvent" });

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_ProcessedAtUtc_DeadLetteredAtUtc_LockedUntil~",
                schema: "messaging",
                table: "OutboxMessages",
                columns: new[] { "ProcessedAtUtc", "DeadLetteredAtUtc", "LockedUntilUtc" });
        }
    }
}
