using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface ICalendarEventRepository
{
    Task<IReadOnlyList<CalendarEvent>> GetAllAsync();

    Task<CalendarEvent?> GetByIdAsync(Guid id);

    Task<CalendarEvent> CreateAsync(CalendarEvent calendarEvent);

    Task UpdateImageAsync(
        Guid id,
        string? imagePath,
        string? imageUrl);

    Task DeleteAsync(Guid id);
}

public class CalendarEventRepository : ICalendarEventRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public CalendarEventRepository(
        ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<IReadOnlyList<CalendarEvent>> GetAllAsync()
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<CalendarEvent>()
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<CalendarEvent>();
        }

        return response.Models
            .OrderBy(x => x.StartAt)
            .ToList();
    }

    public async Task<CalendarEvent?> GetByIdAsync(
        Guid id)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<CalendarEvent>()
            .Where(x => x.Id == id)
            .Get();

        return response.Models?.FirstOrDefault();
    }

    public async Task<CalendarEvent> CreateAsync(
        CalendarEvent calendarEvent)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<CalendarEvent>()
            .Insert(calendarEvent);

        return response.Models.First();
    }

    public async Task UpdateImageAsync(
        Guid id,
        string? imagePath,
        string? imageUrl)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<CalendarEvent>()
            .Where(x => x.Id == id)
            .Set(x => x.ImagePath!, imagePath)
            .Set(x => x.ImageUrl!, imageUrl)
            .Update();
    }

    public async Task DeleteAsync(
        Guid id)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<CalendarEvent>()
            .Where(x => x.Id == id)
            .Delete();
    }
}