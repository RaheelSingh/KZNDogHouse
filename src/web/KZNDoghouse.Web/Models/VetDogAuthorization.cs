using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("vet_dog_authorizations")]
public class VetDogAuthorization : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("vet_profile_id")]
    public Guid VetProfileId { get; set; }

    [Column("dog_id")]
    public Guid DogId { get; set; }

    [Column("authorized_by_profile_id")]
    public Guid? AuthorizedByProfileId { get; set; }

    [Column("authorized_at")]
    public DateTime AuthorizedAt { get; set; }
}
