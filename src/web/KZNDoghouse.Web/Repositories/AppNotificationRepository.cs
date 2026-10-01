using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IAppNotificationRepository
{
    Task<AppNotification> CreateAsync(AppNotification notification);

    Task<IReadOnlyList<AppNotification>> GetRecentAsync(int take);
}

public class AppNotificationRepository : IAppNotificationRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public AppNotificationRepository(ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<AppNotification> CreateAsync(AppNotification notification)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<AppNotification>()
            .Insert(notification);

        return response.Models.First();
    }

    public async Task<IReadOnlyList<AppNotification>> GetRecentAsync(int take)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<AppNotification>()
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
}