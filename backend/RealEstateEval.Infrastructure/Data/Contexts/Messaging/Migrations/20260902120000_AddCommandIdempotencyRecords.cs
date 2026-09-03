using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Messaging.Migrations;

/// <summary>Durable Idempotency-Key store for CommandIdempotencyMiddleware (ADR 0008).</summary>
[DbContext(typeof(MessagingDbContext))]
[Migration("20260902120000_AddCommandIdempotencyRecords")]
public class AddCommandIdempotencyRecords : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE SCHEMA IF NOT EXISTS messaging;

            CREATE TABLE IF NOT EXISTS messaging."CommandIdempotencyRecords"
            (
                "ActorId" character varying(450) NOT NULL,
                "HttpMethod" character varying(16) NOT NULL,
                "RequestPath" character varying(512) NOT NULL,
                "IdempotencyKey" character varying(128) NOT NULL,
                "StatusCode" integer NOT NULL,
                "ContentType" character varying(128) NULL,
                "ResponseBody" bytea NOT NULL,
                "CreatedAtUtc" timestamp with time zone NOT NULL,
                "ExpiresAtUtc" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_CommandIdempotencyRecords" PRIMARY KEY ("ActorId", "HttpMethod", "RequestPath", "IdempotencyKey")
            );

            CREATE INDEX IF NOT EXISTS "IX_CommandIdempotencyRecords_ExpiresAtUtc"
                ON messaging."CommandIdempotencyRecords" ("ExpiresAtUtc");
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "CommandIdempotencyRecords",
            schema: "messaging");
    }
}
