using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IAvailabilitySlotRepository
{
    Task<IReadOnlyList<AvailabilitySlot>> GetAllAsync();

    Task<IReadOnlyList<AvailabilitySlot>> GetPendingAsync();

    Task ReviewAsync(
        Guid id,
        string status,
        Guid reviewedByProfileId);
}

public class AvailabilitySlotRepository : IAvailabilitySlotRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public AvailabilitySlotRepository(
        ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<IReadOnlyList<AvailabilitySlot>> GetAllAsync()
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<AvailabilitySlot>()
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<AvailabilitySlot>();
        }

        return response.Models
            .OrderByDescending(x => x.DayDate)
            .ThenBy(x => x.Slot)
            .ToList();
    }

    public async Task<IReadOnlyList<AvailabilitySlot>> GetPendingAsync()
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<AvailabilitySlot>()
            .Where(x => x.Status == AvailabilitySlotStatuses.Pending)
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<AvailabilitySlot>();
        }

        return response.Models
            .OrderBy(x => x.SubmittedAt)
            .ToList();
    }

    public async Task ReviewAsync(
        Guid id,
        string status,
        Guid reviewedByProfileId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<AvailabilitySlot>()
            .Where(x => x.Id == id)
            .Set(x => x.Status, status)
            .Set(x => x.ReviewedBy!, reviewedByProfileId)
            .Set(x => x.ReviewedAt!, DateTime.UtcNow)
            .Update();
    }
}
