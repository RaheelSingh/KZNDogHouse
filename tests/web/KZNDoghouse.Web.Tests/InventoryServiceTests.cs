using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class InventoryServiceTests
{
    [Fact]
    public async Task RecordTransactionAsync_UsageAlwaysReducesStock_EvenIfPositiveValueEntered()
    {
        var itemId = Guid.NewGuid();
        var item = new InventoryItem { Id = itemId, Name = "Dog food", Quantity = 10, LowStockThreshold = 2 };
        var repository = new Mock<IInventoryRepository>();
        repository.Setup(x => x.GetItemByIdAsync(itemId)).ReturnsAsync(item);
        var service = new InventoryService(repository.Object);

        var result = await service.RecordTransactionAsync(
            itemId,
            InventoryTransactionTypes.Usage,
            quantityChange: 3,
            expiryDate: null,
            notes: null,
            updatedByProfileId: Guid.NewGuid());

        Assert.True(result.Success);
        repository.Verify(x => x.UpdateItemQuantityAsync(itemId, 7), Times.Once);
    }

    [Fact]
    public async Task RecordTransactionAsync_RejectsTransactionThatWouldGoBelowZero()
    {
        var itemId = Guid.NewGuid();
        var item = new InventoryItem { Id = itemId, Name = "Dog food", Quantity = 2, LowStockThreshold = 2 };
        var repository = new Mock<IInventoryRepository>();
        repository.Setup(x => x.GetItemByIdAsync(itemId)).ReturnsAsync(item);
        var service = new InventoryService(repository.Object);

        var result = await service.RecordTransactionAsync(
            itemId,
            InventoryTransactionTypes.Usage,
            quantityChange: 5,
            expiryDate: null,
            notes: null,
            updatedByProfileId: Guid.NewGuid());

        Assert.False(result.Success);
        repository.Verify(x => x.UpdateItemQuantityAsync(It.IsAny<Guid>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task RecordTransactionAsync_ReturnsLowStockWarning_WhenThresholdCrossed()
    {
        var itemId = Guid.NewGuid();
        var item = new InventoryItem { Id = itemId, Name = "Dog food", Quantity = 5, LowStockThreshold = 3 };
        var repository = new Mock<IInventoryRepository>();
        repository.Setup(x => x.GetItemByIdAsync(itemId)).ReturnsAsync(item);
        var service = new InventoryService(repository.Object);

        var result = await service.RecordTransactionAsync(
            itemId,
            InventoryTransactionTypes.Usage,
            quantityChange: 3,
            expiryDate: null,
            notes: null,
            updatedByProfileId: Guid.NewGuid());

        Assert.Contains("low-stock threshold", result.Message);
    }

    [Fact]
    public async Task GetPageAsync_DoesNotShowExpiryForBatchThatHasBeenFullyUsed()
    {
        var itemId = Guid.NewGuid();
        var oldExpiry = DateTime.UtcNow.Date.AddDays(5);
        var futureExpiry = DateTime.UtcNow.Date.AddDays(40);

        var repository = new Mock<IInventoryRepository>();
        repository.Setup(x => x.GetAllItemsAsync()).ReturnsAsync(new List<InventoryItem>
        {
            new() { Id = itemId, Name = "Dog food", Quantity = 6, LowStockThreshold = 2 }
        });
        repository.Setup(x => x.GetAllTransactionsAsync()).ReturnsAsync(new List<InventoryTransaction>
        {
            new() { ItemId = itemId, QuantityChange = 5, ExpiryDate = oldExpiry, TransactionDate = DateTime.UtcNow.AddDays(-5) },
            new() { ItemId = itemId, QuantityChange = -5, TransactionDate = DateTime.UtcNow.AddDays(-4) },
            new() { ItemId = itemId, QuantityChange = 6, ExpiryDate = futureExpiry, TransactionDate = DateTime.UtcNow.AddDays(-3) }
        });

        var service = new InventoryService(repository.Object);
        var page = await service.GetPageAsync();

        Assert.Single(page.Items);
        Assert.Equal(futureExpiry, page.Items[0].NextExpiryDate);
    }

    [Fact]
    public async Task UpdateItemDetailsAsync_UpdatesEditableFieldsWithoutChangingQuantity()
    {
        var itemId = Guid.NewGuid();
        var repository = new Mock<IInventoryRepository>();
        repository.Setup(x => x.GetItemByIdAsync(itemId)).ReturnsAsync(new InventoryItem
        {
            Id = itemId,
            Name = "Food",
            Quantity = 12
        });

        var service = new InventoryService(repository.Object);
        var result = await service.UpdateItemDetailsAsync(itemId, "Puppy food", "Food", "bags", 3);

        Assert.True(result.Success);
        repository.Verify(x => x.UpdateItemDetailsAsync(itemId, "Puppy food", "Food", "bags", 3), Times.Once);
        repository.Verify(x => x.UpdateItemQuantityAsync(It.IsAny<Guid>(), It.IsAny<int>()), Times.Never);
    }
}
