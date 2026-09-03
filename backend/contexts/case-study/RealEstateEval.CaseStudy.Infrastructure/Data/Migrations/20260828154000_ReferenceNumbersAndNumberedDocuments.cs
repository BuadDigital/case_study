using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts.CaseStudy.Migrations
{
    [DbContext(typeof(CaseStudyDbContext))]
    [Migration("20260828154000_ReferenceNumbersAndNumberedDocuments")]
    public partial class ReferenceNumbersAndNumberedDocuments : Migration
    {
 /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
 // Numbering workshop + decision 25: annual TX/LT/CS counters, numbered-document ledger,
 // and transaction number on WorkOrderProperties with backfill by work-order arrival order.
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS case_study."CaseStudyReferenceSequences" (
                    "Id" uuid NOT NULL,
                    "Prefix" character varying(8) NOT NULL,
                    "Year" integer NOT NULL,
                    "LastValue" integer NOT NULL,
                    "UpdatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_ReferenceSequences" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "UX_case_study_ReferenceSequences_Prefix_Year"
                    ON case_study."CaseStudyReferenceSequences" ("Prefix", "Year");

                CREATE TABLE IF NOT EXISTS case_study."NumberedDocuments" (
                    "Id" uuid NOT NULL,
                    "Kind" character varying(32) NOT NULL,
                    "ReferenceNumber" character varying(32) NOT NULL,
                    "PoNumber" character varying(64) NOT NULL DEFAULT '',
                    "PropertyId" uuid NULL,
                    "Title" character varying(512) NOT NULL DEFAULT '',
                    "CreatedByUserId" character varying(450) NOT NULL DEFAULT '',
                    "CreatedAtUtc" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_NumberedDocuments" PRIMARY KEY ("Id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_NumberedDocuments_ReferenceNumber"
                    ON case_study."NumberedDocuments" ("ReferenceNumber");
                CREATE INDEX IF NOT EXISTS "IX_NumberedDocuments_Kind_PoNumber"
                    ON case_study."NumberedDocuments" ("Kind", "PoNumber");
                CREATE INDEX IF NOT EXISTS "IX_NumberedDocuments_CreatedAtUtc"
                    ON case_study."NumberedDocuments" ("CreatedAtUtc");

                ALTER TABLE case_study."WorkOrderProperties"
                ADD COLUMN IF NOT EXISTS "ReferenceNumber" character varying(32) NULL;

                CREATE INDEX IF NOT EXISTS "IX_WorkOrderProperties_ReferenceNumber"
                    ON case_study."WorkOrderProperties" ("ReferenceNumber");

                WITH numbered AS (
                    SELECT p."Id",
                           EXTRACT(YEAR FROM (w."CreatedAtUtc" + interval '3 hours'))::int AS ref_year,
                           ROW_NUMBER() OVER (
                               PARTITION BY EXTRACT(YEAR FROM (w."CreatedAtUtc" + interval '3 hours'))
                               ORDER BY w."CreatedAtUtc", p."Id") AS ref_seq
                    FROM case_study."WorkOrderProperties" p
                    JOIN case_study."WorkOrders" w ON w."Id" = p."WorkOrderId"
                    WHERE p."ReferenceNumber" IS NULL
                )
                UPDATE case_study."WorkOrderProperties" p
                SET "ReferenceNumber" =
                    'TX-' || numbered.ref_year::text || '-' || LPAD(numbered.ref_seq::text, 5, '0')
                FROM numbered
                WHERE p."Id" = numbered."Id";

                INSERT INTO case_study."CaseStudyReferenceSequences"
                    ("Id", "Prefix", "Year", "LastValue", "UpdatedAtUtc")
                SELECT gen_random_uuid(),
                       'TX',
                       EXTRACT(YEAR FROM (w."CreatedAtUtc" + interval '3 hours'))::int,
                       COUNT(*),
                       NOW()
                FROM case_study."WorkOrderProperties" p
                JOIN case_study."WorkOrders" w ON w."Id" = p."WorkOrderId"
                GROUP BY EXTRACT(YEAR FROM (w."CreatedAtUtc" + interval '3 hours'))::int
                ON CONFLICT ("Prefix", "Year") DO UPDATE SET
                    "LastValue" = GREATEST(
                        case_study."CaseStudyReferenceSequences"."LastValue",
                        EXCLUDED."LastValue"),
                    "UpdatedAtUtc" = EXCLUDED."UpdatedAtUtc";
                """);
        }

 /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE case_study."WorkOrderProperties"
                DROP COLUMN IF EXISTS "ReferenceNumber";

                DROP TABLE IF EXISTS case_study."NumberedDocuments";
                DROP TABLE IF EXISTS case_study."CaseStudyReferenceSequences";
                """);
        }
    }
}
