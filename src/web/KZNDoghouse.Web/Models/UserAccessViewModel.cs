namespace KZNDoghouse.Web.Models;

public class UserAccessViewModel
{
    public IReadOnlyList<UserProfile> Users { get; set; } =
        Array.Empty<UserProfile>();

    public IReadOnlyList<UserProfile> PendingVolunteerRequests { get; set; } =
        Array.Empty<UserProfile>();

    public string CurrentAuthUserId { get; set; } = string.Empty;
}
