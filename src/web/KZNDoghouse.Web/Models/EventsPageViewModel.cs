namespace KZNDoghouse.Web.Models;

public class EventsPageViewModel
{
    public PublicEventItem? Featured { get; set; }

    public IReadOnlyList<PublicEventItem> Upcoming { get; set; } =
        Array.Empty<PublicEventItem>();

    public IReadOnlyList<PublicEventItem> Past { get; set; } =
        Array.Empty<PublicEventItem>();

    public IReadOnlyList<string> Categories { get; set; } =
        Array.Empty<string>();

    public PublicEventFilter Filter { get; set; } = new();

    public int OverallCount { get; set; }

    public bool HasResults =>
        Featured != null
        || Upcoming.Count > 0
        || Past.Count > 0;
}
