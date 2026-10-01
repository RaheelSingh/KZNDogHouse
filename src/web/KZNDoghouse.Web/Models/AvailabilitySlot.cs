using KZNDoghouse.Web.Constants;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("availability_slots")]
public class AvailabilitySlot : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("volunteer_id")]
    public Guid VolunteerId { get; set; }

    [Column("week_start")]
    public DateTime WeekStart { get; set; }

    [Column("day_date")]
    public DateTime DayDate { get; set; }

    [Column("slot")]
    public string Slot { get; set; } = AvailabilitySlotNames.Morning;

    [Column("status")]
    public string Status { get; set; } = AvailabilitySlotStatuses.Pending;

    [Column("submitted_at")]
    public DateTime SubmittedAt { get; set; }

    [Column("reviewed_by")]
    public Guid? ReviewedBy { get; set; }

    [Column("reviewed_at")]
    public DateTime? ReviewedAt { get; set; }
}