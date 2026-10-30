using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

// Paths are internal. Documents are never served through public media URLs.
[Table("dog_documents")]
public class DogDocument : BaseModel
{
    [PrimaryKey("id", false)] public Guid Id { get; set; }
    [Column("dog_id")] public Guid DogId { get; set; }
    [Column("foster_application_id")] public Guid? FosterApplicationId { get; set; }
    [Column("medical_record_id")] public Guid? MedicalRecordId { get; set; }
    [Column("category")] public string Category { get; set; } = "Medical";
    [Column("file_name")] public string FileName { get; set; } = string.Empty;
    [Column("content_type")] public string ContentType { get; set; } = string.Empty;
    [Column("storage_path")] public string StoragePath { get; set; } = string.Empty;
    [Column("uploaded_by")] public Guid? UploadedBy { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
