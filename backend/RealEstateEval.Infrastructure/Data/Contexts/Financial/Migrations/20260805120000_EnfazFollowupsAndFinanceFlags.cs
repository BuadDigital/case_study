using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Contexts.Financial.Migrations
{
    [DbContext(typeof(FinancialDbContext))]
    [Migration("20260805120000_EnfazFollowupsAndFinanceFlags")]
    public partial class EnfazFollowupsAndFinanceFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS financial."PoEnfazFollowups" (
                    "Id" uuid NOT NULL,
                    "PoNumber" character varying(64) NOT NULL,
                    "FollowedAtUtc" timestamp with time zone NOT NULL,
                    "Channel" character varying(32) NOT NULL,
                    "Notes" character varying(2000) NOT NULL,
                    "CreatedByUserId" character varying(450) NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_PoEnfazFollowups" PRIMARY KEY ("Id")
                );

                CREATE INDEX IF NOT EXISTS "IX_PoEnfazFollowups_PoNumber"
                    ON financial."PoEnfazFollowups" ("PoNumber");

                CREATE INDEX IF NOT EXISTS "IX_PoEnfazFollowups_FollowedAtUtc"
                    ON financial."PoEnfazFollowups" ("FollowedAtUtc");

                CREATE TABLE IF NOT EXISTS financial."PoEnfazFinanceFlags" (
                    "Id" uuid NOT NULL,
                    "PoNumber" character varying(64) NOT NULL,
                    "PropertyId" uuid NULL,
                    "Flag" character varying(32) NOT NULL,
                    "Note" character varying(1000) NULL,
                    "SetByUserId" character varying(450) NOT NULL,
                    "SetAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_PoEnfazFinanceFlags" PRIMARY KEY ("Id")
                );

                CREATE INDEX IF NOT EXISTS "IX_PoEnfazFinanceFlags_PoNumber"
                    ON financial."PoEnfazFinanceFlags" ("PoNumber");

                CREATE INDEX IF NOT EXISTS "IX_PoEnfazFinanceFlags_PoNumber_PropertyId"
                    ON financial."PoEnfazFinanceFlags" ("PoNumber", "PropertyId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP TABLE IF EXISTS financial."PoEnfazFollowups";
                DROP TABLE IF EXISTS financial."PoEnfazFinanceFlags";
                """);
        }
    }
}
