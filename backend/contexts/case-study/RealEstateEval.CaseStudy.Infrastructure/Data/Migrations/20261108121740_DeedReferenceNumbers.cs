using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <summary>
    /// Numbering ruling 2026-11-08: every deed carries its own number («رقم المعاملة», PR-YY-NNNNN), drawn
    /// at the first full save of its initial data; the property number on the transaction is the deed's
    /// own for a single deed, or the root deed's number + «-L» for a linked property. The TMP draft number
    /// is retired (nullable, kept as history).
    /// Data (local dev only by Omar's order — production untouched until reviewed):
    /// (a) a single numbered property's deed takes its number; (b) a linked numbered property's holder
    /// deed keeps the number and the property becomes «-L» (printed report numbers stay as printed);
    /// (c) every other live deed whose initial data was saved takes the next PR numbers of its year in
    /// the order the data was saved, and the PR counter follows; (d) properties still without a number
    /// take it from their deeds; a merged-away row keeps none.
    /// </summary>
    public partial class DeedReferenceNumbers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReferenceNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "DraftNumber",
                schema: "case_study",
                table: "Transactions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32);

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderProperties_ReferenceNumber",
                schema: "case_study",
                table: "WorkOrderProperties",
                column: "ReferenceNumber",
                unique: true);

            migrationBuilder.Sql(
                """
                -- (a) A single numbered property: its one live deed takes the number.
                UPDATE case_study."WorkOrderProperties" p
                SET "ReferenceNumber" = t."ReferenceNumber"
                FROM case_study."Transactions" t
                WHERE p."TransactionId" = t."Id"
                  AND NOT p."IsRemoved"
                  AND t."ReferenceNumber" IS NOT NULL
                  AND t."MergedIntoTransactionId" IS NULL
                  AND (SELECT count(*) FROM case_study."WorkOrderProperties" d
                       WHERE d."TransactionId" = t."Id" AND NOT d."IsRemoved") = 1;

                -- (b) A linked numbered property: the holder deed (the recorded study holder while live, else the
                --     earliest work order, then deed number) keeps the number; the property becomes number + '-L'.
                WITH holder AS (
                    SELECT DISTINCT ON (t."Id") t."Id" AS tid, p."Id" AS pid
                    FROM case_study."Transactions" t
                    JOIN case_study."WorkOrderProperties" p ON p."TransactionId" = t."Id" AND NOT p."IsRemoved"
                    LEFT JOIN case_study."WorkOrders" w ON w."Id" = p."WorkOrderId"
                    WHERE t."ReferenceNumber" IS NOT NULL
                      AND t."ReferenceNumber" NOT LIKE '%-L'
                      AND t."MergedIntoTransactionId" IS NULL
                      AND (SELECT count(*) FROM case_study."WorkOrderProperties" d
                           WHERE d."TransactionId" = t."Id" AND NOT d."IsRemoved") > 1
                    ORDER BY t."Id",
                             (p."Id" = t."StudyHolderPropertyId") DESC NULLS LAST,
                             w."CreatedAtUtc" NULLS LAST,
                             p."DeedNumber" COLLATE "C"
                )
                UPDATE case_study."WorkOrderProperties" p
                SET "ReferenceNumber" = t."ReferenceNumber"
                FROM holder h
                JOIN case_study."Transactions" t ON t."Id" = h.tid
                WHERE p."Id" = h.pid;

                UPDATE case_study."Transactions" t
                SET "ReferenceNumber" = t."ReferenceNumber" || '-L'
                WHERE t."ReferenceNumber" IS NOT NULL
                  AND t."ReferenceNumber" NOT LIKE '%-L'
                  AND t."MergedIntoTransactionId" IS NULL
                  AND (SELECT count(*) FROM case_study."WorkOrderProperties" d
                       WHERE d."TransactionId" = t."Id" AND NOT d."IsRemoved") > 1;

                -- (c) Every other live deed whose initial data was saved (mandate number, completed bourse, or the
                --     «إتمام البيانات الأولية» timeline row) takes the next PR numbers of its year, in the order the
                --     initial data was saved (that row, else the bourse completion, else the transaction's creation).
                WITH candidates AS (
                    SELECT p."Id",
                           COALESCE(
                               (SELECT min(e."OccurredAtUtc") FROM case_study."PropertyTimelineEntries" e
                                WHERE e."PropertyId" = p."Id" AND e."EventKey" = 'property-enfath'),
                               p."BourseCompletedAtUtc",
                               t."CreatedAtUtc") AS saved_at
                    FROM case_study."WorkOrderProperties" p
                    JOIN case_study."Transactions" t ON t."Id" = p."TransactionId"
                    WHERE p."ReferenceNumber" IS NULL
                      AND NOT p."IsRemoved"
                      AND (COALESCE(btrim(p."AssignmentMandateNumber"), '') <> ''
                           OR p."BourseDataCompleted"
                           OR EXISTS (SELECT 1 FROM case_study."PropertyTimelineEntries" e
                                      WHERE e."PropertyId" = p."Id" AND e."EventKey" = 'property-enfath'))
                ),
                yearly AS (
                    SELECT "Id", saved_at, EXTRACT(YEAR FROM (saved_at AT TIME ZONE 'Asia/Riyadh'))::int AS yr
                    FROM candidates
                ),
                numbered AS (
                    SELECT y."Id", y.yr,
                           COALESCE(s."LastValue", 0) + ROW_NUMBER() OVER (PARTITION BY y.yr ORDER BY y.saved_at, y."Id") AS seq
                    FROM yearly y
                    LEFT JOIN case_study."CaseStudyReferenceSequences" s ON s."Prefix" = 'PR' AND s."Year" = y.yr
                )
                UPDATE case_study."WorkOrderProperties" p
                SET "ReferenceNumber" = 'PR-' || lpad((n.yr % 100)::text, 2, '0') || '-' || lpad(n.seq::text, 5, '0')
                FROM numbered n
                WHERE p."Id" = n."Id";

                -- The PR counter of each year follows the highest number now held by a deed.
                INSERT INTO case_study."CaseStudyReferenceSequences" ("Id", "Prefix", "Year", "LastValue", "UpdatedAtUtc")
                SELECT gen_random_uuid(), 'PR', 2000 + split_part("ReferenceNumber", '-', 2)::int,
                       max(split_part("ReferenceNumber", '-', 3)::int), now()
                FROM case_study."WorkOrderProperties"
                WHERE "ReferenceNumber" ~ '^PR-[0-9]{2}-[0-9]{5}$'
                GROUP BY 2000 + split_part("ReferenceNumber", '-', 2)::int
                ON CONFLICT ("Prefix", "Year") DO UPDATE
                SET "LastValue" = GREATEST(case_study."CaseStudyReferenceSequences"."LastValue", EXCLUDED."LastValue"),
                    "UpdatedAtUtc" = now();

                -- (d) Properties still without a number take it from their deeds: one numbered live deed → its number,
                --     several → the smallest (by year, then sequence) + '-L'. A merged-away row keeps no number.
                WITH live AS (
                    SELECT p."TransactionId" AS tid, p."ReferenceNumber" AS rn,
                           split_part(p."ReferenceNumber", '-', 2)::int AS yy,
                           split_part(p."ReferenceNumber", '-', 3)::int AS seq
                    FROM case_study."WorkOrderProperties" p
                    WHERE NOT p."IsRemoved" AND p."ReferenceNumber" ~ '^PR-[0-9]{2,4}-[0-9]{5}$'
                ),
                per_tx AS (
                    SELECT tid, count(*) AS n,
                           (array_agg(rn ORDER BY (CASE WHEN yy < 100 THEN 2000 + yy ELSE yy END), seq))[1] AS root
                    FROM live
                    GROUP BY tid
                )
                UPDATE case_study."Transactions" t
                SET "ReferenceNumber" = CASE WHEN x.n > 1 THEN x.root || '-L' ELSE x.root END
                FROM per_tx x
                WHERE t."Id" = x.tid
                  AND t."ReferenceNumber" IS NULL
                  AND t."MergedIntoTransactionId" IS NULL;

                UPDATE case_study."Transactions"
                SET "ReferenceNumber" = NULL
                WHERE "MergedIntoTransactionId" IS NOT NULL AND "ReferenceNumber" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Linked properties go back to their root number; numbers drawn for deeds stay drawn (the
            // counter is not rolled back), and rows without a TMP get an empty one so the column can be
            // required again.
            migrationBuilder.Sql(
                """
                UPDATE case_study."Transactions" SET "ReferenceNumber" = left("ReferenceNumber", length("ReferenceNumber") - 2)
                WHERE "ReferenceNumber" LIKE '%-L';
                UPDATE case_study."Transactions" SET "DraftNumber" = 'TMP-00-' || substr(replace("Id"::text, '-', ''), 1, 12)
                WHERE "DraftNumber" IS NULL;
                """);

            migrationBuilder.DropIndex(
                name: "IX_WorkOrderProperties_ReferenceNumber",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.DropColumn(
                name: "ReferenceNumber",
                schema: "case_study",
                table: "WorkOrderProperties");

            migrationBuilder.AlterColumn<string>(
                name: "DraftNumber",
                schema: "case_study",
                table: "Transactions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32,
                oldNullable: true);
        }
    }
}
