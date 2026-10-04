using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface ICalendarEventService
{
    Task<IReadOnlyList<CalendarEvent>> GetAllAsync();

    Task<CalendarEvent?> GetByIdAsync(Guid id);

    Task<IReadOnlyList<CalendarEvent>> GetPublicUpcomingAsync();

    Task<IReadOnlyList<CalendarEvent>> GetPublicPastAsync();

    Task<CalendarEvent> CreateAsync(
        string title,
        string category,
        string? description,
        string? location,
        DateTime startAt,
        DateTime? endAt,
        string visibility,
        Guid? dogId,
        Guid createdByProfileId);

    Task UpdateImageAsync(
        Guid id,
        string? imagePath,
        string? imageUrl);

    Task DeleteAsync(Guid id);
}

public class CalendarEventService : ICalendarEventService
{
    private readonly ICalendarEventRepository _repository;
    private readonly INotificationService _notificationService;

    public CalendarEventService(
        ICalendarEventRepository repository,
        INotificationService notificationService)
    {
        _repository = repository;
        _notificationService = notificationService;
    }

    public Task<IReadOnlyList<CalendarEvent>> GetAllAsync() =>
        _repository.GetAllAsync();

    public Task<CalendarEvent?> GetByIdAsync(Guid id) =>
        _repository.GetByIdAsync(id);

    public async Task<IReadOnlyList<CalendarEvent>> GetPublicPastAsync()
    {
        var all = await _repository.GetAllAsync();

        return all
            .Where(x =>
                x.Visibility == EventVisibilities.Public
                && x.StartAt < DateTime.UtcNow)
            .OrderByDescending(x => x.StartAt)
            .ToList();
    }

    public async Task<IReadOnlyList<CalendarEvent>> GetPublicUpcomingAsync()
    {
        var all = await _repository.GetAllAsync();

        return all
            .Where(x =>
                x.Visibility == EventVisibilities.Public
                && x.StartAt >= DateTime.UtcNow)
            .OrderBy(x => x.StartAt)
            .ToList();
    }

    public async Task<CalendarEvent> CreateAsync(
        string title,
        string category,
        string? description,
        string? location,
        DateTime startAt,
        DateTime? endAt,
        string visibility,
        Guid? dogId,
        Guid createdByProfileId)
    {
        if (!EventCategories.All.Contains(category))
        {
            category = EventCategories.Other;
        }

        if (!EventVisibilities.All.Contains(visibility))
        {
            visibility = EventVisibilities.Internal;
        }

        var calendarEvent = new CalendarEvent
        {
            Id = Guid.NewGuid(),
            Title = title,
            Category = category,
            Description = description,
            Location = location,
            StartAt = startAt,
            EndAt = endAt,
            Visibility = visibility,
            DogId = dogId,
            CreatedBy = createdByProfileId,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateAsync(calendarEvent);

        await _notificationService.NotifyActiveVolunteersAsync(
            NotificationCategories.Calendar,
            title,
            $"New {category.ToLowerInvariant()} on {startAt:dd MMM} at {startAt:HH:mm}.");

        return created;
    }

    public Task UpdateImageAsync(
        Guid id,
        string? imagePath,
        string? imageUrl) =>
        _repository.UpdateImageAsync(
            id,
            imagePath,
            imageUrl);

    public Task DeleteAsync(Guid id) =>
        _repository.DeleteAsync(id);
}
