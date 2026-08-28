using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// تعيين جدول عدّادات الأرقام المرجعية (ورشة الترقيم) — كل سياق مالك يعيّنه في
/// مخططه هو، فتسلسلات بواديه محلية بلا نداء عابر للخدمات. اسم الجدول مميز لكل
/// سياق لأن حارس العمارة يفهرس الجداول بأسمائها عبر السياقات كلها.
/// </summary>
public static class ReferenceSequenceModel
{
 /// <summary>اسم جدول العدّادات في مخطط السياق المالك.</summary>
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
