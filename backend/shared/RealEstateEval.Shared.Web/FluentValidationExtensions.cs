using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace RealEstateEval.Shared.Web;

public static class FluentValidationExtensions
{
 /// <summary>
 /// Registers the FluentValidation action filter. Hosts register their own validator
 /// assemblies with <c>AddValidatorsFromAssemblyContaining</c> (ADR 0002: Shared.Web
 /// does not scan the global Application assembly).
 /// </summary>
    public static IMvcBuilder AddRealEstateEvalValidation(this IMvcBuilder mvc)
    {
        // Built-in rule messages («must not be empty», «maximum length», …) in Arabic.
        ValidatorOptions.Global.LanguageManager.Culture = new System.Globalization.CultureInfo("ar");
        mvc.Services.AddScoped<FluentValidationActionFilter>();
        mvc.AddMvcOptions(options => options.Filters.AddService<FluentValidationActionFilter>());
        return mvc;
    }
}

internal sealed class FluentValidationActionFilter(IServiceProvider services) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values.Where(value => value is not null))
        {
            var argumentType = argument!.GetType();
            var validatorType = typeof(IValidator<>).MakeGenericType(argumentType);
            var validators = services.GetServices(validatorType).Cast<IValidator>();

            foreach (var validator in validators)
            {
                var validationContextType = typeof(ValidationContext<>).MakeGenericType(argumentType);
                var validationContext = (IValidationContext)Activator.CreateInstance(
                    validationContextType,
                    argument)!;
                ValidationResult result = await validator.ValidateAsync(
                    validationContext,
                    context.HttpContext.RequestAborted);

                foreach (var error in result.Errors)
                    context.ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            }
        }

        if (!context.ModelState.IsValid)
        {
            // Same Arabic 400 as the automatic model-state filter (title, detail, legacy members).
            context.Result = ArabicInvalidModelState.Create(context);
            return;
        }

        await next();
    }
}
