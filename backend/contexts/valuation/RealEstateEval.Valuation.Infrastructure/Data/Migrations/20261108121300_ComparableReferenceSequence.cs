using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Valuation.Infrastructure.Data.Migrations
{
    /// <summary>
    /// Numbering ruling 2026-11-08: a comparable in the bank is numbered CMP-{YY}-{seq} from a yearly
    /// counter, like every other reference, instead of CMP- + eight letters of its id.
    /// 1. creates the valuation context's counter table (ValuationReferenceSequences);
    /// 2. renumbers the existing CMP-XXXXXXXX codes in creation order under their creation year
    ///    (Riyadh time) and sets the CMP counter of each year to the last number given.
    /// The demo bank's own codes (TRX-/OFR-/BID-…) are left as they are. Approved reports keep the codes
    /// frozen in their deposit copy.
    /// </summary>
    public partial class ComparableReferenceSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ValuationReferenceSequences",
                schema: "valuation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Prefix = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    LastValue = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ValuationReferenceSequences", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "UX_valuation_ReferenceSequences_Prefix_Year",
                schema: "valuation",
                table: "ValuationReferenceSequences",
                columns: new[] { "Prefix", "Year" },
                unique: true);

            migrationBuilder.Sql(
                """
                -- 2. CMP-XXXXXXXX → CMP-YY-NNNNN, numbered per Riyadh year in creation order (id breaks ties).
                WITH ordered AS (
                    SELECT "Id",
                           EXTRACT(YEAR FROM ("CreatedAtUtc" AT TIME ZONE 'Asia/Riyadh'))::int AS yr,
                           ROW_NUMBER() OVER (
                               PARTITION BY EXTRACT(YEAR FROM ("CreatedAtUtc" AT TIME ZONE 'Asia/Riyadh'))
                               ORDER BY "CreatedAtUtc", "Id") AS seq
                    FROM valuation."ComparableProperties"
                    WHERE "ReferenceCode" ~ '^CMP-[0-9A-F]{8}$'
                )
                UPDATE valuation."ComparableProperties" c
                SET "ReferenceCode" = 'CMP-' || lpad((o.yr % 100)::text, 2, '0') || '-' || lpad(o.seq::text, 5, '0')
                FROM ordered o
                WHERE c."Id" = o."Id";

                INSERT INTO valuation."ValuationReferenceSequences" ("Id", "Prefix", "Year", "LastValue", "UpdatedAtUtc")
                SELECT gen_random_uuid(), 'CMP', 2000 + split_part("ReferenceCode", '-', 2)::int,
                       max(split_part("ReferenceCode", '-', 3)::int), now()
                FROM valuation."ComparableProperties"
                WHERE "ReferenceCode" ~ '^CMP-[0-9]{2}-[0-9]{5}$'
                GROUP BY 2000 + split_part("ReferenceCode", '-', 2)::int;
                """);
        }

        /// <inheritdoc />
        /// <remarks>The renumbered codes are not turned back into id letters; only the counter table goes.</remarks>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ValuationReferenceSequences",
                schema: "valuation");
        }
    }
}
