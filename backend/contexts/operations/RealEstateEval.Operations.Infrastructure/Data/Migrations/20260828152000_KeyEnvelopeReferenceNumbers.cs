using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts.Operations.Migrations
{
    [DbContext(typeof(OperationsDbContext))]
    [Migration("20260828152000_KeyEnvelopeReferenceNumbers")]
    public partial class KeyEnvelopeReferenceNumbers : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // Numbering shop: annual KE counters + reference number column, with backfill
 // In chronological order (Riyadh year = UTC+3) and planting the counter from the highest allotted.
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS operations."OperationsReferenceSequences" (
                    "Id" uuid NOT NULL,
                    "Prefix" character varying(8) NOT NULL,
                    "Year" integer NOT NULL,
                    "LastValue" integer NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_ReferenceSequences" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "UX_operations_ReferenceSequences_Prefix_Year"
                    ON operations."OperationsReferenceSequences" ("Prefix", "Year");

                ALTER TABLE operations."KeyEnvelopes"
                ADD COLUMN IF NOT EXISTS "ReferenceNumber" character varying(32) NULL;

                CREATE INDEX IF NOT EXISTS "IX_KeyEnvelopes_ReferenceNumber"
                    ON operations."KeyEnvelopes" ("ReferenceNumber");

                WITH numbered AS (
                    SELECT "Id",
                           EXTRACT(YEAR FROM ("CreatedAtUtc" + interval '3 hours'))::int AS ref_year,
                           ROW_NUMBER() OVER (
                               PARTITION BY EXTRACT(YEAR FROM ("CreatedAtUtc" + interval '3 hours'))
                               ORDER BY "CreatedAtUtc", "Id") AS ref_seq
                    FROM operations."KeyEnvelopes"
                    WHERE "ReferenceNumber" IS NULL
                )
                UPDATE operations."KeyEnvelopes" k
                SET "ReferenceNumber" =
                    'KE-' || numbered.ref_year::text || '-' || LPAD(numbered.ref_seq::text, 5, '0')
                FROM numbered
                WHERE k."Id" = numbered."Id";

                INSERT INTO operations."OperationsReferenceSequences"
                    ("Id", "Prefix", "Year", "LastValue", "UpdatedAtUtc")
                SELECT gen_random_uuid(),
                       'KE',
                       EXTRACT(YEAR FROM ("CreatedAtUtc" + interval '3 hours'))::int,
                       COUNT(*),
                       NOW()
                FROM operations."KeyEnvelopes"
                GROUP BY EXTRACT(YEAR FROM ("CreatedAtUtc" + interval '3 hours'))::int
                ON CONFLICT ("Prefix", "Year") DO UPDATE SET
                    "LastValue" = GREATEST(
                        operations."OperationsReferenceSequences"."LastValue",
                        EXCLUDED."LastValue"),
                    "UpdatedAtUtc" = EXCLUDED."UpdatedAtUtc";
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE operations."KeyEnvelopes"
                DROP COLUMN IF EXISTS "ReferenceNumber";

                DROP TABLE IF EXISTS operations."OperationsReferenceSequences";
                """);
        }
    }
}
