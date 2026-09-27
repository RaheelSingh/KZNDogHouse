using KZNDoghouse.Web.Constants;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("notifications")]
public class AppNotification : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("recipient_id")]
    public Guid RecipientId { get; set; }

    [Column("category")]
    public string Category { get; set; } = NotificationCategories.General;

    [Column("title")]
    public string Title { get; set; } = string.Empty;

    [Column("body")]
    public string? Body { get; set; }

    [Column("is_read")]
    public bool IsRead { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}