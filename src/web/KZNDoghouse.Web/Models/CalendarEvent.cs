using KZNDoghouse.Web.Constants;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("calendar_events")]
public class CalendarEvent : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("title")]
    public string Title { get; set; } = string.Empty;

    [Column("category")]
    public string Category { get; set; } = EventCategories.Other;

    [Column("description")]
    public string? Description { get; set; }

    [Column("location")]
    public string? Location { get; set; }

    [Column("start_at")]
    public DateTime StartAt { get; set; }

    [Column("end_at")]
    public DateTime? EndAt { get; set; }

    [Column("visibility")]
    public string Visibility { get; set; } = EventVisibilities.Internal;

    [Column("dog_id")]
    public Guid? DogId { get; set; }

    [Column("image_path")]
    public string? ImagePath { get; set; }

    [Column("image_url")]
    public string? ImageUrl { get; set; }

    [Column("volunteer_signup_enabled")]
    public bool VolunteerSignupEnabled { get; set; }

    [Column("max_volunteers")]
    public int? MaxVolunteers { get; set; }

    [Column("volunteer_start_at")]
    public DateTime? VolunteerStartAt { get; set; }

    [Column("volunteer_end_at")]
    public DateTime? VolunteerEndAt { get; set; }

    [Column("volunteer_notes")]
    public string? VolunteerNotes { get; set; }

    [Column("created_by")]
    public Guid? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}