using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IUserService
{
    Task<IReadOnlyList<UserProfile>> GetAllUsersAsync();

    Task<UserAccessUpdateResult> UpdateAccessAsync(
        Guid profileId,
        string role,
        bool isActive,
        string currentAuthUserId);
}

public record UserAccessUpdateResult(
    bool Success,
    string Message);

public class UserService : IUserService
{
    private readonly IUserProfileRepository _userProfileRepository;

    public UserService(
        IUserProfileRepository userProfileRepository)
    {
        _userProfileRepository = userProfileRepository;
    }

    public async Task<IReadOnlyList<UserProfile>> GetAllUsersAsync()
    {
        return await _userProfileRepository.GetAllAsync();
    }

    public async Task<UserAccessUpdateResult> UpdateAccessAsync(
        Guid profileId,
        string role,
        bool isActive,
        string currentAuthUserId)
    {
        if (!UserRoles.All.Contains(role))
        {
            return new UserAccessUpdateResult(
                false,
                "The selected role is invalid.");
        }

        var profile =
            await _userProfileRepository.GetByIdAsync(profileId);

        if (profile == null)
        {
            return new UserAccessUpdateResult(
                false,
                "The selected user could not be found.");
        }

        if (profile.AuthUserId.ToString()
            .Equals(
                currentAuthUserId,
                StringComparison.OrdinalIgnoreCase))
        {
            return new UserAccessUpdateResult(
                false,
                "You cannot change your own role or account status.");
        }

        await _userProfileRepository.UpdateAccessAsync(
            profileId,
            role,
            isActive);

        return new UserAccessUpdateResult(
            true,
            "User access has been updated.");
    }
}