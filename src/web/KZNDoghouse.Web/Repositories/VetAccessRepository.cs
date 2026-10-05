using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IVetAccessRepository
{
    Task<VetProfile?> GetVetProfileByUserProfileIdAsync(
        Guid userProfileId);

    Task<VetProfile> EnsureVetProfileAsync(
        Guid userProfileId);

    Task<IReadOnlyList<VetDogAuthorization>>
        GetAuthorizationsAsync(
            Guid vetProfileId);

    Task AddAuthorizationAsync(
        Guid vetProfileId,
        Guid dogId,
        Guid authorizedByProfileId);

    Task RemoveAuthorizationAsync(
        Guid vetProfileId,
        Guid dogId);

    Task RevokeAllForUserProfileAsync(
        Guid userProfileId);
}

public class VetAccessRepository : IVetAccessRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public VetAccessRepository(
        ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<VetProfile?>
        GetVetProfileByUserProfileIdAsync(
            Guid userProfileId)
    {
        var client =
            await _supabaseClientFactory
                .CreateServiceClientAsync();

        var response = await client
            .From<VetProfile>()
            .Where(x =>
                x.UserProfileId == userProfileId)
            .Get();

        return response.Models?.FirstOrDefault();
    }

    public async Task<VetProfile> EnsureVetProfileAsync(
        Guid userProfileId)
    {
        var existing =
            await GetVetProfileByUserProfileIdAsync(
                userProfileId);

        if (existing != null)
        {
            return existing;
        }

        var client =
            await _supabaseClientFactory
                .CreateServiceClientAsync();

        var profile = new VetProfile
        {
            Id = Guid.NewGuid(),
            UserProfileId = userProfileId,
            CreatedAt = DateTime.UtcNow
        };

        var response = await client
            .From<VetProfile>()
            .Insert(profile);

        return response.Models.First();
    }

    public async Task<IReadOnlyList<VetDogAuthorization>>
        GetAuthorizationsAsync(
            Guid vetProfileId)
    {
        var client =
            await _supabaseClientFactory
                .CreateServiceClientAsync();

        var response = await client
            .From<VetDogAuthorization>()
            .Where(x =>
                x.VetProfileId == vetProfileId)
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<VetDogAuthorization>();
        }

        return response.Models.ToList();
    }

    public async Task AddAuthorizationAsync(
        Guid vetProfileId,
        Guid dogId,
        Guid authorizedByProfileId)
    {
        var client =
            await _supabaseClientFactory
                .CreateServiceClientAsync();

        var authorization =
            new VetDogAuthorization
            {
                Id = Guid.NewGuid(),
                VetProfileId = vetProfileId,
                DogId = dogId,
                AuthorizedByProfileId =
                    authorizedByProfileId,
                AuthorizedAt = DateTime.UtcNow
            };

        await client
            .From<VetDogAuthorization>()
            .Insert(authorization);
    }

    public async Task RemoveAuthorizationAsync(
        Guid vetProfileId,
        Guid dogId)
    {
        var client =
            await _supabaseClientFactory
                .CreateServiceClientAsync();

        await client
            .From<VetDogAuthorization>()
            .Where(x =>
                x.VetProfileId == vetProfileId)
            .Where(x =>
                x.DogId == dogId)
            .Delete();
    }

    public async Task RevokeAllForUserProfileAsync(
        Guid userProfileId)
    {
        var vetProfile =
            await GetVetProfileByUserProfileIdAsync(
                userProfileId);

        if (vetProfile == null)
        {
            return;
        }

        var client =
            await _supabaseClientFactory
                .CreateServiceClientAsync();

        await client
            .From<VetDogAuthorization>()
            .Where(x =>
                x.VetProfileId == vetProfile.Id)
            .Delete();
    }
}
