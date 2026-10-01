// Services/NotificationService.cs
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface INotificationService
{
    Task NotifyUserAsync(Guid recipientId, string category, string title, string? body);

    Task NotifyActiveVolunteersAsync(string category, string title, string? body);

    Task<IReadOnlyList<AppNotification>> GetRecentAsync(int take = 50);
}

public class NotificationService : INotificationService
{
    private readonly IAppNotificationRepository _notificationRepository;
    private readonly IUserProfileRepository _userProfileRepository;

    public NotificationService(
        IAppNotificationRepository notificationRepository,
        IUserProfileRepository userProfileRepository)
    {
        _notificationRepository = notificationRepository;
        _userProfileRepository = userProfileRepository;
    }

    public Task NotifyUserAsync(Guid recipientId, string category, string title, string? body)
    {
        var notification = new AppNotification
        {
            Id = Guid.NewGuid(),
            RecipientId = recipientId,
            Category = category,
            Title = title,
            Body = body,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        return _notificationRepository.CreateAsync(notification);
    }

    public async Task NotifyActiveVolunteersAsync(string category, string title, string? body)
    {
        var volunteers = await _userProfileRepository.GetActiveByRoleAsync(UserRoles.Volunteer);

        foreach (var volunteer in volunteers)
        {
            await NotifyUserAsync(volunteer.Id, category, title, body);
        }
    }

    public Task<IReadOnlyList<AppNotification>> GetRecentAsync(int take = 50) =>
        _notificationRepository.GetRecentAsync(take);
}