using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Attachments.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOwnerCommandIdempotency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE SCHEMA IF NOT EXISTS messaging;
                CREATE TABLE IF NOT EXISTS messaging."CommandIdempotencyRecords"
                (
                    "ActorId" character varying(128) NOT NULL,
                    "HttpMethod" character varying(16) NOT NULL,
                    "RequestPath" character varying(512) NOT NULL,
                    "IdempotencyKey" character varying(128) NOT NULL,
                    "ExecutionId" character varying(64) NULL,
                    "StatusCode" integer NOT NULL,
                    "ContentType" character varying(128) NULL,
                    "Location" character varying(2048) NULL,
                    "ResponseBody" bytea NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    "ExpiresAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_CommandIdempotencyRecords"
                        PRIMARY KEY ("ActorId", "HttpMethod", "RequestPath", "IdempotencyKey")
                );
                CREATE INDEX IF NOT EXISTS "IX_CommandIdempotencyRecords_ExpiresAtUtc"
                    ON messaging."CommandIdempotencyRecords" ("ExpiresAtUtc");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """DROP TABLE IF EXISTS messaging."CommandIdempotencyRecords";""");
        }
    }
}
