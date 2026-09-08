using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Application.Tests;

public class KeyEnvelopeRegistrationRulesTests
{
    private static readonly DateTime Now = new(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc);

    private static CreateKeyEnvelopeRequest CourtRequest(
        string requestNumber = "REQ-1",
        string court = "المحكمة",
        string circuit = "الدائرة",
        int keysCountActual = 2,
        Guid? photo = null,
        Guid? receipt = null) => new()
        {
            RequestNumber = requestNumber,
            Court = court,
            Circuit = circuit,
            KeysCountLabeled = 2,
            KeysCountActual = keysCountActual,
            ReceiveScenario = KeyReceiveScenarios.Court,
            PhotoAttachmentId = photo ?? Guid.NewGuid(),
            ReceiptAttachmentId = receipt ?? Guid.NewGuid(),
        };

    [Theory]
    [InlineData("  ", "c", "d", "رقم الطلب مطلوب")]
    [InlineData("r", "  ", "d", "المحكمة مطلوبة")]
    [InlineData("r", "c", "", "الدائرة مطلوبة")]
    public void ValidateRegistration_RequiresHeaderFields(
        string requestNumber, string court, string circuit, string expected)
    {
        var error = KeyEnvelopeRegistrationRules.ValidateRegistration(
            CourtRequest(requestNumber, court, circuit),
            KeyReceiveScenarios.Court);

        Assert.Equal(expected, error);
    }

    [Fact]
    public void ValidateRegistration_CourtScenario_RequiresCountPhotoAndReceipt()
    {
        Assert.Equal(
            "عدد المفاتيح الفعلي يجب أن يكون 1 على الأقل",
            KeyEnvelopeRegistrationRules.ValidateRegistration(
                CourtRequest(keysCountActual: 0), KeyReceiveScenarios.Court));
        Assert.Equal(
            "صورة الظرف مطلوبة",
            KeyEnvelopeRegistrationRules.ValidateRegistration(
                CourtRequest(photo: Guid.Empty), KeyReceiveScenarios.Court));
        Assert.Equal(
            "خطاب الاستلام مطلوب",
            KeyEnvelopeRegistrationRules.ValidateRegistration(
                CourtRequest(receipt: Guid.Empty), KeyReceiveScenarios.Court));
        Assert.Null(
            KeyEnvelopeRegistrationRules.ValidateRegistration(
                CourtRequest(), KeyReceiveScenarios.Court));
    }

    [Fact]
    public void ValidateRegistration_MissingScenario_RequiresContactPhones()
    {
        var request = new CreateKeyEnvelopeRequest
        {
            RequestNumber = "r",
            Court = "c",
            Circuit = "d",
            ReceiveScenario = KeyReceiveScenarios.Missing,
        };

        Assert.Equal(
            "أرقام التواصل مطلوبة عندما تكون المفاتيح غير موجودة",
            KeyEnvelopeRegistrationRules.ValidateRegistration(request, KeyReceiveScenarios.Missing));

        var withPhones = new CreateKeyEnvelopeRequest
        {
            RequestNumber = "r",
            Court = "c",
            Circuit = "d",
            ContactPhones = "0500000000",
        };
        Assert.Null(
            KeyEnvelopeRegistrationRules.ValidateRegistration(withPhones, KeyReceiveScenarios.Missing));
    }

    [Fact]
    public void ValidateRegistration_ThirdPartyScenario_RequiresPhonesThenLetter()
    {
        var noPhones = new CreateKeyEnvelopeRequest { RequestNumber = "r", Court = "c", Circuit = "d" };
        Assert.Equal(
            "بيانات الطرف المسلِّم مطلوبة",
            KeyEnvelopeRegistrationRules.ValidateRegistration(noPhones, KeyReceiveScenarios.ThirdParty));

        var noLetter = new CreateKeyEnvelopeRequest
        {
            RequestNumber = "r",
            Court = "c",
            Circuit = "d",
            ContactPhones = "0500000000",
        };
        Assert.Equal(
            "خطاب حامل المفتاح مطلوب",
            KeyEnvelopeRegistrationRules.ValidateRegistration(noLetter, KeyReceiveScenarios.ThirdParty));

        var complete = new CreateKeyEnvelopeRequest
        {
            RequestNumber = "r",
            Court = "c",
            Circuit = "d",
            ContactPhones = "0500000000",
            ThirdPartyLetterAttachmentId = Guid.NewGuid(),
        };
        Assert.Null(
            KeyEnvelopeRegistrationRules.ValidateRegistration(complete, KeyReceiveScenarios.ThirdParty));
    }

    [Fact]
    public void AttachmentsToVerify_ListsPresentIdsInReceiptPhotoLetterOrder()
    {
        var receipt = Guid.NewGuid();
        var letter = Guid.NewGuid();
        var request = new CreateKeyEnvelopeRequest
        {
            ReceiptAttachmentId = receipt,
            PhotoAttachmentId = Guid.Empty,
            ThirdPartyLetterAttachmentId = letter,
        };

        var items = KeyEnvelopeRegistrationRules.AttachmentsToVerify(request);

        Assert.Equal(2, items.Count);
        Assert.Equal((receipt, "ملف خطاب الاستلام غير موجود"), items[0]);
        Assert.Equal((letter, "ملف خطاب الطرف الثالث غير موجود"), items[1]);
        Assert.Empty(KeyEnvelopeRegistrationRules.AttachmentsToVerify(new CreateKeyEnvelopeRequest()));
    }

    [Fact]
    public void EmptyToNull_And_HasAttachment_TreatEmptyGuidAsAbsent()
    {
        var id = Guid.NewGuid();

        Assert.Null(KeyEnvelopeRegistrationRules.EmptyToNull(null));
        Assert.Null(KeyEnvelopeRegistrationRules.EmptyToNull(Guid.Empty));
        Assert.Equal(id, KeyEnvelopeRegistrationRules.EmptyToNull(id));
        Assert.False(KeyEnvelopeRegistrationRules.HasAttachment(null));
        Assert.False(KeyEnvelopeRegistrationRules.HasAttachment(Guid.Empty));
        Assert.True(KeyEnvelopeRegistrationRules.HasAttachment(id));
    }

    [Fact]
    public void IsDeedAlreadyAssigned_IgnoresCase()
    {
        var envelope = KeyEnvelope.Create(
            Guid.NewGuid(), "REQ-1", "c", "d", 1, 1,
            KeyReceiveScenarios.Court, "u1", "Actor", Now);
        envelope.AddPendingAssignment(Guid.NewGuid(), "Deed-9", null, null, Now);

        Assert.True(KeyEnvelopeRegistrationRules.IsDeedAlreadyAssigned(envelope, "deed-9"));
        Assert.False(KeyEnvelopeRegistrationRules.IsDeedAlreadyAssigned(envelope, "deed-10"));
    }

    [Theory]
    [InlineData(KeyHandoffKinds.Internal, true)]
    [InlineData(KeyHandoffKinds.External, true)]
    [InlineData(KeyHandoffKinds.ReceiveBack, true)]
    [InlineData(KeyHandoffKinds.ReturnCourt, true)]
    [InlineData("courier", false)]
    [InlineData("", false)]
    public void IsKnownHandoffKind_AcceptsOnlyTheFourKinds(string kind, bool expected) =>
        Assert.Equal(expected, KeyEnvelopeRegistrationRules.IsKnownHandoffKind(kind));

    [Fact]
    public void HandoffKind_DrivesLetterRequirementAndInitialStatus()
    {
        Assert.True(KeyEnvelopeRegistrationRules.NeedsDeliveryLetter(KeyHandoffKinds.External));
        Assert.False(KeyEnvelopeRegistrationRules.NeedsDeliveryLetter(KeyHandoffKinds.Internal));
        Assert.False(KeyEnvelopeRegistrationRules.NeedsDeliveryLetter(KeyHandoffKinds.ReturnCourt));

        Assert.Equal(
            KeyHandoffStatuses.PendingConfirm,
            KeyEnvelopeRegistrationRules.InitialHandoffStatus(KeyHandoffKinds.Internal));
        Assert.Equal(
            KeyHandoffStatuses.Completed,
            KeyEnvelopeRegistrationRules.InitialHandoffStatus(KeyHandoffKinds.External));
        Assert.Equal(
            KeyHandoffStatuses.Completed,
            KeyEnvelopeRegistrationRules.InitialHandoffStatus(KeyHandoffKinds.ReceiveBack));
    }

    [Fact]
    public void ValidateHandoffConfirmation_OnlyPendingInternalHandoffs()
    {
        Assert.Equal(
            "التأكيد مطلوب للتسليم الداخلي فقط",
            KeyEnvelopeRegistrationRules.ValidateHandoffConfirmation(new KeyEnvelopeHandoff
            {
                Kind = KeyHandoffKinds.External,
                Status = KeyHandoffStatuses.PendingConfirm,
            }));
        Assert.Equal(
            "المناولة مؤكدة مسبقاً",
            KeyEnvelopeRegistrationRules.ValidateHandoffConfirmation(new KeyEnvelopeHandoff
            {
                Kind = KeyHandoffKinds.Internal,
                Status = KeyHandoffStatuses.Confirmed,
            }));
        Assert.Null(
            KeyEnvelopeRegistrationRules.ValidateHandoffConfirmation(new KeyEnvelopeHandoff
            {
                Kind = KeyHandoffKinds.Internal,
                Status = KeyHandoffStatuses.PendingConfirm,
            }));
    }
}
