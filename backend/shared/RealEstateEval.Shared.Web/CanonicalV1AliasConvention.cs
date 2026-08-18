using Microsoft.AspNetCore.Mvc.ApplicationModels;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// Registers a <c>/v1</c> alias for every unversioned MVC attribute route so
/// controllers only declare the canonical <c>api/...</c> template.
/// </summary>
public sealed class CanonicalV1AliasConvention : IApplicationModelConvention
{
    public void Apply(ApplicationModel application)
    {
        foreach (var controller in application.Controllers)
        {
            AddAliases(controller.Selectors);
            foreach (var action in controller.Actions)
                AddAliases(action.Selectors);
        }
    }

    private static void AddAliases(IList<SelectorModel> selectors)
    {
        var extras = new List<SelectorModel>();
        foreach (var selector in selectors)
        {
            var current = selector.AttributeRouteModel;
            if (current is null)
                continue;

            var alias = ApiV1Alias.ForTemplate(current.Template);
            if (alias is null)
                continue;

            if (selectors.Concat(extras).Any(s =>
                    string.Equals(s.AttributeRouteModel?.Template, alias, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            var copy = new SelectorModel(selector)
            {
                AttributeRouteModel = new AttributeRouteModel(current)
                {
                    Template = alias,
                    Name = current.Name is null ? null : current.Name + ".v1",
                },
            };
            extras.Add(copy);
        }

        foreach (var extra in extras)
            selectors.Add(extra);
    }
}
