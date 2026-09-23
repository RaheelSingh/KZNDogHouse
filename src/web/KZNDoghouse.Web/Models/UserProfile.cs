using KZNDoghouse.Web.Constants;

namespace KZNDoghouse.Web.Models;

public class UserProfile
{
    public Guid Id { get; set; }

    public Guid AuthUserId { get; set; }

    public string FirstName { get; set; } = string.Empty;

    public string LastName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Role { get; set; } = UserRoles.Public;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();
}