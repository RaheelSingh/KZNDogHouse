using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IFosterApplicationRepository
{
    Task<IReadOnlyList<FosterApplication>> GetAllAsync();

    Task<FosterApplication?> GetByIdAsync(Guid id);

    Task ApproveAsync(Guid id, Guid reviewedByStaffId, Guid fosteringRecordId);

    Task RejectAsync(Guid id, Guid reviewedByStaffId, string rejectionReason);
}

public class FosterApplicationRepository : IFosterApplicationRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public FosterApplicationRepository(ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<IReadOnlyList<FosterApplication>> GetAllAsync()
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<FosterApplication>()
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<FosterApplication>();
        }

        return response.Models
            .OrderByDescending(x => x.SubmittedAt)
            .ToList();
    }

    public async Task<FosterApplication?> GetByIdAsync(Guid id)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<FosterApplication>()
            .Where(x => x.Id == id)
            .Get();

        return response.Models?.FirstOrDefault();
    }

    public async Task ApproveAsync(Guid id, Guid reviewedByStaffId, Guid fosteringRecordId)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<FosterApplication>()
            .Where(x => x.Id == id)
            .Set(x => x.Status, FosterApplicationStatuses.Approved)
            .Set(x => x.ReviewedByStaffId!, reviewedByStaffId)
            .Set(x => x.ReviewedAt!, DateTime.UtcNow)
            .Set(x => x.FosteringRecordId!, fosteringRecordId)
            .Update();
    }

    public async Task RejectAsync(Guid id, Guid reviewedByStaffId, string rejectionReason)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<FosterApplication>()
            .Where(x => x.Id == id)
            .Set(x => x.Status, FosterApplicationStatuses.Rejected)
            .Set(x => x.ReviewedByStaffId!, reviewedByStaffId)
            .Set(x => x.ReviewedAt!, DateTime.UtcNow)
            .Set(x => x.RejectionReason!, rejectionReason)
            .Update();
    }
}