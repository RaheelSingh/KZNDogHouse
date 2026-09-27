using KZNDoghouse.Web.Constants;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("event_assignments")]
public class EventAssignment : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("event_id")]
    public Guid EventId { get; set; }

    [Column("profile_id")]
    public Guid ProfileId { get; set; }

    [Column("status")]
    public string Status { get; set; } = EventAssignmentStatuses.Assigned;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}