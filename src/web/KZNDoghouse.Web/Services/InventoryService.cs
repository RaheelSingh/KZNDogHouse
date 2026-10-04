using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;

namespace KZNDoghouse.Web.Services;

public interface IInventoryService
{
    Task<InventoryPageViewModel> GetPageAsync();

    Task<InventoryItem?> GetItemAsync(Guid itemId);

    Task<InventoryItem> CreateItemAsync(
        string name,
        string? category,
        string? unit,
        int initialQuantity,
        int lowStockThreshold,
        DateTime? initialExpiryDate,
        Guid createdByProfileId);

    Task<InventoryTransactionResult> RecordTransactionAsync(
        Guid itemId,
        string transactionType,
        int quantityChange,
        DateTime? expiryDate,
        string? notes,
        Guid updatedByProfileId);

    Task UpdateImageAsync(
        Guid itemId,
        string? imagePath,
        string? imageUrl);
}

public record InventoryTransactionResult(
    bool Success,
    string Message,
    int? NewQuantity = null);

public class InventoryService : IInventoryService
{
    private readonly IInventoryRepository _repository;

    public InventoryService(IInventoryRepository repository)
    {
        _repository = repository;
    }

    public async Task<InventoryPageViewModel> GetPageAsync()
    {
        var itemsTask = _repository.GetAllItemsAsync();
        var transactionsTask = _repository.GetAllTransactionsAsync();

        await Task.WhenAll(itemsTask, transactionsTask);

        var items = await itemsTask;
        var transactions = await transactionsTask;

        var transactionLookup = transactions
            .GroupBy(x => x.ItemId)
            .ToDictionary(
                x => x.Key,
                x => x.OrderByDescending(t => t.TransactionDate).ToList());

        var summaries = items
            .Select(item =>
            {
                var itemTransactions = transactionLookup
                    .GetValueOrDefault(item.Id)
                    ?? [];

                var nextExpiry = itemTransactions
                    .Where(x =>
                        x.ExpiryDate.HasValue
                        && x.QuantityChange > 0)
                    .Select(x => x.ExpiryDate!.Value.Date)
                    .OrderBy(x => x)
                    .FirstOrDefault();

                return new InventoryItemSummary
                {
                    Item = item,
                    RecentTransactions = itemTransactions.Take(8).ToList(),
                    NextExpiryDate = nextExpiry == default
                        ? null
                        : nextExpiry
                };
            })
            .ToList();

        return new InventoryPageViewModel
        {
            Items = summaries
        };
    }

    public Task<InventoryItem?> GetItemAsync(Guid itemId) =>
        _repository.GetItemByIdAsync(itemId);

    public async Task<InventoryItem> CreateItemAsync(
        string name,
        string? category,
        string? unit,
        int initialQuantity,
        int lowStockThreshold,
        DateTime? initialExpiryDate,
        Guid createdByProfileId)
    {
        var item = new InventoryItem
        {
            Id = Guid.NewGuid(),
            Name = name.Trim(),
            Category = string.IsNullOrWhiteSpace(category)
                ? null
                : category.Trim(),
            Unit = string.IsNullOrWhiteSpace(unit)
                ? null
                : unit.Trim(),
            Quantity = 0,
            LowStockThreshold = Math.Max(0, lowStockThreshold),
            CreatedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateItemAsync(item);

        if (initialQuantity > 0)
        {
            await RecordTransactionAsync(
                created.Id,
                InventoryTransactionTypes.Delivery,
                initialQuantity,
                initialExpiryDate,
                "Opening stock",
                createdByProfileId);

            created.Quantity = initialQuantity;
        }

        return created;
    }

    public async Task<InventoryTransactionResult> RecordTransactionAsync(
        Guid itemId,
        string transactionType,
        int quantityChange,
        DateTime? expiryDate,
        string? notes,
        Guid updatedByProfileId)
    {
        if (!InventoryTransactionTypes.All.Contains(transactionType))
        {
            return new InventoryTransactionResult(
                false,
                "Choose a valid stock transaction type.");
        }

        if (quantityChange == 0)
        {
            return new InventoryTransactionResult(
                false,
                "Quantity cannot be zero.");
        }

        var item = await _repository.GetItemByIdAsync(itemId);

        if (item == null)
        {
            return new InventoryTransactionResult(
                false,
                "Item not found.");
        }

        var appliedChange = transactionType switch
        {
            InventoryTransactionTypes.Usage => -Math.Abs(quantityChange),
            InventoryTransactionTypes.Delivery => Math.Abs(quantityChange),
            _ => quantityChange
        };

        var newQuantity = item.Quantity + appliedChange;

        if (newQuantity < 0)
        {
            return new InventoryTransactionResult(
                false,
                $"This would take {item.Name} below zero stock.");
        }

        var transaction = new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ItemId = itemId,
            TransactionType = transactionType,
            QuantityChange = appliedChange,
            TransactionDate = DateTime.UtcNow,
            ExpiryDate = expiryDate,
            Notes = string.IsNullOrWhiteSpace(notes)
                ? null
                : notes.Trim(),
            UpdatedByUserId = updatedByProfileId,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.CreateTransactionAsync(transaction);
        await _repository.UpdateItemQuantityAsync(itemId, newQuantity);

        var directionText = appliedChange > 0
            ? $"Added {appliedChange}"
            : $"Removed {Math.Abs(appliedChange)}";

        var unitText = string.IsNullOrWhiteSpace(item.Unit)
            ? ""
            : $" {item.Unit}";

        var lowStockWarning = newQuantity <= item.LowStockThreshold
            ? " This item is now at or below its low-stock threshold."
            : string.Empty;

        return new InventoryTransactionResult(
            true,
            $"{directionText}{unitText}. New stock: {newQuantity}{unitText}.{lowStockWarning}",
            newQuantity);
    }

    public Task UpdateImageAsync(
        Guid itemId,
        string? imagePath,
        string? imageUrl) =>
        _repository.UpdateItemImageAsync(
            itemId,
            imagePath,
            imageUrl);
}
