using KZNDoghouse.Web.Constants;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("fostering_records")]
public class FosteringRecord : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("dog_id")]
    public Guid DogId { get; set; }

    [Column("foster_profile_id")]
    public Guid? FosterProfileId { get; set; }

    [Column("foster_name")]
    public string? FosterName { get; set; }

    [Column("start_date")]
    public DateTime StartDate { get; set; }

    [Column("end_date")]
    public DateTime? EndDate { get; set; }

    [Column("feedback")]
    public string? Feedback { get; set; }

    [Column("status")]
    public string Status { get; set; } = FosteringRecordStatuses.Active;

    [Column("created_by")]
    public Guid? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}