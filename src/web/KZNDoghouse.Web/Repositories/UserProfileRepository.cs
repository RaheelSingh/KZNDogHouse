using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IUserProfileRepository
{
    Task<UserProfile?> GetByAuthUserIdAsync(string authUserId);

    Task<UserProfile?> GetByIdAsync(Guid profileId);

    Task<IReadOnlyList<UserProfile>> GetAllAsync();

    Task<IReadOnlyList<UserProfile>> GetActiveByRoleAsync(string role);

    Task<IReadOnlyList<UserProfile>> GetPendingVolunteerRequestsAsync();

    Task UpdateAccessAsync(
        Guid profileId,
        string role,
        bool isActive);

    Task ApproveVolunteerRequestAsync(
        Guid profileId,
        Guid reviewedByProfileId);

    Task RejectVolunteerRequestAsync(
        Guid profileId,
        Guid reviewedByProfileId);
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

        return response.Models?.FirstOrDefault();
    }

    public async Task<UserProfile?> GetByIdAsync(
        Guid profileId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<UserProfile>()
            .Where(x => x.Id == profileId)
            .Get();

        return response.Models?.FirstOrDefault();
    }

    public async Task<IReadOnlyList<UserProfile>> GetAllAsync()
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<UserProfile>()
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<UserProfile>();
        }

        return response.Models
            .OrderBy(x => x.LastName)
            .ThenBy(x => x.FirstName)
            .ToList();
    }

    public async Task<IReadOnlyList<UserProfile>> GetActiveByRoleAsync(
        string role)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<UserProfile>()
            .Where(x => x.Role == role)
            .Where(x => x.IsActive == true)
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<UserProfile>();
        }

        return response.Models.ToList();
    }

    public async Task<IReadOnlyList<UserProfile>>
        GetPendingVolunteerRequestsAsync()
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<UserProfile>()
            .Where(x =>
                x.VolunteerRequestStatus ==
                VolunteerRequestStatuses.Pending)
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<UserProfile>();
        }

        return response.Models
            .OrderBy(x => x.VolunteerRequestedAt)
            .ThenBy(x => x.LastName)
            .ThenBy(x => x.FirstName)
            .ToList();
    }

    public async Task UpdateAccessAsync(
        Guid profileId,
        string role,
        bool isActive)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<UserProfile>()
            .Where(x => x.Id == profileId)
            .Set(x => x.Role, role)
            .Set(x => x.IsActive, isActive)
            .Set(x => x.UpdatedAt!, DateTime.UtcNow)
            .Update();
    }

    public async Task ApproveVolunteerRequestAsync(
        Guid profileId,
        Guid reviewedByProfileId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<UserProfile>()
            .Where(x => x.Id == profileId)
            .Set(x => x.Role, UserRoles.Volunteer)
            .Set(
                x => x.VolunteerRequestStatus,
                VolunteerRequestStatuses.Approved)
            .Set(
                x => x.VolunteerReviewedAt!,
                DateTime.UtcNow)
            .Set(
                x => x.VolunteerReviewedBy!,
                reviewedByProfileId)
            .Set(x => x.UpdatedAt!, DateTime.UtcNow)
            .Update();
    }

    public async Task RejectVolunteerRequestAsync(
        Guid profileId,
        Guid reviewedByProfileId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<UserProfile>()
            .Where(x => x.Id == profileId)
            .Set(
                x => x.VolunteerRequestStatus,
                VolunteerRequestStatuses.Rejected)
            .Set(
                x => x.VolunteerReviewedAt!,
                DateTime.UtcNow)
            .Set(
                x => x.VolunteerReviewedBy!,
                reviewedByProfileId)
            .Set(x => x.UpdatedAt!, DateTime.UtcNow)
            .Update();
    }
}
