namespace KZNDoghouse.Web.Models;

public class GetInvolvedViewModel
{
    public IReadOnlyList<PublicEventItem> UpcomingEvents { get; set; } =
        Array.Empty<PublicEventItem>();
}
