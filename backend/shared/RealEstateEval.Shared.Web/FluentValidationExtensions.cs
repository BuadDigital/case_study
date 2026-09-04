using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Validation;

namespace RealEstateEval.Shared.Web;

public static class FluentValidationExtensions
{
 /// <summary>
 /// Registers the intentionally small set of boundary validators and runs them for
 /// controller action arguments. Async validation is supported without relying on
 /// the deprecated FluentValidation.AspNetCore package.
 /// </summary>
    public static IMvcBuilder AddRealEstateEvalValidation(this IMvcBuilder mvc)
    {
        mvc.Services.AddValidatorsFromAssemblyContaining<UsernameLoginRequestValidator>();
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
            context.Result = new BadRequestObjectResult(new ValidationProblemDetails(context.ModelState)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more validation errors occurred.",
            });
            return;
        }

        await next();
    }
}
