using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("dog_notes")]
public class DogNote : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("dog_id")]
    public Guid DogId { get; set; }

    [Column("author_id")]
    public Guid? AuthorId { get; set; }

    [Column("note")]
    public string Note { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}