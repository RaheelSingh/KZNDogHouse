using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IMedicalAlertService
{
    Task NotifyStaffAsync(string dogName, string medicalTitle);
    Task NotifyAssignedVetsAsync(Guid dogId, string dogName, string medicalTitle);
}

public class MedicalAlertService : IMedicalAlertService
{
    private readonly INotificationService _notifications;
    private readonly IUserProfileRepository _users;
    private readonly IVetAccessRepository _vetAccess;

    public MedicalAlertService(INotificationService notifications, IUserProfileRepository users, IVetAccessRepository vetAccess)
    {
        _notifications = notifications;
        _users = users;
        _vetAccess = vetAccess;
    }

    public async Task NotifyStaffAsync(string dogName, string medicalTitle)
    {
        var body = $"A medical record for {dogName} was updated: {medicalTitle}.";
        await _notifications.NotifyActiveRoleAsync(UserRoles.Staff, NotificationCategories.Medical, "Dog medical update", body);
        await _notifications.NotifyActiveRoleAsync(UserRoles.Administrator, NotificationCategories.Medical, "Dog medical update", body);
    }

    public async Task NotifyAssignedVetsAsync(Guid dogId, string dogName, string medicalTitle)
    {
        foreach (var vet in await _users.GetActiveByRoleAsync(UserRoles.Vet))
        {
            var profile = await _vetAccess.GetVetProfileByUserProfileIdAsync(vet.Id);
            if (profile == null) continue;
            var authorised = await _vetAccess.GetAuthorizationsAsync(profile.Id);
            if (authorised.Any(a => a.DogId == dogId))
                await _notifications.NotifyUserAsync(vet.Id, NotificationCategories.Medical,
                    "Medical record updated", $"{dogName}: {medicalTitle}.");
        }
    }
}
