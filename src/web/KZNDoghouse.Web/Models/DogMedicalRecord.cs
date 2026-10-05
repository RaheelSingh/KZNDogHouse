using KZNDoghouse.Web.Constants;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("dog_medical_records")]
public class DogMedicalRecord : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("dog_id")]
    public Guid DogId { get; set; }

    [Column("record_type")]
    public string RecordType { get; set; } = MedicalRecordTypes.TreatmentNote;

    [Column("title")]
    public string Title { get; set; } = string.Empty;

    [Column("details")]
    public string? Details { get; set; }

    [Column("vet_name")]
    public string? VetName { get; set; }

    [Column("next_action_date")]
    public DateTime? NextActionDate { get; set; }

    [Column("status")]
    public string Status { get; set; } = MedicalRecordStatuses.Active;

    [Column("created_by")]
    public Guid? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}