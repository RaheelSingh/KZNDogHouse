using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IEventAssignmentRepository
{
    Task<IReadOnlyList<EventAssignment>> GetAllAsync();

    Task<IReadOnlyList<EventAssignment>> GetByProfileAsync(Guid profileId);

    Task<EventAssignment?> GetByEventAndProfileAsync(
        Guid eventId,
        Guid profileId);

    Task<EventAssignment> CreateAsync(EventAssignment assignment);

    Task<EventAssignment?> GetByIdAsync(Guid assignmentId);

    Task<bool> ReviewStatusAsync(Guid assignmentId, string status);

    Task UpdateStatusAsync(Guid assignmentId, string status);
}

public class EventAssignmentRepository : IEventAssignmentRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public EventAssignmentRepository(
        ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<IReadOnlyList<EventAssignment>> GetAllAsync()
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<EventAssignment>()
            .Get();

        return response.Models?.ToList()
            ?? new List<EventAssignment>();
    }

    public async Task<IReadOnlyList<EventAssignment>> GetByProfileAsync(
        Guid profileId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<EventAssignment>()
            .Where(x => x.ProfileId == profileId)
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<EventAssignment>();
        }

        return response.Models
            .OrderByDescending(x => x.CreatedAt)
            .ToList();
    }

    public async Task<EventAssignment?> GetByEventAndProfileAsync(
        Guid eventId,
        Guid profileId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<EventAssignment>()
            .Where(x => x.EventId == eventId)
            .Where(x => x.ProfileId == profileId)
            .Get();

        return response.Models?.FirstOrDefault();
    }

    public async Task<EventAssignment?> GetByIdAsync(Guid assignmentId)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();
        var response = await client.From<EventAssignment>()
            .Where(x => x.Id == assignmentId).Get();
        return response.Models?.FirstOrDefault();
    }

    public async Task<bool> ReviewStatusAsync(Guid assignmentId, string status)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();
        var response = await client.Rpc(
            "review_volunteer_application",
            new Dictionary<string, object>
            {
                ["p_assignment_id"] = assignmentId,
                ["p_status"] = status
            });
        // A scalar boolean response is returned only after the database has
        // atomically checked capacity and changed the assignment status.
        return System.Text.Json.JsonSerializer.Deserialize<bool>(response.Content);
    }

    public async Task<EventAssignment> CreateAsync(
        EventAssignment assignment)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<EventAssignment>()
            .Insert(assignment);

        return response.Models.First();
    }

    public async Task UpdateStatusAsync(
        Guid assignmentId,
        string status)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<EventAssignment>()
            .Where(x => x.Id == assignmentId)
            .Set(x => x.Status, status)
            .Update();
    }
}
