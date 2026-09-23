using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IUserProfileRepository
{
    Task<UserProfile?> GetByAuthUserIdAsync(string authUserId);
}

public class UserProfileRepository : IUserProfileRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public UserProfileRepository(
        ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<UserProfile?> GetByAuthUserIdAsync(
        string authUserId)
    {
        if (!Guid.TryParse(authUserId, out var parsedAuthUserId))
        {
            return null;
        }

        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<UserProfile>()
            .Where(x => x.AuthUserId == parsedAuthUserId)
            .Get();

        return response.Models.FirstOrDefault();
    }
}