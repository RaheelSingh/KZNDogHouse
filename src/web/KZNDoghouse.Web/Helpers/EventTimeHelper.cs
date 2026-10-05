using System.Globalization;

namespace KZNDoghouse.Web.Helpers;

public static class EventTimeHelper
{
    public static string FormatDate(DateTime date)
    {
        return date.ToString("ddd, d MMMM", CultureInfo.InvariantCulture);
    }

    public static string FormatTime(DateTime time)
    {
        var text = time.ToString(
            time.Minute == 0 ? "%h" : "h:mm",
            CultureInfo.InvariantCulture);

        return text + (time.Hour < 12 ? "am" : "pm");
    }

    public static string FormatTimeRange(DateTime start, DateTime? end)
    {
        var startText = FormatTime(start);

        if (!end.HasValue
            || end.Value <= start
            || end.Value.Date != start.Date)
        {
            return startText;
        }

        return $"{startText}–{FormatTime(end.Value)}";
    }
}
