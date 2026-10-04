using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("vet_profiles")]
public class VetProfile : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_profile_id")]
    public Guid UserProfileId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
