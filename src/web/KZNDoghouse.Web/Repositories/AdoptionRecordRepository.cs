using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IAdoptionRecordRepository
{
    Task<IReadOnlyList<AdoptionRecord>> GetForDogAsync(Guid dogId);
    Task<AdoptionRecord?> GetAsync(Guid id);
    Task<AdoptionRecord> CreateAsync(AdoptionRecord record);
    Task SetAdoptedAsync(Guid id);
    Task SetReturnedAsync(Guid id, string? notes);
}

public sealed class AdoptionRecordRepository : IAdoptionRecordRepository
{
    private readonly ISupabaseClientFactory _clients;
    public AdoptionRecordRepository(ISupabaseClientFactory clients) => _clients = clients;

    public async Task<IReadOnlyList<AdoptionRecord>> GetForDogAsync(Guid dogId)
    {
        var client = await _clients.CreateServiceClientAsync();
        var response = await client.From<AdoptionRecord>().Where(x => x.DogId == dogId).Get();
        return (response.Models ?? []).OrderByDescending(x => x.CreatedAt).ToList();
    }
    public async Task<AdoptionRecord?> GetAsync(Guid id)
    {
        var client = await _clients.CreateServiceClientAsync();
        var response = await client.From<AdoptionRecord>().Where(x => x.Id == id).Get();
        return response.Models?.FirstOrDefault();
    }
    public async Task<AdoptionRecord> CreateAsync(AdoptionRecord record)
    {
        var client = await _clients.CreateServiceClientAsync();
        var response = await client.From<AdoptionRecord>().Insert(record);
        return response.Models.First();
    }
    public async Task SetAdoptedAsync(Guid id)
    {
        var client = await _clients.CreateServiceClientAsync();
        await client.From<AdoptionRecord>().Where(x => x.Id == id)
            .Set(x => x.Status, "Adopted").Set(x => x.AdoptedAt!, DateTime.UtcNow).Update();
    }
    public async Task SetReturnedAsync(Guid id, string? notes)
    {
        var client = await _clients.CreateServiceClientAsync();
        await client.From<AdoptionRecord>().Where(x => x.Id == id)
            .Set(x => x.Status, "Returned").Set(x => x.ReturnedAt!, DateTime.UtcNow)
            .Set(x => x.ReturnNotes!, notes).Update();
    }
}
