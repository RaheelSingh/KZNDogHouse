using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IAppNotificationRepository
{
    Task<AppNotification> CreateAsync(AppNotification notification);

    Task<IReadOnlyList<AppNotification>> GetRecentForRecipientAsync(
        Guid recipientId,
        int take);

    Task<int> GetUnreadCountAsync(Guid recipientId);

    Task MarkAsReadAsync(
        Guid notificationId,
        Guid recipientId);

    Task MarkAllAsReadAsync(Guid recipientId);
}

public class AppNotificationRepository : IAppNotificationRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public AppNotificationRepository(
        ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<AppNotification> CreateAsync(
        AppNotification notification)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<AppNotification>()
            .Insert(notification);

        return response.Models.First();
    }

    public async Task<IReadOnlyList<AppNotification>>
        GetRecentForRecipientAsync(
            Guid recipientId,
            int take)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<AppNotification>()
            .Where(x => x.RecipientId == recipientId)
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<AppNotification>();
        }

        return response.Models
            .OrderByDescending(x => x.CreatedAt)
            .Take(take)
            .ToList();
    }

    public async Task<int> GetUnreadCountAsync(
        Guid recipientId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<AppNotification>()
            .Where(x => x.RecipientId == recipientId)
            .Where(x => x.IsRead == false)
            .Get();

        return response.Models?.Count ?? 0;
    }

    public async Task MarkAsReadAsync(
        Guid notificationId,
        Guid recipientId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<AppNotification>()
            .Where(x => x.Id == notificationId)
            .Where(x => x.RecipientId == recipientId)
            .Set(x => x.IsRead, true)
            .Update();
    }

    public async Task MarkAllAsReadAsync(
        Guid recipientId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<AppNotification>()
            .Where(x => x.RecipientId == recipientId)
            .Where(x => x.IsRead == false)
            .Set(x => x.IsRead, true)
            .Update();
    }
}
