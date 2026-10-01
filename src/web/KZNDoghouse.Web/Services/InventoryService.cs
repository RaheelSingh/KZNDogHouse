using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IInventoryService
{
    Task<IReadOnlyList<InventoryItem>> GetAllItemsAsync();

    Task<InventoryItem> CreateItemAsync(
        string name, string? category, string? unit, int initialQuantity, int lowStockThreshold);

    Task<InventoryTransactionResult> RecordTransactionAsync(
        Guid itemId,
        string transactionType,
        int quantityChange,
        DateTime? expiryDate,
        string? notes,
        Guid updatedByProfileId);
}

public record InventoryTransactionResult(bool Success, string Message);

public class InventoryService : IInventoryService
{
    private readonly IInventoryRepository _repository;

    public InventoryService(IInventoryRepository repository)
    {
        _repository = repository;
    }

    public Task<IReadOnlyList<InventoryItem>> GetAllItemsAsync() =>
        _repository.GetAllItemsAsync();

    public Task<InventoryItem> CreateItemAsync(
        string name, string? category, string? unit, int initialQuantity, int lowStockThreshold)
    {
        var item = new InventoryItem
        {
            Id = Guid.NewGuid(),
            Name = name,
            Category = category,
            Unit = unit,
            Quantity = initialQuantity,
            LowStockThreshold = lowStockThreshold,
            CreatedAt = DateTime.UtcNow
        };

        return _repository.CreateItemAsync(item);
    }

    public async Task<InventoryTransactionResult> RecordTransactionAsync(
        Guid itemId,
        string transactionType,
        int quantityChange,
        DateTime? expiryDate,
        string? notes,
        Guid updatedByProfileId)
    {
        var item = await _repository.GetItemByIdAsync(itemId);

        if (item == null)
        {
            return new InventoryTransactionResult(false, "Item not found.");
        }

           var appliedChange = transactionType == InventoryTransactionTypes.Usage
            ? -Math.Abs(quantityChange)
            : quantityChange;

        var newQuantity = item.Quantity + appliedChange;

        if (newQuantity < 0)
        {
            return new InventoryTransactionResult(
                false, $"This would take {item.Name} below zero stock.");
        }

        var transaction = new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ItemId = itemId,
            TransactionType = transactionType,
            QuantityChange = appliedChange,
            TransactionDate = DateTime.UtcNow,
            ExpiryDate = expiryDate,
            Notes = notes,
            UpdatedByUserId = updatedByProfileId,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.CreateTransactionAsync(transaction);
        await _repository.UpdateItemQuantityAsync(itemId, newQuantity);

        var lowStockWarning = newQuantity <= item.LowStockThreshold
            ? $" {item.Name} is now at or below its low-stock threshold."
            : string.Empty;

        return new InventoryTransactionResult(true, $"Transaction recorded.{lowStockWarning}");
    }
}