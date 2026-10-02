using System.Globalization;
using KZNDoghouse.Web.Helpers;

namespace KZNDoghouse.Web.Models;

public class PublicEventItem
{
    public Guid Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? Location { get; set; }

    public DateTime StartAt { get; set; }

    public DateTime? EndAt { get; set; }

    public string DateText => EventTimeHelper.FormatDate(StartAt);

    public string TimeText => EventTimeHelper.FormatTimeRange(StartAt, EndAt);

    public string MonthText => StartAt.ToString("MMM", CultureInfo.InvariantCulture);

    public string DayText => StartAt.ToString("dd", CultureInfo.InvariantCulture);

    public string FullDateText => StartAt.ToString("d MMM yyyy", CultureInfo.InvariantCulture);

    public static PublicEventItem FromEvent(CalendarEvent calendarEvent)
    {
        return new PublicEventItem
        {
            Id = calendarEvent.Id,
            Title = calendarEvent.Title,
            Category = calendarEvent.Category,
            Description = calendarEvent.Description,
            Location = calendarEvent.Location,
            StartAt = calendarEvent.StartAt,
            EndAt = calendarEvent.EndAt
        };
    }
}
