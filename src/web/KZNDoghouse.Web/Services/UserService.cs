using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IUserService
{
    Task<IReadOnlyList<UserProfile>> GetAllUsersAsync(
        string currentAuthUserId);

    Task<IReadOnlyList<UserProfile>>
        GetPendingVolunteerRequestsAsync();

    Task<UserAccessUpdateResult> UpdateAccessAsync(
        Guid profileId,
        string role,
        bool isActive,
        string currentAuthUserId);

    Task<UserAccessUpdateResult> ReviewVolunteerRequestAsync(
        Guid profileId,
        bool approve,
        string currentAuthUserId);
}

public record UserAccessUpdateResult(
    bool Success,
    string Message);

public class UserService : IUserService
{
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly INotificationService _notificationService;

    public UserService(
        IUserProfileRepository userProfileRepository,
        INotificationService notificationService)
    {
        _userProfileRepository = userProfileRepository;
        _notificationService = notificationService;
    }

    public async Task<IReadOnlyList<UserProfile>> GetAllUsersAsync(
        string currentAuthUserId)
    {
        var users =
            await _userProfileRepository.GetAllAsync();

        return users
            .OrderByDescending(x =>
                x.AuthUserId.ToString().Equals(
                    currentAuthUserId,
                    StringComparison.OrdinalIgnoreCase))
            .ThenBy(x => x.LastName)
            .ThenBy(x => x.FirstName)
            .ToList();
    }

    public Task<IReadOnlyList<UserProfile>>
        GetPendingVolunteerRequestsAsync()
    {
        return _userProfileRepository
            .GetPendingVolunteerRequestsAsync();
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

        if (role == UserRoles.Volunteer
            && profile.VolunteerRequestStatus ==
                VolunteerRequestStatuses.Pending)
        {
            return await ReviewVolunteerRequestAsync(
                profileId,
                true,
                currentAuthUserId);
        }

        await _userProfileRepository.UpdateAccessAsync(
            profileId,
            role,
            isActive);

        return new UserAccessUpdateResult(
            true,
            "User access has been updated.");
    }

    public async Task<UserAccessUpdateResult> ReviewVolunteerRequestAsync(
        Guid profileId,
        bool approve,
        string currentAuthUserId)
    {
        var reviewer =
            await _userProfileRepository
                .GetByAuthUserIdAsync(currentAuthUserId);

        if (reviewer == null)
        {
            return new UserAccessUpdateResult(
                false,
                "The administrator account could not be found.");
        }

        var profile =
            await _userProfileRepository.GetByIdAsync(profileId);

        if (profile == null)
        {
            return new UserAccessUpdateResult(
                false,
                "The volunteer request could not be found.");
        }

        if (profile.VolunteerRequestStatus !=
            VolunteerRequestStatuses.Pending)
        {
            return new UserAccessUpdateResult(
                false,
                "This volunteer request has already been reviewed.");
        }

        if (approve)
        {
            await _userProfileRepository
                .ApproveVolunteerRequestAsync(
                    profileId,
                    reviewer.Id);

            await _notificationService.NotifyUserAsync(
                profile.Id,
                NotificationCategories.General,
                "Volunteer request approved",
                "Your volunteer access has been approved. Sign out and back in to refresh your account access.");

            return new UserAccessUpdateResult(
                true,
                $"{profile.FullName}'s volunteer request has been approved.");
        }

        await _userProfileRepository
            .RejectVolunteerRequestAsync(
                profileId,
                reviewer.Id);

        await _notificationService.NotifyUserAsync(
            profile.Id,
            NotificationCategories.General,
            "Volunteer request reviewed",
            "Your volunteer request was not approved at this time. Your Public account remains active.");

        return new UserAccessUpdateResult(
            true,
            $"{profile.FullName}'s volunteer request has been rejected.");
    }
}
