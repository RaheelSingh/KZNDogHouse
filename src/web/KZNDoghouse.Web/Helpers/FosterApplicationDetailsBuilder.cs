using System.Text;
using KZNDoghouse.Web.Models;

namespace KZNDoghouse.Web.Helpers;

public static class FosterApplicationDetailsBuilder
{
    public static string Build(FosterApplicationFormViewModel form)
    {
        var details = new StringBuilder();

        details.AppendLine($"Home address: {form.HomeAddress.Trim()}");
        if (!form.DogId.HasValue)
            details.AppendLine($"Dog sizes: {string.Join(", ", form.SizePreferences)}");
        details.AppendLine($"Foster period: {form.FosterPeriod}");
        details.AppendLine();
        details.AppendLine("Why I would like to foster:");
        details.Append(form.Motivation.Trim());

        return details.ToString();
    }

    private static string YesNo(bool? value)
    {
        return value == true ? "Yes" : "No";
    }
}
