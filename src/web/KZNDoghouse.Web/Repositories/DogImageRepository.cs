using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IDogImageRepository
{
    Task<IReadOnlyList<DogImage>> GetAllAsync();

    Task<IReadOnlyList<DogImage>> GetForDogAsync(Guid dogId);

    Task<DogImage?> GetByIdAsync(Guid imageId);

    Task<DogImage> CreateAsync(DogImage image);

    Task SetPrimaryAsync(
        Guid dogId,
        Guid imageId);

    Task DeleteAsync(Guid imageId);
}

public class DogImageRepository : IDogImageRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public DogImageRepository(
        ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<IReadOnlyList<DogImage>> GetAllAsync()
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<DogImage>()
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<DogImage>();
        }

        return response.Models
            .OrderBy(x => x.DogId)
            .ThenByDescending(x => x.IsPrimary)
            .ThenBy(x => x.SortOrder)
            .ThenBy(x => x.CreatedAt)
            .ToList();
    }

    public async Task<IReadOnlyList<DogImage>> GetForDogAsync(
        Guid dogId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<DogImage>()
            .Where(x => x.DogId == dogId)
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<DogImage>();
        }

        return response.Models
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.SortOrder)
            .ThenBy(x => x.CreatedAt)
            .ToList();
    }

    public async Task<DogImage?> GetByIdAsync(
        Guid imageId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<DogImage>()
            .Where(x => x.Id == imageId)
            .Get();

        return response.Models?.FirstOrDefault();
    }

    public async Task<DogImage> CreateAsync(
        DogImage image)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<DogImage>()
            .Insert(image);

        return response.Models.First();
    }

    public async Task SetPrimaryAsync(
        Guid dogId,
        Guid imageId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<DogImage>()
            .Where(x => x.DogId == dogId)
            .Set(x => x.IsPrimary, false)
            .Update();

        await client
            .From<DogImage>()
            .Where(x => x.Id == imageId)
            .Set(x => x.IsPrimary, true)
            .Update();
    }

    public async Task DeleteAsync(
        Guid imageId)
    {
        var client =
            await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<DogImage>()
            .Where(x => x.Id == imageId)
            .Delete();
    }
}