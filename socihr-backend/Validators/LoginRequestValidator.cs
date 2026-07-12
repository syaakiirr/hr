using FluentValidation;
using socihr_backend.Controllers;

namespace socihr_backend.Validators;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Username diperlukan.")
            .MinimumLength(3).WithMessage("Username sekurang-kurangnya 3 aksara.");
            
        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password diperlukan.")
            .MinimumLength(4).WithMessage("Password sekurang-kurangnya 4 aksara.");
    }
}
