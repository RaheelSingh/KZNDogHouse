using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface ICalendarEventService
{
    Task<IReadOnlyList<CalendarEvent>> GetAllAsync();

    // Akeev, your public Events page should call this rather than filtering in the view 
    Task<IReadOnlyList<CalendarEvent>> GetPublicUpcomingAsync();

    Task CreateAsync(
        string title,
        string category,
        string? description,
        string? location,
        DateTime startAt,
        DateTime? endAt,
        string visibility,
        Guid? dogId,
        Guid createdByProfileId);

    Task DeleteAsync(Guid id);
}

public class CalendarEventService : ICalendarEventService
{
    private readonly ICalendarEventRepository _repository;

    public CalendarEventService(ICalendarEventRepository repository)
    {
        _repository = repository;
    }

    public Task<IReadOnlyList<CalendarEvent>> GetAllAsync() =>
        _repository.GetAllAsync();

    public async Task<IReadOnlyList<CalendarEvent>> GetPublicUpcomingAsync()
    {
        var all = await _repository.GetAllAsync();

        return all
            .Where(x => x.Visibility == EventVisibilities.Public
                        && x.StartAt >= DateTime.UtcNow)
            .ToList();
    }

    public Task CreateAsync(
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

        return _repository.CreateAsync(calendarEvent);
    }

    public Task DeleteAsync(Guid id) => _repository.DeleteAsync(id);
}