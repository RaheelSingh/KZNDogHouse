using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("dog_videos")]
public class DogVideo : BaseModel
{
    [PrimaryKey("id", false)] public Guid Id { get; set; }
    [Column("dog_id")] public Guid DogId { get; set; }
    [Column("storage_path")] public string StoragePath { get; set; } = string.Empty;
    [Column("public_url")] public string PublicUrl { get; set; } = string.Empty;
    [Column("content_type")] public string ContentType { get; set; } = string.Empty;
    [Column("created_at")] public DateTime CreatedAt { get; set; }
}
