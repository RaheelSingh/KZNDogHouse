using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IPortalDashboardService
{
    Task<PortalDashboardViewModel> GetDashboardAsync();
}

public class PortalDashboardService : IPortalDashboardService
{
    private readonly IDogRepository _dogRepository;
    private readonly ICalendarEventRepository _calendarEventRepository;
    private readonly IFosterApplicationRepository _fosterApplicationRepository;
    private readonly IEventAssignmentRepository _eventAssignmentRepository;
    private readonly IInventoryRepository _inventoryRepository;

    public PortalDashboardService(
        IDogRepository dogRepository,
        ICalendarEventRepository calendarEventRepository,
        IFosterApplicationRepository fosterApplicationRepository,
        IEventAssignmentRepository eventAssignmentRepository,
        IInventoryRepository inventoryRepository)
    {
        _dogRepository = dogRepository;
        _calendarEventRepository = calendarEventRepository;
        _fosterApplicationRepository = fosterApplicationRepository;
        _eventAssignmentRepository = eventAssignmentRepository;
        _inventoryRepository = inventoryRepository;
    }

    public async Task<PortalDashboardViewModel> GetDashboardAsync()
    {
        var dogsTask = _dogRepository.GetAllAsync();
        var eventsTask = _calendarEventRepository.GetAllAsync();
        var fosterApplicationsTask = _fosterApplicationRepository.GetAllAsync();
        var assignmentsTask = _eventAssignmentRepository.GetAllAsync();
        var inventoryTask = _inventoryRepository.GetAllItemsAsync();

        await Task.WhenAll(
            dogsTask,
            eventsTask,
            fosterApplicationsTask,
            assignmentsTask,
            inventoryTask);

        var dogs = await dogsTask;
        var events = await eventsTask;
        var fosterApplications = await fosterApplicationsTask;
        var assignments = await assignmentsTask;
        var inventory = await inventoryTask;
        var pendingVolunteerCount = assignments.Count(x => x.Status == EventAssignmentStatuses.Pending);

        var pendingFosterApplications = fosterApplications
            .Where(x =>
                x.Status == FosterApplicationStatuses.Submitted
                || x.Status == FosterApplicationStatuses.UnderReview)
            .ToList();

        var dogsNeedingAttention = dogs
            .Where(x => x.Status == DogStatuses.UnderTreatment)
            .OrderBy(x => x.Name)
            .ToList();

        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        var todaysEvents = events
            .Where(x => x.StartAt >= today && x.StartAt < tomorrow)
            .OrderBy(x => x.StartAt)
            .ToList();

        var lowStockItems = inventory
            .Count(x => x.IsLowStock());

        return new PortalDashboardViewModel
        {
            DogsInCareCount = dogs.Count(x => x.Status != DogStatuses.Adopted),
            DogsInFosterCount = dogs.Count(x => x.Status == DogStatuses.Fostered),
            DogsNeedingAttentionCount = dogsNeedingAttention.Count,
            PendingRequestsCount =
                pendingFosterApplications.Count + pendingVolunteerCount,
            PendingFosterApplicationsCount = pendingFosterApplications.Count,
            PendingVolunteerApplicationsCount = pendingVolunteerCount,
            LowStockItemCount = lowStockItems,
            TodaysEvents = todaysEvents,
            DogsNeedingAttention = dogsNeedingAttention.Take(5).ToList()
        };
    }
}

