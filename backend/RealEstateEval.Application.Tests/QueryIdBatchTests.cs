using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class QueryIdBatchTests
{
    private const string TypicalPath = "/api/case-study-dispatch/workflow-task-kinds?ids=";

    [Fact]
    public void Five_hundred_ids_split_into_four_chunks_of_at_most_150()
    {
        var ids = Enumerable.Range(0, 500).Select(_ => Guid.NewGuid()).ToList();
        ids.Add(ids[0]);

        var chunks = QueryIdBatch.OfGuids(ids);

        Assert.Equal(4, chunks.Count);
        Assert.Equal(new[] { 150, 150, 150, 50 }, chunks.Select(c => c.Count));
        Assert.Equal(500, chunks.Sum(c => c.Count));
        Assert.Equal(500, chunks.SelectMany(c => c).Distinct().Count());
    }

    [Fact]
    public void One_hundred_fifty_guids_fit_under_the_request_line_cap()
    {
        var ids = Enumerable.Range(0, QueryIdBatch.MaxPerGet).Select(_ => Guid.NewGuid()).ToList();
        var line = RequestLine(TypicalPath + QueryIdBatch.JoinEscaped(ids));

        Assert.True(QueryIdBatch.Utf8ByteCount(line) < QueryIdBatch.MaxRequestLineBytes);
    }

    [Fact]
    public void Five_hundred_guids_on_one_get_exceed_the_request_line_cap()
    {
        var ids = Enumerable.Range(0, 500).Select(_ => Guid.NewGuid()).ToList();
        var line = RequestLine(TypicalPath + QueryIdBatch.JoinEscaped(ids));

        Assert.True(QueryIdBatch.Utf8ByteCount(line) > QueryIdBatch.MaxRequestLineBytes);
    }

    [Fact]
    public void Empty_and_blank_values_make_no_chunks()
    {
        Assert.Empty(QueryIdBatch.OfGuids([]));
        Assert.Empty(QueryIdBatch.OfStrings(["", "  ", null]));
    }

    private static string RequestLine(string pathAndQuery) => $"GET {pathAndQuery} HTTP/1.1";
}
