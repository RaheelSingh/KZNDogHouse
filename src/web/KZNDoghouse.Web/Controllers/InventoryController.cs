using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator")]
public class InventoryController : Controller
{
    private readonly IInventoryService _inventoryService;
    private readonly IUserProfileRepository _userProfileRepository;

    public InventoryController(
        IInventoryService inventoryService,
        IUserProfileRepository userProfileRepository)
    {
        _inventoryService = inventoryService;
        _userProfileRepository = userProfileRepository;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var items = await _inventoryService.GetAllItemsAsync();

        return View(items);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateItem(
        string name, string? category, string? unit, int initialQuantity, int lowStockThreshold)
    {
        await _inventoryService.CreateItemAsync(name, category, unit, initialQuantity, lowStockThreshold);

        TempData["SuccessMessage"] = $"{name} added to inventory.";

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RecordTransaction(
        Guid itemId, string transactionType, int quantityChange, DateTime? expiryDate, string? notes)
    {
        var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(authId))
        {
            return Challenge();
        }

        var profile = await _userProfileRepository.GetByAuthUserIdAsync(authId);

        if (profile == null)
        {
            return Challenge();
        }

        var result = await _inventoryService.RecordTransactionAsync(
            itemId, transactionType, quantityChange, expiryDate, notes, profile.Id);

        TempData[result.Success ? "SuccessMessage" : "ErrorMessage"] = result.Message;

        return RedirectToAction(nameof(Index));
    }
}