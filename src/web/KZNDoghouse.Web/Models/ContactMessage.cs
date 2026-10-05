using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("contact_messages")]
public class ContactMessage : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("first_name")]
    public string FirstName { get; set; } = string.Empty;

    [Column("last_name")]
    public string LastName { get; set; } = string.Empty;

    [Column("email")]
    public string Email { get; set; } = string.Empty;

    [Column("phone")]
    public string? Phone { get; set; }

    [Column("topic")]
    public string Topic { get; set; } = string.Empty;

    [Column("message")]
    public string Message { get; set; } = string.Empty;

    [Column("submitted_by_user_id")]
    public Guid? SubmittedByUserId { get; set; }

    [Column("is_handled")]
    public bool IsHandled { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
