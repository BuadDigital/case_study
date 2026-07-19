using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RealEstateEval.Infrastructure.Data;

#nullable disable

namespace RealEstateEval.Infrastructure.Data.Migrations;

/// <inheritdoc />
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260719100000_AlignDelegationLettersScopeAndReference")]
public partial class AlignDelegationLettersScopeAndReference : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_InternalDelegationLetterSets_PoNumber",
            schema: "case_study",
            table: "InternalDelegationLetterSets");

        migrationBuilder.RenameColumn(
            name: "PoNumber",
            schema: "case_study",
            table: "InternalDelegationLetterSets",
            newName: "ScopeKey");

        migrationBuilder.AlterColumn<string>(
            name: "ScopeKey",
            schema: "case_study",
            table: "InternalDelegationLetterSets",
            type: "character varying(128)",
            maxLength: 128,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(64)",
            oldMaxLength: 64);

        migrationBuilder.CreateIndex(
            name: "IX_InternalDelegationLetterSets_ScopeKey",
            schema: "case_study",
            table: "InternalDelegationLetterSets",
            column: "ScopeKey",
            unique: true);

        migrationBuilder.CreateTable(
            name: "DocumentReferenceCounters",
            schema: "case_study",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Dept = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                Type = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                DateKey = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                Seq = table.Column<int>(type: "integer", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_DocumentReferenceCounters", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_DocumentReferenceCounters_Dept_Type_DateKey",
            schema: "case_study",
            table: "DocumentReferenceCounters",
            columns: new[] { "Dept", "Type", "DateKey" },
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "DocumentReferenceCounters",
            schema: "case_study");

        migrationBuilder.DropIndex(
            name: "IX_InternalDelegationLetterSets_ScopeKey",
            schema: "case_study",
            table: "InternalDelegationLetterSets");

        migrationBuilder.RenameColumn(
            name: "ScopeKey",
            schema: "case_study",
            table: "InternalDelegationLetterSets",
            newName: "PoNumber");

        migrationBuilder.AlterColumn<string>(
            name: "PoNumber",
            schema: "case_study",
            table: "InternalDelegationLetterSets",
            type: "character varying(64)",
            maxLength: 64,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(128)",
            oldMaxLength: 128);

        migrationBuilder.CreateIndex(
            name: "IX_InternalDelegationLetterSets_PoNumber",
            schema: "case_study",
            table: "InternalDelegationLetterSets",
            column: "PoNumber",
            unique: true);
    }
}
