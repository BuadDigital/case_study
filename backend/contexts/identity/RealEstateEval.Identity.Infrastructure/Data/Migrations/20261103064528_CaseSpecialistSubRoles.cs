using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.Identity.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class CaseSpecialistSubRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CaseSpecialistSubRoles",
                schema: "identity",
                table: "UserProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Launch rule (ruling 2026-11-02): every existing case specialist holds all three
            // sub-roles (coordination 1 + study 2 + review 4) so nobody loses work on deploy.
            migrationBuilder.Sql(
                """
                UPDATE identity."UserProfiles"
                SET "CaseSpecialistSubRoles" = 7
                WHERE "RoleId" = 'case-specialist';
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfiles_CaseSpecialistSubRoles",
                schema: "identity",
                table: "UserProfiles",
                sql: "(\"RoleId\" = 'case-specialist' AND \"CaseSpecialistSubRoles\" BETWEEN 1 AND 7) OR (\"RoleId\" IS DISTINCT FROM 'case-specialist' AND \"CaseSpecialistSubRoles\" = 0)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfiles_CaseSpecialistSubRoles",
                schema: "identity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "CaseSpecialistSubRoles",
                schema: "identity",
                table: "UserProfiles");
        }
    }
}
