using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Identity.Infrastructure.Data.Contexts.Identity.Migrations
{
    [DbContext(typeof(IdentityDbContext))]
    [Migration("20260828153000_UserReferenceNumbers")]
    public partial class UserReferenceNumbers : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // ورشة الترقيم: عدّادات US السنوية + عمود الرقم المرجعي، مع backfill
 // بالترتيب الزمني (سنة الرياض = UTC+3) وتزريع العدّاد من أعلى ما خُصِّص.
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS identity."IdentityReferenceSequences" (
                    "Id" uuid NOT NULL,
                    "Prefix" character varying(8) NOT NULL,
                    "Year" integer NOT NULL,
                    "LastValue" integer NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_ReferenceSequences" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "UX_identity_ReferenceSequences_Prefix_Year"
                    ON identity."IdentityReferenceSequences" ("Prefix", "Year");

                ALTER TABLE identity."UserProfiles"
                ADD COLUMN IF NOT EXISTS "ReferenceNumber" character varying(32) NULL;

                WITH numbered AS (
                    SELECT "UserId",
                           EXTRACT(YEAR FROM ("CreatedAtUtc" + interval '3 hours'))::int AS ref_year,
                           ROW_NUMBER() OVER (
                               PARTITION BY EXTRACT(YEAR FROM ("CreatedAtUtc" + interval '3 hours'))
                               ORDER BY "CreatedAtUtc", "UserId") AS ref_seq
                    FROM identity."UserProfiles"
                    WHERE "ReferenceNumber" IS NULL
                )
                UPDATE identity."UserProfiles" p
                SET "ReferenceNumber" =
                    'US-' || numbered.ref_year::text || '-' || LPAD(numbered.ref_seq::text, 5, '0')
                FROM numbered
                WHERE p."UserId" = numbered."UserId";

                INSERT INTO identity."IdentityReferenceSequences"
                    ("Id", "Prefix", "Year", "LastValue", "UpdatedAtUtc")
                SELECT gen_random_uuid(),
                       'US',
                       EXTRACT(YEAR FROM ("CreatedAtUtc" + interval '3 hours'))::int,
                       COUNT(*),
                       NOW()
                FROM identity."UserProfiles"
                GROUP BY EXTRACT(YEAR FROM ("CreatedAtUtc" + interval '3 hours'))::int
                ON CONFLICT ("Prefix", "Year") DO UPDATE SET
                    "LastValue" = GREATEST(
                        identity."IdentityReferenceSequences"."LastValue",
                        EXCLUDED."LastValue"),
                    "UpdatedAtUtc" = EXCLUDED."UpdatedAtUtc";
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE identity."UserProfiles"
                DROP COLUMN IF EXISTS "ReferenceNumber";

                DROP TABLE IF EXISTS identity."IdentityReferenceSequences";
                """);
        }
    }
}
