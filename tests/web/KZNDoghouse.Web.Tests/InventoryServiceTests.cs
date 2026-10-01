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
            itemId, InventoryTransactionTypes.Usage, quantityChange: 3,
            expiryDate: null, notes: null, updatedByProfileId: Guid.NewGuid());

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
            itemId, InventoryTransactionTypes.Usage, quantityChange: 5,
            expiryDate: null, notes: null, updatedByProfileId: Guid.NewGuid());

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
            itemId, InventoryTransactionTypes.Usage, quantityChange: 3,
            expiryDate: null, notes: null, updatedByProfileId: Guid.NewGuid());

        Assert.Contains("low-stock threshold", result.Message);
    }
}