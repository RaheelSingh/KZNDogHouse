using KZNDoghouse.Web.Constants;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("user_profiles")]
public class UserProfile : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("auth_user_id")]
    public Guid AuthUserId { get; set; }

    [Column("first_name")]
    public string FirstName { get; set; } = string.Empty;

    [Column("last_name")]
    public string LastName { get; set; } = string.Empty;

    [Column("email")]
    public string Email { get; set; } = string.Empty;

    [Column("role")]
    public string Role { get; set; } = UserRoles.Public;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();
}