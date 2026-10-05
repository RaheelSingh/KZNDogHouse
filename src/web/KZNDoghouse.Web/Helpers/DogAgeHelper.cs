namespace KZNDoghouse.Web.Helpers;

public static class DogAgeHelper
{
    public static string Describe(
        DateTime? dateOfBirth,
        int? estimatedAgeYears,
        DateTime? today = null,
        bool shortForm = false)
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
                return FormatMonths(months, shortForm);
            }

            return FormatYears(months / 12, shortForm);
        }

        if (estimatedAgeYears.HasValue)
        {
            return estimatedAgeYears.Value <= 0
                ? (shortForm ? "Under 1 yr" : "Under 1 year")
                : FormatYears(estimatedAgeYears.Value, shortForm);
        }

        return "Age unknown";
    }

    private static string FormatMonths(int months, bool shortForm)
    {
        if (shortForm)
        {
            return $"{months} mo";
        }

        return months == 1 ? "1 month" : $"{months} months";
    }

    private static string FormatYears(int years, bool shortForm)
    {
        if (shortForm)
        {
            return years == 1 ? "1 yr" : $"{years} yrs";
        }

        return years == 1 ? "1 year" : $"{years} years";
    }
}
