namespace KZNDoghouse.Web.Models;

public class VolunteerApplicationListItem
{
    public EventAssignment Assignment { get; set; } = null!;

    public CalendarEvent Event { get; set; } = null!;

    public string VolunteerName { get; set; } = "Volunteer";

    public int ConfirmedCount { get; set; }
}
