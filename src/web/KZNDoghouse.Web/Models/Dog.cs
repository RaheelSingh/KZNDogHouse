using KZNDoghouse.Web.Constants;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("dogs")]
public class Dog : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("breed")]
    public string? Breed { get; set; }

    [Column("date_of_birth")]
    public DateTime? DateOfBirth { get; set; }

    [Column("estimated_age_years")]
    public int? EstimatedAgeYears { get; set; }

    [Column("gender")]
    public string Gender { get; set; } = DogGenders.Unknown;

    [Column("size")]
    public string? Size { get; set; }

    [Column("weight_kg")]
    public decimal? WeightKg { get; set; }

    [Column("eye_colour")]
    public string? EyeColour { get; set; }

    [Column("temperament")]
    public string? Temperament { get; set; }

    [Column("about")]
    public string? About { get; set; }

    [Column("kennel_location")]
    public string? KennelLocation { get; set; }

    [Column("intake_date")]
    public DateTime IntakeDate { get; set; }

    [Column("intake_type")]
    public string? IntakeType { get; set; }

    [Column("status")]
    public string Status { get; set; } = DogStatuses.InCare;

    [Column("is_vaccinated")]
    public bool IsVaccinated { get; set; }

    [Column("photo_url")]
    public string? PhotoUrl { get; set; }

    [Column("created_by")]
    public Guid? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}