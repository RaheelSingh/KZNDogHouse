namespace KZNDoghouse.Web.Helpers;

public static class DogAgeHelper
{
    public static string Describe(
        DateTime? dateOfBirth,
        int? estimatedAgeYears,
        DateTime? today = null)
    {
        if (dateOfBirth.HasValue)
        {
            var now = (today ?? DateTime.UtcNow).Date;
            var born = dateOfBirth.Value.Date;

            var months = ((now.Year - born.Year) * 12) + now.Month - born.Month;

            if (now.Day < born.Day)
            {
                months--;
            }

            if (months < 0)
            {
                months = 0;
            }

            if (months < 12)
            {
                return months == 1 ? "1 month" : $"{months} months";
            }

            return FormatYears(months / 12);
        }

        if (estimatedAgeYears.HasValue)
        {
            return estimatedAgeYears.Value <= 0
                ? "Under 1 year"
                : FormatYears(estimatedAgeYears.Value);
        }

        return "Age unknown";
    }

    private static string FormatYears(int years)
    {
        return years == 1 ? "1 year" : $"{years} years";
    }
}
