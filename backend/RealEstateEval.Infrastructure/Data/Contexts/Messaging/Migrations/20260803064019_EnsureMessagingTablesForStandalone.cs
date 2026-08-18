using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Messaging.Migrations;

/// <summary>
/// Empty messaging baseline assumed the shared database already had messaging tables.
/// A dedicated messaging database has no legacy stream, so this creates those tables
/// when they are missing. Valuation keeps its own outbox on the valuation database (D5).
/// </summary>
[DbContext(typeof(MessagingDbContext))]
[Migration("20260803064019_EnsureMessagingTablesForStandalone")]
public class EnsureMessagingTablesForStandalone : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE SCHEMA IF NOT EXISTS messaging;

            CREATE TABLE IF NOT EXISTS messaging."OutboxMessages"
            (
                "Id" uuid NOT NULL,
                "AttemptCount" integer NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "DeadLetteredAtUtc" timestamp with time zone NULL,
                "Error" character varying(2000) NULL,
                "EventType" character varying(128) NOT NULL,
                "LockedBy" character varying(128) NULL,
                "LockedUntilUtc" timestamp with time zone NULL,
                "PayloadJson" jsonb NOT NULL,
                "ProcessedAtUtc" timestamp with time zone NULL,
                CONSTRAINT "PK_OutboxMessages" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_OutboxMessages_CreatedAtUtc"
                ON messaging."OutboxMessages" ("CreatedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_OutboxMessages_ProcessedAtUtc"
                ON messaging."OutboxMessages" ("ProcessedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_OutboxMessages_Pending_CreatedAtUtc"
                ON messaging."OutboxMessages" ("CreatedAtUtc")
                WHERE "ProcessedAtUtc" IS NULL AND "DeadLetteredAtUtc" IS NULL;

            CREATE TABLE IF NOT EXISTS messaging."ProcessedIntegrationEvents"
            (
                "Consumer" character varying(128) NOT NULL,
                "EventId" uuid NOT NULL,
                "EventType" character varying(128) NOT NULL,
                "ProcessedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_ProcessedIntegrationEvents" PRIMARY KEY ("Consumer", "EventId")
            );
            CREATE INDEX IF NOT EXISTS "IX_ProcessedIntegrationEvents_ProcessedAtUtc"
                ON messaging."ProcessedIntegrationEvents" ("ProcessedAtUtc");

            CREATE TABLE IF NOT EXISTS messaging."PushPreferences"
            (
                "UserId" character varying(450) NOT NULL,
                "PushEnabled" boolean NOT NULL,
                "UpdatedAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_PushPreferences" PRIMARY KEY ("UserId")
            );

            CREATE TABLE IF NOT EXISTS messaging."PushSubscriptions"
            (
                "Id" uuid NOT NULL,
                "Auth" character varying(64) NOT NULL,
                "ConsecutiveFailures" integer NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "DeviceLabel" character varying(128) NULL,
                "DisabledAtUtc" timestamp with time zone NULL,
                "DisabledReason" character varying(128) NULL,
                "Endpoint" character varying(1024) NOT NULL,
                "LastSeenAtUtc" timestamp with time zone NOT NULL,
                "LastSuccessAtUtc" timestamp with time zone NULL,
                "P256dh" character varying(256) NOT NULL,
                "UserAgent" character varying(512) NULL,
                "UserId" character varying(450) NOT NULL,
                CONSTRAINT "PK_PushSubscriptions" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PushSubscriptions_Endpoint"
                ON messaging."PushSubscriptions" ("Endpoint");
            CREATE INDEX IF NOT EXISTS "IX_PushSubscriptions_UserId_DisabledAtUtc"
                ON messaging."PushSubscriptions" ("UserId", "DisabledAtUtc");

            CREATE TABLE IF NOT EXISTS messaging."UserNotifications"
            (
                "Id" uuid NOT NULL,
                "Actor" character varying(256) NULL,
                "Body" character varying(2000) NULL,
                "Category" character varying(32) NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "EntityId" character varying(128) NULL,
                "EntityType" character varying(32) NULL,
                "Href" character varying(512) NULL,
                "ReadAtUtc" timestamp with time zone NULL,
                "SourceEvent" character varying(256) NULL,
                "Title" character varying(256) NOT NULL,
                "Tone" character varying(16) NULL,
                "UserId" character varying(450) NOT NULL,
                CONSTRAINT "PK_UserNotifications" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_UserNotifications_UserId_CreatedAtUtc"
                ON messaging."UserNotifications" ("UserId", "CreatedAtUtc");
            CREATE INDEX IF NOT EXISTS "IX_UserNotifications_UserId_ReadAtUtc"
                ON messaging."UserNotifications" ("UserId", "ReadAtUtc");
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_UserNotifications_UserId_SourceEvent_Unread"
                ON messaging."UserNotifications" ("UserId", "SourceEvent")
                WHERE "SourceEvent" IS NOT NULL AND "ReadAtUtc" IS NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Not dropped: on the shared database these objects still belong to the legacy stream.
    }
}
