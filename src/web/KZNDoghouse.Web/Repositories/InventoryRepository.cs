using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Repositories;

public interface IInventoryRepository
{
    Task<IReadOnlyList<InventoryItem>> GetAllItemsAsync();

    Task<InventoryItem?> GetItemByIdAsync(Guid id);

    Task<InventoryItem> CreateItemAsync(InventoryItem item);

    Task UpdateItemQuantityAsync(Guid itemId, int newQuantity);

    Task<InventoryTransaction> CreateTransactionAsync(InventoryTransaction transaction);
}

public class InventoryRepository : IInventoryRepository
{
    private readonly ISupabaseClientFactory _supabaseClientFactory;

    public InventoryRepository(ISupabaseClientFactory supabaseClientFactory)
    {
        _supabaseClientFactory = supabaseClientFactory;
    }

    public async Task<IReadOnlyList<InventoryItem>> GetAllItemsAsync()
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<InventoryItem>()
            .Get();

        if (response.Models == null)
        {
            return Array.Empty<InventoryItem>();
        }

        return response.Models
            .OrderBy(x => x.Name)
            .ToList();
    }

    public async Task<InventoryItem?> GetItemByIdAsync(Guid id)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<InventoryItem>()
            .Where(x => x.Id == id)
            .Get();

        return response.Models?.FirstOrDefault();
    }

    public async Task<InventoryItem> CreateItemAsync(InventoryItem item)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<InventoryItem>()
            .Insert(item);

        return response.Models.First();
    }

    public async Task UpdateItemQuantityAsync(Guid itemId, int newQuantity)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        await client
            .From<InventoryItem>()
            .Where(x => x.Id == itemId)
            .Set(x => x.Quantity, newQuantity)
            .Set(x => x.UpdatedAt!, DateTime.UtcNow)
            .Update();
    }

    public async Task<InventoryTransaction> CreateTransactionAsync(InventoryTransaction transaction)
    {
        var client = await _supabaseClientFactory.CreateServiceClientAsync();

        var response = await client
            .From<InventoryTransaction>()
            .Insert(transaction);

        return response.Models.First();
    }
}