using FluentValidation;
using socihr_backend.Controllers;

namespace socihr_backend.Validators;

public class UpdateReasonRequestValidator : AbstractValidator<UpdateReasonRequest>
{
    public UpdateReasonRequestValidator()
    {
        RuleFor(x => x.Reason)
            .MaximumLength(500).WithMessage("Reason must be at most 500 characters.")
            .Matches(@"^[^<>]*$").When(x => !string.IsNullOrEmpty(x.Reason)).WithMessage("Reason contains invalid characters.");
    }
}

public class UpdateActionRequestValidator : AbstractValidator<UpdateActionRequest>
{
    public UpdateActionRequestValidator()
    {
        RuleFor(x => x.Action)
            .NotEmpty().Must(a => new[] { "like", "comment", "share" }.Contains(a.ToLower())).WithMessage("Action must be like, comment, or share.");
    }
}

public class BulkUpdateRequestValidator : AbstractValidator<BulkUpdateRequest>
{
    public BulkUpdateRequestValidator()
    {
        RuleFor(x => x.EngagementIDs).NotEmpty().WithMessage("Engagement IDs required.");
        RuleFor(x => x.Status).Must(s => s == "Completed" || s == "Missed").WithMessage("Status must be Completed or Missed.");
    }
}
