using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Validation;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class BoundaryRequestValidatorTests
{
    [Fact]
    public void Login_rejects_blank_credentials()
    {
        var result = new PasswordLoginRequestValidator().Validate(new PasswordLoginRequest());

        Assert.Contains(result.Errors, error => error.PropertyName == "username");
        Assert.Contains(result.Errors, error => error.PropertyName == "password");
    }

    [Fact]
    public void Activation_rejects_missing_ticket_and_password()
    {
        var result = new ActivateAccountRequestValidator().Validate(new ActivateAccountRequest());

        Assert.Contains(result.Errors, error => error.PropertyName == "userName");
        Assert.Contains(result.Errors, error => error.PropertyName == "token");
        Assert.Contains(result.Errors, error => error.PropertyName == "newPassword");
    }

    [Fact]
    public void Refresh_rejects_blank_token() =>
        Assert.False(new RefreshTokenRequestValidator()
            .Validate(new RefreshTokenRequest())
            .IsValid);

    [Fact]
    public void Staff_create_rejects_invalid_email()
    {
        var request = new CreateStaffUserRequest
        {
            DisplayName = "Test User",
            Email = "not-an-email",
            Mobile = "0500000011",
            City = "الرياض",
            NationalId = "1000000018",
            RoleId = "case-study-specialist",
        };

        var result = new CreateStaffUserRequestValidator().Validate(request);

        Assert.Contains(result.Errors, error => error.PropertyName == "email");
    }

    [Fact]
    public void Staff_create_enforces_unified_identity_and_compensation_fields()
    {
        var request = new CreateStaffUserRequest
        {
            DisplayName = "Test Inspector",
            Email = "inspector@example.test",
            Mobile = "123",
            City = "الرياض",
            NationalId = "300",
            RoleId = "field-inspector",
            HasCompensation = true,
            Iban = "SA-invalid",
            AvatarUrl = "javascript:alert(1)",
        };

        var result = new CreateStaffUserRequestValidator().Validate(request);

        foreach (var property in new[]
                 {
                     "mobile",
                     "nationalId",
                     "inspectorType",
                     "feeValueSar",
                     "iban",
                     "avatarUrl",
                 })
        {
            Assert.Contains(result.Errors, error => error.PropertyName == property);
        }
    }

    [Fact]
    public void Staff_create_accepts_a_complete_unified_profile()
    {
        var request = new CreateStaffUserRequest
        {
            DisplayName = "Test Inspector",
            Email = "inspector@example.test",
            Mobile = "0500000011",
            City = "الرياض",
            NationalId = "1000000018",
            RoleId = "field-inspector",
            InspectorType = "contractor",
            HasCompensation = true,
            FeeValueSar = 450,
            Iban = "SA0380000000608010167519",
            AvatarUrl = "https://example.test/avatar.png",
        };

        Assert.True(new CreateStaffUserRequestValidator().Validate(request).IsValid);
    }

    [Fact]
    public void Staff_update_accepts_an_empty_body_because_every_member_is_optional() =>
        Assert.True(new UpdateStaffUserRequestValidator()
            .Validate(new UpdateStaffUserRequest())
            .IsValid);

    [Fact]
    public void Staff_update_still_checks_the_shape_of_the_members_it_receives()
    {
        var result = new UpdateStaffUserRequestValidator().Validate(new UpdateStaffUserRequest
        {
            DisplayName = "",
            Email = "not-an-email",
            Mobile = "12345",
            City = "",
            NationalId = "3000000001",
            Iban = "SA1",
            FeeValueSar = -1,
            AvatarUrl = "javascript:alert(1)",
            Status = UserStatus.PendingActivation,
        });

        Assert.Contains(result.Errors, error => error.PropertyName == "displayName");
        Assert.Contains(result.Errors, error => error.PropertyName == "email");
        Assert.Contains(result.Errors, error => error.PropertyName == "mobile");
        Assert.Contains(result.Errors, error => error.PropertyName == "city");
        Assert.Contains(result.Errors, error => error.PropertyName == "nationalId");
        Assert.Contains(result.Errors, error => error.PropertyName == "iban");
        Assert.Contains(result.Errors, error => error.PropertyName == "feeValueSar");
        Assert.Contains(result.Errors, error => error.PropertyName == "avatarUrl");
        Assert.Contains(result.Errors, error => error.PropertyName == "status");
    }

    [Fact]
    public void Staff_update_lets_an_empty_string_clear_an_optional_field()
    {
        var result = new UpdateStaffUserRequestValidator().Validate(new UpdateStaffUserRequest
        {
            Department = "",
            Iban = "",
            TaxNumber = "",
            InspectorType = "",
            AvatarUrl = "",
            Status = UserStatus.Disabled,
        });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Activation_ticket_rejects_blank_user_id() =>
        Assert.False(new IssueActivationTicketRequestValidator()
            .Validate(new IssueActivationTicketRequest())
            .IsValid);

    [Fact]
    public void Attachment_rejects_missing_metadata_and_content()
    {
        var result = new UploadAttachmentRequestValidator().Validate(new UploadAttachmentRequest());

        Assert.Contains(result.Errors, error => error.PropertyName == "scope");
        Assert.Contains(result.Errors, error => error.PropertyName == "scopeKey");
        Assert.Contains(result.Errors, error => error.PropertyName == "fileName");
        Assert.Contains(result.Errors, error => error.PropertyName == "contentBase64");
    }

    [Fact]
    public void Work_order_create_reuses_critical_write_rules()
    {
        var result = new CreateWorkOrderRequestValidator().Validate(new CreateWorkOrderRequest
        {
            AssignmentType = "invalid",
            PromulgationDate = "invalid",
            ExpectedPropertyCount = 0,
        });

        Assert.Contains(result.Errors, error => error.PropertyName == "poNumber");
        Assert.Contains(result.Errors, error => error.PropertyName == "assignmentType");
        Assert.Contains(result.Errors, error => error.PropertyName == "promulgationDate");
        Assert.Contains(result.Errors, error => error.PropertyName == "expectedPropertyCount");
        Assert.Contains(result.Errors, error => error.PropertyName == "clientId");
    }

    [Fact]
    public void Create_operations_task_rejects_blank_required_fields()
    {
        var result = new CreateOperationsTaskRequestValidator()
            .Validate(new CreateOperationsTaskRequest());

        Assert.Contains(result.Errors, e => e.PropertyName == "type");
        Assert.Contains(result.Errors, e => e.PropertyName == "title");
        Assert.Contains(result.Errors, e => e.PropertyName == "assigneeId");
    }

    [Fact]
    public void Create_key_envelope_rejects_unknown_scenario()
    {
        var result = new CreateKeyEnvelopeRequestValidator().Validate(new CreateKeyEnvelopeRequest
        {
            RequestNumber = "R-1",
            Court = "Court",
            Circuit = "C1",
            ReceiveScenario = "unknown",
        });

        Assert.Contains(result.Errors, e => e.PropertyName == "receiveScenario");
    }

    [Fact]
    public void Create_failure_rejects_blank_core_fields()
    {
        var result = new CreateFailureRequestValidator().Validate(new CreateFailureRequest());

        Assert.Contains(result.Errors, e => e.PropertyName == "poNumber");
        Assert.Contains(result.Errors, e => e.PropertyName == "propertyId");
        Assert.Contains(result.Errors, e => e.PropertyName == "problemTypeId");
    }

    [Fact]
    public void Bourse_obstruction_rejects_blank_core_fields()
    {
        var result = new BourseObstructionRequestValidator().Validate(new BourseObstructionRequest());

        Assert.Contains(result.Errors, e => e.PropertyName == "poNumber");
        Assert.Contains(result.Errors, e => e.PropertyName == "propertyId");
        Assert.Contains(result.Errors, e => e.PropertyName == "reason");
    }

    [Fact]
    public void Court_create_rejects_blank_name_and_city()
    {
        var result = new CreateCourtRequestValidator().Validate(new CreateCourtRequest());

        Assert.Contains(result.Errors, e => e.PropertyName == "name");
        Assert.Contains(result.Errors, e => e.PropertyName == "region");
        Assert.Contains(result.Errors, e => e.PropertyName == "city");
    }

    [Fact]
    public void Confirm_key_assignment_rejects_unknown_status()
    {
        var result = new ConfirmKeyAssignmentRequestValidator().Validate(
            new ConfirmKeyAssignmentRequest { Status = "pending" });

        Assert.Contains(result.Errors, e => e.PropertyName == "status");
    }

    [Fact]
    public void Key_handoff_rejects_unknown_kind()
    {
        var result = new CreateKeyEnvelopeHandoffRequestValidator().Validate(
            new CreateKeyEnvelopeHandoffRequest
            {
                Kind = "lost",
                FromParty = "court",
                ToParty = "reviewer",
            });

        Assert.Contains(result.Errors, e => e.PropertyName == "kind");
    }

    [Fact]
    public void Client_upsert_rejects_invalid_email()
    {
        var result = new UpsertClientRequestValidator().Validate(new UpsertClientRequest
        {
            NameAr = "عميل",
            Email = "not-an-email",
        });

        Assert.Contains(result.Errors, e => e.PropertyName == "email");
    }

    [Fact]
    public void Inspection_limits_reject_unknown_scope()
    {
        var result = new SaveInspectionLimitsRequestValidator().Validate(
            new SaveInspectionLimitsRequest { InspectionScopeKey = "drive-by" });

        Assert.Contains(result.Errors, e => e.PropertyName == "inspectionScopeKey");
    }

    [Fact]
    public void Fee_pricing_create_rejects_unknown_category()
    {
        var result = new CreatePartyFeePricingTableRequestValidator().Validate(
            new CreatePartyFeePricingTableRequest { Category = "unknown", Name = "جدول" });

        Assert.Contains(result.Errors, e => e.PropertyName == "category");
    }

    [Fact]
    public void Organization_settings_reject_out_of_range_sla()
    {
        var result = new SaveOrganizationSettingsRequestValidator().Validate(
            new SaveOrganizationSettingsRequest
            {
                Sla = new OrganizationSlaSettingsDto { DefaultBusinessDays = 0 },
            });

        Assert.Contains(result.Errors, e => e.PropertyName == "sla.defaultBusinessDays");
    }

    [Fact]
    public void Test_communication_rejects_unknown_channel()
    {
        var result = new TestCommunicationRequestValidator().Validate(
            new TestCommunicationRequest { Channel = "pigeon", Destination = "0500000011" });

        Assert.Contains(result.Errors, e => e.PropertyName == "channel");
    }

    [Fact]
    public void Ops_comment_rejects_empty_text_without_files()
    {
        var result = new AddOperationsTaskCommentRequestValidator()
            .Validate(new AddOperationsTaskCommentRequest());

        Assert.Contains(result.Errors, e => e.PropertyName == "text");
    }

    [Fact]
    public void Reassign_ops_task_requires_assignee_and_reason()
    {
        var result = new ReassignOperationsTaskRequestValidator()
            .Validate(new ReassignOperationsTaskRequest());

        Assert.Contains(result.Errors, e => e.PropertyName == "assigneeId");
        Assert.Contains(result.Errors, e => e.PropertyName == "reason");
    }

    [Fact]
    public void Close_party_billing_statement_rejects_blank_required_refs()
    {
        var result = new ClosePartyBillingStatementRequestValidator().Validate(
            new ClosePartyBillingStatementRequest
            {
                DisbursementVoucher = "",
                TransferReference = "",
                TransferReceiptAttachmentId = "",
            });

        Assert.Contains(result.Errors, e => e.PropertyName == "disbursementVoucher");
        Assert.Contains(result.Errors, e => e.PropertyName == "transferReference");
        Assert.Contains(result.Errors, e => e.PropertyName == "transferReceiptAttachmentId");
    }

    [Fact]
    public void Create_party_billing_statement_caps_task_id_count_and_length()
    {
        var tooMany = new CreatePartyBillingStatementRequestValidator().Validate(
            new CreatePartyBillingStatementRequest
            {
                WorkflowTaskIds = Enumerable.Range(0, 501).Select(i => $"t-{i}").ToList(),
            });
        Assert.Contains(tooMany.Errors, e => e.PropertyName == "workflowTaskIds");

        var tooLong = new CreatePartyBillingStatementRequestValidator().Validate(
            new CreatePartyBillingStatementRequest
            {
                WorkflowTaskIds = [new string('x', 65)],
            });
        Assert.Contains(tooLong.Errors, e => e.PropertyName.StartsWith("workflowTaskIds"));

        var ok = new CreatePartyBillingStatementRequestValidator().Validate(
            new CreatePartyBillingStatementRequest { WorkflowTaskIds = ["task-1"] });
        Assert.Empty(ok.Errors);
    }

    [Fact]
    public void Save_po_enfaz_billing_validates_nested_lines()
    {
        var result = new SavePoEnfazBillingRequestValidator().Validate(
            new SavePoEnfazBillingRequest
            {
                Lines = [new PoEnfazRevenueLineInput { PropertyId = "" }],
            });

        Assert.Contains(result.Errors, e => e.PropertyName.Contains("propertyId"));

        var ok = new SavePoEnfazBillingRequestValidator().Validate(
            new SavePoEnfazBillingRequest
            {
                Lines = [new PoEnfazRevenueLineInput { PropertyId = "prop-1" }],
            });
        Assert.Empty(ok.Errors);
    }

    [Fact]
    public void Cancel_and_reject_billing_require_a_reason()
    {
        Assert.Contains(
            new CancelPartyBillingStatementRequestValidator()
                .Validate(new CancelPartyBillingStatementRequest { Reason = "" }).Errors,
            e => e.PropertyName == "reason");
        Assert.Contains(
            new RejectVendorInvoiceRequestValidator()
                .Validate(new RejectVendorInvoiceRequest { Reason = "" }).Errors,
            e => e.PropertyName == "reason");
    }
}
