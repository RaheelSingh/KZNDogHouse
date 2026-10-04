using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("dog_images")]
public class DogImage : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("dog_id")]
    public Guid DogId { get; set; }

    [Column("storage_path")]
    public string StoragePath { get; set; } = string.Empty;

    [Column("public_url")]
    public string PublicUrl { get; set; } = string.Empty;

    [Column("is_primary")]
    public bool IsPrimary { get; set; }

    [Column("sort_order")]
    public int SortOrder { get; set; }

    [Column("alt_text")]
    public string? AltText { get; set; }

    [Column("created_by")]
    public Guid? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
