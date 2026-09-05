using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// <c>GET /api/case-study-forms/batch</c>: one read for the active queue's rows. The gate is the
/// single-item one — case staff read everything, a party reads its own child and the parent it
/// hangs off, never a sibling's — and denial is absence, so the batch cannot be used to probe.
/// </summary>
public class CaseStudyFormBatchReadTests
{
    private static readonly Guid ParentA = Guid.Parse("eeeeeeee-0000-0000-0000-00000000000a");
    private static readonly Guid ParentB = Guid.Parse("eeeeeeee-0000-0000-0000-00000000000b");
    private static readonly Guid ChildA1 = Guid.Parse("eeeeeeee-0000-0000-0000-0000000000a1");
    private static readonly Guid ChildA2 = Guid.Parse("eeeeeeee-0000-0000-0000-0000000000a2");
    private static readonly Guid ChildB1 = Guid.Parse("eeeeeeee-0000-0000-0000-0000000000b1");
    private static readonly Guid Unknown = Guid.Parse("eeeeeeee-ffff-0000-0000-000000000099");
    private static readonly Guid PropertyId = Guid.Parse("ffffffff-dddd-dddd-dddd-dddddddddddd");

    private static readonly CaseStudyFormActor Staff = new()
    {
        UserId = "staff",
        PrototypeRole = "case-specialist",
    };

    /// <summary>Assigned to ChildA1 only.</summary>
    private static readonly CaseStudyFormActor PartyA1 = new()
    {
        UserId = "user-a1",
        PrototypeRole = "engineering-office",
        DistributionAssigneeId = "dist-a1",
    };

    private static readonly CaseStudyFormActor Outsider = new()
    {
        UserId = "user-x",
        PrototypeRole = "engineering-office",
        DistributionAssigneeId = "dist-x",
    };

    [Fact]
    public async Task Staff_gets_every_parent_with_its_children_keyed_by_id()
    {
        var query = new FakeBatchQuery();
        SeedTasks(query.Tasks);
        query.Forms.Add(NewForm(ParentA, party: false, answersJson: """{"deed_0":"A"}"""));
        query.Forms.Add(NewForm(ChildA1, party: true, answersJson: """{"survey_0":"B"}"""));

        var dto = await new CaseStudyFormBatchReadService(query)
            .GetForParentsAsync([ParentA, ParentB], Staff);

        Assert.Equal(2, dto.ByParentTaskId.Count);

        var a = dto.ByParentTaskId[ParentA.ToString()];
        Assert.Equal("draft", a.Parent.Status);
        Assert.Equal("A", a.Parent.Answers["deed_0"]?.ToString());
        Assert.Equal(2, a.PartyFormsByChildTaskId.Count);
        Assert.Equal("B", a.PartyFormsByChildTaskId[ChildA1.ToString()].Answers["survey_0"]?.ToString());
        // A child task with no saved row comes back as the unsaved empty form — same as the single GET.
        Assert.Equal("new", a.PartyFormsByChildTaskId[ChildA2.ToString()].Status);
        Assert.Equal(ChildA2.ToString(), a.PartyFormsByChildTaskId[ChildA2.ToString()].TaskId);

        var b = dto.ByParentTaskId[ParentB.ToString()];
        Assert.Equal("new", b.Parent.Status);
        Assert.Equal(ParentB.ToString(), b.Parent.TaskId);
        Assert.Equal(PropertyId.ToString(), b.Parent.PropertyId);
        Assert.Single(b.PartyFormsByChildTaskId);
    }

    [Fact]
    public async Task Party_sees_its_parent_and_own_child_but_not_the_sibling()
    {
        var query = new FakeBatchQuery();
        SeedTasks(query.Tasks);
        query.Forms.Add(NewForm(ChildA1, party: true));
        query.Forms.Add(NewForm(ChildA2, party: true));

        var dto = await new CaseStudyFormBatchReadService(query)
            .GetForParentsAsync([ParentA, ParentB], PartyA1);

        var a = Assert.Single(dto.ByParentTaskId).Value;
        Assert.Equal(ParentA.ToString(), a.ParentTaskId);
        var child = Assert.Single(a.PartyFormsByChildTaskId);
        Assert.Equal(ChildA1.ToString(), child.Key);
    }

    [Fact]
    public async Task Unrelated_party_gets_nothing()
    {
        var query = new FakeBatchQuery();
        SeedTasks(query.Tasks);
        query.Forms.Add(NewForm(ParentA, party: false));

        var dto = await new CaseStudyFormBatchReadService(query)
            .GetForParentsAsync([ParentA, ParentB], Outsider);

        Assert.Empty(dto.ByParentTaskId);
        Assert.Empty(query.FormReads);
    }

    [Fact]
    public async Task Unknown_and_duplicate_ids_are_dropped_and_read_only_once()
    {
        var query = new FakeBatchQuery();
        SeedTasks(query.Tasks);

        var dto = await new CaseStudyFormBatchReadService(query)
            .GetForParentsAsync([ParentA, ParentA, Unknown, Guid.Empty], Staff);

        Assert.Single(dto.ByParentTaskId);
        Assert.True(dto.ByParentTaskId.ContainsKey(ParentA.ToString()));
        Assert.Equal(1, query.FamilyReads);
        var read = Assert.Single(query.FormReads);
        Assert.Equal([ParentA], read.Parents);
        Assert.Equal(new HashSet<Guid> { ChildA1, ChildA2 }, read.Children.ToHashSet());
    }

    [Fact]
    public async Task Empty_request_makes_no_read()
    {
        var query = new FakeBatchQuery();

        var dto = await new CaseStudyFormBatchReadService(query).GetForParentsAsync([], Staff);

        Assert.Empty(dto.ByParentTaskId);
        Assert.Equal(0, query.FamilyReads);
    }

    [Fact]
    public async Task Over_the_cap_is_rejected_before_any_read()
    {
        var query = new FakeBatchQuery();
        var ids = Enumerable.Range(0, CaseStudyFormBatchReadService.MaxParentTaskIds + 1)
            .Select(_ => Guid.NewGuid())
            .ToList();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            new CaseStudyFormBatchReadService(query).GetForParentsAsync(ids, Staff));
        Assert.Equal(0, query.FamilyReads);
    }

    [Fact]
    public async Task Matches_the_single_item_read_row_for_row()
    {
        // Same in-memory store, same actor: the batch must return exactly what N single GETs would.
        await using var contexts = TestDatabases.Create("case-study-form-batch");
        var db = contexts.CaseStudy;
        db.WorkflowTasks.AddRange(SeedTasks(new List<WorkflowTask>()));
        db.CaseStudyForms.AddRange(
            NewForm(ParentA, party: false, answersJson: """{"deed_0":"A","deed_1":"NA"}"""),
            NewForm(ChildA1, party: true, answersJson: """{"survey_0":"B"}"""),
            NewForm(ChildA2, party: true, answersJson: """{"comp_0":"A"}"""),
            NewForm(ChildB1, party: true));
        db.SaveChanges();

        var single = new CaseStudyFormService(
            new CaseStudyFormRepository(db),
            TestInspectorFeeServiceFactory.CreateWorkflow(db));
        var batch = new CaseStudyFormBatchReadService(new CaseStudyFormBatchQueryService(db));

        foreach (var actor in new[] { Staff, PartyA1, Outsider })
        {
            var dto = await batch.GetForParentsAsync([ParentA, ParentB, Unknown], actor);

            foreach (var parentId in new[] { ParentA, ParentB, Unknown })
            {
                var expected = await single.GetAsync(parentId, party: false, actor);
                var found = dto.ByParentTaskId.TryGetValue(parentId.ToString(), out var item);
                Assert.Equal(expected is not null, found);
                if (expected is null) continue;

                Assert.Equal(expected.Status, item!.Parent.Status);
                Assert.Equal(expected.Answers.Keys.Order(), item.Parent.Answers.Keys.Order());

                foreach (var childId in new[] { ChildA1, ChildA2, ChildB1 })
                {
                    var expectedChild = await single.GetAsync(childId, party: true, actor);
                    var childFound = item.PartyFormsByChildTaskId.TryGetValue(childId.ToString(), out var childDto);
                    var belongs = childId == ChildB1 ? parentId == ParentB : parentId == ParentA;
                    Assert.Equal(expectedChild is not null && belongs, childFound);
                    if (!childFound) continue;

                    Assert.Equal(expectedChild!.Status, childDto!.Status);
                    Assert.Equal(expectedChild.Answers.Keys.Order(), childDto.Answers.Keys.Order());
                }
            }
        }
    }

    private static List<WorkflowTask> SeedTasks(List<WorkflowTask> tasks)
    {
        tasks.AddRange(
        [
            NewTask(ParentA, WorkflowTaskKind.CaseStudyProperty, "dist-specialist", null),
            NewTask(ChildA1, WorkflowTaskKind.EngineeringSurvey, "dist-a1", ParentA),
            NewTask(ChildA2, WorkflowTaskKind.FieldInspection, "dist-a2", ParentA),
            NewTask(ParentB, WorkflowTaskKind.CaseStudyProperty, "dist-specialist", null),
            NewTask(ChildB1, WorkflowTaskKind.EngineeringSurvey, "dist-b1", ParentB),
        ]);
        return tasks;
    }

    private static WorkflowTask NewTask(
        Guid id,
        WorkflowTaskKind kind,
        string assigneeId,
        Guid? parentTaskId) =>
        WorkflowTask.Create(
            kind,
            "PO-BATCH",
            DateTime.UtcNow,
            title: kind.ToDbValue(),
            phase: WorkflowTaskPhase.Enfath,
            id: id,
            propertyId: PropertyId,
            assigneeId: assigneeId,
            parentTaskId: parentTaskId);

    private static CaseStudyForm NewForm(Guid taskId, bool party, string answersJson = "{}")
    {
        var now = DateTime.UtcNow;
        return new CaseStudyForm
        {
            Id = Guid.NewGuid(),
            TaskId = taskId,
            IsPartyForm = party,
            Status = "draft",
            AnswersJson = answersJson,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
    }

    private sealed class FakeBatchQuery : ICaseStudyFormBatchQuery
    {
        public List<WorkflowTask> Tasks { get; } = new();
        public List<CaseStudyForm> Forms { get; } = new();
        public int FamilyReads { get; private set; }
        public List<(IReadOnlyCollection<Guid> Parents, IReadOnlyCollection<Guid> Children)> FormReads { get; } = new();

        public Task<IReadOnlyList<WorkflowTask>> ListParentFamiliesAsync(
            IReadOnlyCollection<Guid> parentTaskIds,
            CancellationToken cancellationToken)
        {
            FamilyReads++;
            var childIds = Tasks
                .Where(t => t.ParentTaskId is Guid p && parentTaskIds.Contains(p))
                .Select(t => t.Id)
                .ToHashSet();
            IReadOnlyList<WorkflowTask> rows = Tasks
                .Where(t => parentTaskIds.Contains(t.Id)
                    || (t.ParentTaskId is Guid p && (parentTaskIds.Contains(p) || childIds.Contains(p))))
                .ToList();
            return Task.FromResult(rows);
        }

        public Task<IReadOnlyList<CaseStudyForm>> ListFormsAsync(
            IReadOnlyCollection<Guid> parentTaskIds,
            IReadOnlyCollection<Guid> childTaskIds,
            CancellationToken cancellationToken)
        {
            FormReads.Add((parentTaskIds, childTaskIds));
            IReadOnlyList<CaseStudyForm> rows = Forms
                .Where(f => (!f.IsPartyForm && parentTaskIds.Contains(f.TaskId))
                    || (f.IsPartyForm && childTaskIds.Contains(f.TaskId)))
                .ToList();
            return Task.FromResult(rows);
        }
    }
}
