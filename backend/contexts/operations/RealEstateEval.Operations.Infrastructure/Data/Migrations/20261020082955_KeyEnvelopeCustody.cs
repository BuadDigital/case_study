using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Operations.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class KeyEnvelopeCustody : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HolderKind",
                schema: "operations",
                table: "KeyEnvelopes",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "reviewer");

            migrationBuilder.AddColumn<string>(
                name: "HolderLabel",
                schema: "operations",
                table: "KeyEnvelopes",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "HolderSinceUtc",
                schema: "operations",
                table: "KeyEnvelopes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HolderUserId",
                schema: "operations",
                table: "KeyEnvelopes",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "KeyHolderLabel",
                schema: "operations",
                table: "KeyEnvelopeAssignments",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "KeyHolderUserId",
                schema: "operations",
                table: "KeyEnvelopeAssignments",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "KeyLocation",
                schema: "operations",
                table: "KeyEnvelopeAssignments",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "in_envelope");

            migrationBuilder.AddColumn<DateTime>(
                name: "KeyLocationAtUtc",
                schema: "operations",
                table: "KeyEnvelopeAssignments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_KeyEnvelopes_HolderUserId",
                schema: "operations",
                table: "KeyEnvelopes",
                column: "HolderUserId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_KeyEnvelopes_HolderKind",
                schema: "operations",
                table: "KeyEnvelopes",
                sql: "\"HolderKind\" IS NULL OR \"HolderKind\" IN ('reviewer', 'internal_user', 'external', 'court')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_KeyEnvelopeAssignments_KeyLocation",
                schema: "operations",
                table: "KeyEnvelopeAssignments",
                sql: "\"KeyLocation\" IS NULL OR \"KeyLocation\" IN ('in_envelope', 'with_user', 'returned_court', 'missing')");

            // Backfill (decision 2026-10-20): the holder follows the custody status, and the
            // person comes from the last confirmed/completed handoff; the reviewer who
            // registered the envelope holds it otherwise. Deeds whose key was «missing»
            // keep that as the key's place; every other key counts as in the envelope.
            migrationBuilder.Sql("""
                WITH last_handoff AS (
                    SELECT DISTINCT ON (h."EnvelopeId")
                           h."EnvelopeId", h."ToUserId", h."ToParty",
                           COALESCE(h."ConfirmedAtUtc", h."CreatedAtUtc") AS "AtUtc"
                    FROM operations."KeyEnvelopeHandoffs" h
                    WHERE h."Status" IN ('confirmed', 'completed')
                    ORDER BY h."EnvelopeId", COALESCE(h."ConfirmedAtUtc", h."CreatedAtUtc") DESC, h."CreatedAtUtc" DESC
                ),
                src AS (
                    SELECT e."Id", lh."ToUserId", lh."ToParty", lh."AtUtc"
                    FROM operations."KeyEnvelopes" e
                    LEFT JOIN last_handoff lh ON lh."EnvelopeId" = e."Id"
                )
                UPDATE operations."KeyEnvelopes" e
                SET "HolderKind" = CASE e."Status"
                        WHEN 'assessor' THEN 'internal_user'
                        WHEN 'external' THEN 'external'
                        WHEN 'returned' THEN 'court'
                        ELSE 'reviewer' END,
                    "HolderUserId" = CASE e."Status"
                        WHEN 'assessor' THEN src."ToUserId"
                        WHEN 'external' THEN NULL
                        WHEN 'returned' THEN NULL
                        ELSE e."CreatedByUserId" END,
                    "HolderLabel" = CASE e."Status"
                        WHEN 'assessor' THEN src."ToParty"
                        WHEN 'external' THEN src."ToParty"
                        WHEN 'returned' THEN COALESCE(src."ToParty", e."Court")
                        ELSE e."CreatedByName" END,
                    "HolderSinceUtc" = COALESCE(src."AtUtc", e."CreatedAtUtc")
                FROM src
                WHERE src."Id" = e."Id";

                UPDATE operations."KeyEnvelopeAssignments"
                SET "KeyLocation" = 'missing', "KeyLocationAtUtc" = "ConfirmedAtUtc"
                WHERE "Status" = 'missing';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_KeyEnvelopes_HolderUserId",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_KeyEnvelopes_HolderKind",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_KeyEnvelopeAssignments_KeyLocation",
                schema: "operations",
                table: "KeyEnvelopeAssignments");

            migrationBuilder.DropColumn(
                name: "HolderKind",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.DropColumn(
                name: "HolderLabel",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.DropColumn(
                name: "HolderSinceUtc",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.DropColumn(
                name: "HolderUserId",
                schema: "operations",
                table: "KeyEnvelopes");

            migrationBuilder.DropColumn(
                name: "KeyHolderLabel",
                schema: "operations",
                table: "KeyEnvelopeAssignments");

            migrationBuilder.DropColumn(
                name: "KeyHolderUserId",
                schema: "operations",
                table: "KeyEnvelopeAssignments");

            migrationBuilder.DropColumn(
                name: "KeyLocation",
                schema: "operations",
                table: "KeyEnvelopeAssignments");

            migrationBuilder.DropColumn(
                name: "KeyLocationAtUtc",
                schema: "operations",
                table: "KeyEnvelopeAssignments");
        }
    }
}
