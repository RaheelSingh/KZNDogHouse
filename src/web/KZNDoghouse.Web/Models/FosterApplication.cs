using KZNDoghouse.Web.Constants;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("foster_applications")]
public class FosterApplication : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("applicant_user_id")]
    public Guid? ApplicantUserId { get; set; }

    [Column("applicant_name")]
    public string ApplicantName { get; set; } = string.Empty;

    [Column("applicant_email")]
    public string ApplicantEmail { get; set; } = string.Empty;

    [Column("applicant_phone")]
    public string? ApplicantPhone { get; set; }

    [Column("dog_id")]
    public Guid? DogId { get; set; }

    [Column("application_details")]
    public string? ApplicationDetails { get; set; }

    [Column("status")]
    public string Status { get; set; } = FosterApplicationStatuses.Submitted;

    [Column("submitted_at")]
    public DateTime SubmittedAt { get; set; }

    [Column("reviewed_by_staff_id")]
    public Guid? ReviewedByStaffId { get; set; }

    [Column("reviewed_at")]
    public DateTime? ReviewedAt { get; set; }

    [Column("rejection_reason")]
    public string? RejectionReason { get; set; }

    [Column("fostering_record_id")]
    public Guid? FosteringRecordId { get; set; }
}