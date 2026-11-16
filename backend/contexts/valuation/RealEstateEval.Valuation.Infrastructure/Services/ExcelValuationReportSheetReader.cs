using System.Text;
using ExcelDataReader;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>First sheet of an .xlsx/.xls file via ExcelDataReader: row 1 is the header.</summary>
public sealed class ExcelValuationReportSheetReader : IValuationReportSheetReader
{
    static ExcelValuationReportSheetReader()
    {
        // .xls files name legacy code pages that .NET does not load by default.
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    public (IReadOnlyList<string?> Header, IReadOnlyList<object?[]> Rows)? Read(byte[] content)
    {
        try
        {
            using var stream = new MemoryStream(content, writable: false);
            using var reader = ExcelReaderFactory.CreateReader(stream);
            if (!reader.Read())
                return null;

            var header = new string?[reader.FieldCount];
            for (var i = 0; i < reader.FieldCount; i++)
                header[i] = reader.GetValue(i)?.ToString();

            var rows = new List<object?[]>();
            while (reader.Read())
            {
                var row = new object?[reader.FieldCount];
                for (var i = 0; i < reader.FieldCount; i++)
                    row[i] = reader.GetValue(i);
                rows.Add(row);
            }
            return (header, rows);
        }
        catch (Exception ex) when (ex is ExcelDataReader.Exceptions.ExcelReaderException or InvalidDataException or IOException)
        {
            return null;
        }
    }
}
