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

    Task<InventoryTransactionResult> UpdateItemDetailsAsync(
        Guid itemId,
        string name,
        string? category,
        string? unit,
        int lowStockThreshold);

    Task UpdateImageAsync(Guid itemId, string? imagePath, string? imageUrl);
}

public record InventoryTransactionResult(bool Success, string Message, int? NewQuantity = null);

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
            .ToDictionary(x => x.Key, x => x.OrderBy(t => t.TransactionDate).ToList());

        var summaries = items.Select(item =>
        {
            var itemTransactions = transactionLookup.GetValueOrDefault(item.Id) ?? [];

            return new InventoryItemSummary
            {
                Item = item,
                RecentTransactions = itemTransactions
                    .OrderByDescending(x => x.TransactionDate)
                    .Take(8)
                    .ToList(),
                NextExpiryDate = GetNextRemainingExpiry(itemTransactions)
            };
        }).ToList();

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
            Name = name.Trim(),
            Category = CleanOptional(category),
            Unit = CleanOptional(unit),
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
            return new InventoryTransactionResult(false, "Choose a valid stock transaction type.");
        }

        if (quantityChange == 0)
        {
            return new InventoryTransactionResult(false, "Quantity cannot be zero.");
        }

        var item = await _repository.GetItemByIdAsync(itemId);
        if (item == null)
        {
            return new InventoryTransactionResult(false, "Item not found.");
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
            return new InventoryTransactionResult(false, $"This would take {item.Name} below zero stock.");
        }

        var transaction = new InventoryTransaction
        {
            Id = Guid.NewGuid(),
            ItemId = itemId,
            TransactionType = transactionType,
            QuantityChange = appliedChange,
            TransactionDate = DateTime.UtcNow,
            ExpiryDate = expiryDate,
            Notes = CleanOptional(notes),
            UpdatedByUserId = updatedByProfileId,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.CreateTransactionAsync(transaction);
        await _repository.UpdateItemQuantityAsync(itemId, newQuantity);

        var directionText = appliedChange > 0
            ? $"Added {appliedChange}"
            : $"Removed {Math.Abs(appliedChange)}";

        var unitText = string.IsNullOrWhiteSpace(item.Unit) ? "" : $" {item.Unit}";
        var lowStockWarning = newQuantity <= item.LowStockThreshold
            ? " This item is now at or below its low-stock threshold."
            : string.Empty;

        return new InventoryTransactionResult(
            true,
            $"{directionText}{unitText}. New stock: {newQuantity}{unitText}.{lowStockWarning}",
            newQuantity);
    }

    public async Task<InventoryTransactionResult> UpdateItemDetailsAsync(
        Guid itemId,
        string name,
        string? category,
        string? unit,
        int lowStockThreshold)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return new InventoryTransactionResult(false, "Item name is required.");
        }

        var existing = await _repository.GetItemByIdAsync(itemId);
        if (existing == null)
        {
            return new InventoryTransactionResult(false, "Item not found.");
        }

        await _repository.UpdateItemDetailsAsync(
            itemId,
            name.Trim(),
            CleanOptional(category),
            CleanOptional(unit),
            Math.Max(0, lowStockThreshold));

        return new InventoryTransactionResult(true, $"{name.Trim()} updated.", existing.Quantity);
    }

    public Task UpdateImageAsync(Guid itemId, string? imagePath, string? imageUrl) =>
        _repository.UpdateItemImageAsync(itemId, imagePath, imageUrl);

    private static string? CleanOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static DateTime? GetNextRemainingExpiry(IReadOnlyList<InventoryTransaction> transactions)
    {
        var batches = new List<InventoryBatch>();

        foreach (var transaction in transactions.OrderBy(x => x.TransactionDate))
        {
            if (transaction.QuantityChange > 0)
            {
                batches.Add(new InventoryBatch(
                    transaction.QuantityChange,
                    transaction.ExpiryDate?.Date));
                continue;
            }

            if (transaction.QuantityChange >= 0)
            {
                continue;
            }

            var remainingToConsume = Math.Abs(transaction.QuantityChange);

            foreach (var batch in batches.Where(x => x.Remaining > 0))
            {
                if (remainingToConsume == 0)
                {
                    break;
                }

                var consumed = Math.Min(batch.Remaining, remainingToConsume);
                batch.Remaining -= consumed;
                remainingToConsume -= consumed;
            }
        }

        var nextExpiry = batches
            .Where(x => x.Remaining > 0 && x.ExpiryDate.HasValue)
            .Select(x => x.ExpiryDate!.Value)
            .OrderBy(x => x)
            .FirstOrDefault();

        return nextExpiry == default
            ? null
            : nextExpiry;
    }

    private sealed class InventoryBatch
    {
        public InventoryBatch(int remaining, DateTime? expiryDate)
        {
            Remaining = remaining;
            ExpiryDate = expiryDate;
        }

        public int Remaining { get; set; }
        public DateTime? ExpiryDate { get; }
    }
}
