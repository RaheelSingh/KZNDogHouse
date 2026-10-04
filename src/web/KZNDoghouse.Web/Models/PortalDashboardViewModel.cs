namespace KZNDoghouse.Web.Models;

public class PortalDashboardViewModel
{
    public int DogsInCareCount { get; set; }

    public int DogsInFosterCount { get; set; }

    public int DogsNeedingAttentionCount { get; set; }

    public int PendingRequestsCount { get; set; }

    public int PendingFosterApplicationsCount { get; set; }

    public int PendingAvailabilityCount { get; set; }

    public int LowStockItemCount { get; set; }

    public IReadOnlyList<CalendarEvent> TodaysEvents { get; set; } =
        Array.Empty<CalendarEvent>();

    public IReadOnlyList<Dog> DogsNeedingAttention { get; set; } =
        Array.Empty<Dog>();
}
