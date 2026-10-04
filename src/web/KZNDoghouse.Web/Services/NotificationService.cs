using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface INotificationService
{
    Task NotifyUserAsync(
        Guid recipientId,
        string category,
        string title,
        string? body);

    Task NotifyActiveRoleAsync(
        string role,
        string category,
        string title,
        string? body);

    Task NotifyActiveVolunteersAsync(
        string category,
        string title,
        string? body);

    Task<IReadOnlyList<AppNotification>> GetRecentForRecipientAsync(
        Guid recipientId,
        int take = 50);

    Task<int> GetUnreadCountAsync(Guid recipientId);

    Task MarkAllAsReadAsync(Guid recipientId);
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

    public Task NotifyUserAsync(
        Guid recipientId,
        string category,
        string title,
        string? body)
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

    public async Task NotifyActiveRoleAsync(
        string role,
        string category,
        string title,
        string? body)
    {
        var users =
            await _userProfileRepository
                .GetActiveByRoleAsync(role);

        foreach (var user in users)
        {
            await NotifyUserAsync(
                user.Id,
                category,
                title,
                body);
        }
    }

    public Task NotifyActiveVolunteersAsync(
        string category,
        string title,
        string? body)
    {
        return NotifyActiveRoleAsync(
            UserRoles.Volunteer,
            category,
            title,
            body);
    }

    public Task<IReadOnlyList<AppNotification>>
        GetRecentForRecipientAsync(
            Guid recipientId,
            int take = 50)
    {
        return _notificationRepository
            .GetRecentForRecipientAsync(
                recipientId,
                take);
    }

    public Task<int> GetUnreadCountAsync(
        Guid recipientId)
    {
        return _notificationRepository
            .GetUnreadCountAsync(recipientId);
    }

    public Task MarkAllAsReadAsync(
        Guid recipientId)
    {
        return _notificationRepository
            .MarkAllAsReadAsync(recipientId);
    }
}
