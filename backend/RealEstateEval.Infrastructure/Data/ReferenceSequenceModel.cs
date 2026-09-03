using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Assignment of reference number counter table (numbering shop) — each owner context assigns it to
/// His plan is, the valley sequences are local without a passing call for services. The table name is unique for each
/// Context because architecture guard indexes tables by name across all contexts.
/// </summary>
public static class ReferenceSequenceModel
{
 /// <summary>The name of the counter table in the owner context diagram.</summary>
    public static string TableNameFor(string schema) => schema switch
    {
        DatabaseSchemas.CaseStudy => "CaseStudyReferenceSequences",
        DatabaseSchemas.Operations => "OperationsReferenceSequences",
        DatabaseSchemas.Identity => "IdentityReferenceSequences",
        DatabaseSchemas.Financial => "FinancialReferenceSequences",
        _ => throw new InvalidOperationException(
            $"لا جدول عدّادات مرجعية معرّفاً للمخطط '{schema}'."),
    };

    public static ModelBuilder ApplyReferenceSequenceModel(
        this ModelBuilder builder,
        string schema)
    {
        builder.Entity<ReferenceSequence>(e =>
        {
            e.ToTable(TableNameFor(schema), schema);
            e.HasKey(x => x.Id);
            e.Property(x => x.Prefix).HasMaxLength(8).IsRequired();
            e.HasIndex(x => new { x.Prefix, x.Year })
                .IsUnique()
                .HasDatabaseName($"UX_{schema}_ReferenceSequences_Prefix_Year");
        });

        return builder;
    }
}
