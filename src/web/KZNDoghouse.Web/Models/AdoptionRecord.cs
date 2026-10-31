using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("adoption_records")]
public class AdoptionRecord : BaseModel
{
    [PrimaryKey("id", false)] public Guid Id { get; set; }
    [Column("dog_id")] public Guid DogId { get; set; }
    [Column("adopter_name")] public string AdopterName { get; set; } = string.Empty;
    [Column("adopter_email")] public string? AdopterEmail { get; set; }
    [Column("adopter_phone")] public string AdopterPhone { get; set; } = string.Empty;
    [Column("adopter_address")] public string AdopterAddress { get; set; } = string.Empty;
    [Column("notes")] public string? Notes { get; set; }
    [Column("status")] public string Status { get; set; } = "Pending paperwork";
    [Column("adopted_at")] public DateTime? AdoptedAt { get; set; }
    [Column("returned_at")] public DateTime? ReturnedAt { get; set; }
    [Column("return_notes")] public string? ReturnNotes { get; set; }
    [Column("created_by")] public Guid? CreatedBy { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
