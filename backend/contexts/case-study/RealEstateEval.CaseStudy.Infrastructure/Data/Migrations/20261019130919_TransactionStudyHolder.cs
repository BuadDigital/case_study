using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class TransactionStudyHolder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "StudyHolderPropertyId",
                schema: "case_study",
                table: "Transactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_StudyHolderPropertyId",
                schema: "case_study",
                table: "Transactions",
                column: "StudyHolderPropertyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transactions_StudyHolderPropertyId",
                schema: "case_study",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "StudyHolderPropertyId",
                schema: "case_study",
                table: "Transactions");
        }
    }
}
