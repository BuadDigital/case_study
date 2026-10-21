using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <summary>
    /// Decision 2026-10-20 (data only, no model change):
    /// 1. the temporary transaction number is TMP-YY-##### instead of D-YYYY-##### (the counters
    ///    keep the full year; only the printed form changes), and
    /// 2. every transaction that was approved or handed over to Enfaz before the new numbering
    ///    existed gets its official PR number now, in approval order and under the approval year —
    ///    a deed on Enfaz never carries a temporary number.
    /// Numbers already printed on old documents are not rewritten.
    /// </summary>
    [DbContext(typeof(CaseStudyDbContext))]
    [Migration("20261020070000_TransactionDraftPrefixTmp")]
    public partial class TransactionDraftPrefixTmp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                -- 1. D-2026-00055 → TMP-26-00055 (D-0000-00012 → TMP-00-00012); anything else under D- keeps its tail.
                UPDATE case_study."Transactions"
                SET "DraftNumber" = 'TMP-' || substr("DraftNumber", 5)
                WHERE "DraftNumber" ~ '^D-[0-9]{4}-';

                UPDATE case_study."Transactions"
                SET "DraftNumber" = 'TMP-' || substr("DraftNumber", 3)
                WHERE "DraftNumber" LIKE 'D-%';

                UPDATE case_study."CaseStudyReferenceSequences" s
                SET "Prefix" = 'TMP'
                WHERE s."Prefix" = 'D'
                  AND NOT EXISTS (
                      SELECT 1 FROM case_study."CaseStudyReferenceSequences" t
                      WHERE t."Prefix" = 'TMP' AND t."Year" = s."Year");

                -- 2. Official PR numbers for transactions approved (study report issued) or handed over
                --    to Enfaz before the numbering existed. Riyadh is UTC+3 without DST.
                WITH approved AS (
                    SELECT t."Id" AS tx, MIN(x.at) AS at
                    FROM case_study."Transactions" t
                    JOIN case_study."WorkOrderProperties" p ON p."TransactionId" = t."Id"
                    JOIN LATERAL (
                        SELECT p."EnfazHandoverAtUtc" AS at WHERE p."EnfazHandoverAtUtc" IS NOT NULL
                        UNION ALL
                        SELECT r."UpdatedAtUtc"
                        FROM case_study."CaseStudyReports" r
                        WHERE r."PropertyId" = p."Id"
                          AND r."IsPartyContribution" = false
                          AND r."Status" = 'issued'
                    ) x ON true
                    WHERE t."ReferenceNumber" IS NULL
                      AND t."MergedIntoTransactionId" IS NULL
                    GROUP BY t."Id"
                ),
                numbered AS (
                    SELECT tx, at,
                           EXTRACT(YEAR FROM (at + interval '3 hours'))::int AS yr,
                           ROW_NUMBER() OVER (
                               PARTITION BY EXTRACT(YEAR FROM (at + interval '3 hours'))
                               ORDER BY at, tx) AS rn
                    FROM approved
                ),
                per_year AS (
                    SELECT yr, MAX(rn) AS cnt FROM numbered GROUP BY yr
                ),
                counters AS (
                    INSERT INTO case_study."CaseStudyReferenceSequences" ("Id", "Prefix", "Year", "LastValue", "UpdatedAtUtc")
                    SELECT gen_random_uuid(), 'PR', yr, cnt, now() FROM per_year
                    ON CONFLICT ("Prefix", "Year") DO UPDATE
                        SET "LastValue" = case_study."CaseStudyReferenceSequences"."LastValue" + EXCLUDED."LastValue",
                            "UpdatedAtUtc" = now()
                    RETURNING "Year", "LastValue"
                )
                UPDATE case_study."Transactions" t
                SET "ReferenceNumber" = 'PR-' || lpad((n.yr % 100)::text, 2, '0') || '-'
                                        || lpad((c."LastValue" - y.cnt + n.rn)::text, 5, '0'),
                    "ConfirmedAtUtc" = n.at,
                    "UpdatedAtUtc" = now()
                FROM numbered n
                JOIN per_year y ON y.yr = n.yr
                JOIN counters c ON c."Year" = n.yr
                WHERE t."Id" = n.tx;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Official numbers are never taken back; only the temporary prefix returns to D-YYYY.
            migrationBuilder.Sql(
                """
                UPDATE case_study."Transactions"
                SET "DraftNumber" = 'D-20' || substr("DraftNumber", 5)
                WHERE "DraftNumber" ~ '^TMP-[0-9]{2}-';

                UPDATE case_study."CaseStudyReferenceSequences" s
                SET "Prefix" = 'D'
                WHERE s."Prefix" = 'TMP'
                  AND NOT EXISTS (
                      SELECT 1 FROM case_study."CaseStudyReferenceSequences" d
                      WHERE d."Prefix" = 'D' AND d."Year" = s."Year");
                """);
        }
    }
}
