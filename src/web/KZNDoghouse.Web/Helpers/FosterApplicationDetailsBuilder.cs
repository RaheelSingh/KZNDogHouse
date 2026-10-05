using System.Text;
using KZNDoghouse.Web.Models;

namespace KZNDoghouse.Web.Helpers;

public static class FosterApplicationDetailsBuilder
{
    public static string Build(FosterApplicationFormViewModel form)
    {
        var details = new StringBuilder();

        details.AppendLine($"Home address: {form.HomeAddress.Trim()}");
        details.AppendLine($"Type of home: {form.HomeType}");
        details.AppendLine($"Garden fully fenced: {form.GardenFenced}");
        details.AppendLine($"Grass or daily walks on grass: {YesNo(form.HasGrassOrDailyWalks)}");
        details.AppendLine($"Someone home day and night: {YesNo(form.SomeoneHomeDayAndNight)}");
        details.AppendLine($"Indoor sleeping area: {YesNo(form.HasIndoorSleepingArea)}");
        details.AppendLine($"Other pets: {YesNo(form.HasOtherPets)}");
        details.AppendLine($"Children in the household: {YesNo(form.HasChildren)}");
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
