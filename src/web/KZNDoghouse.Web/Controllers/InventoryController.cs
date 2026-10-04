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
    private readonly IMediaStorageService _mediaStorageService;
    private readonly ILogger<InventoryController> _logger;

    public InventoryController(
        IInventoryService inventoryService,
        IUserProfileRepository userProfileRepository,
        IMediaStorageService mediaStorageService,
        ILogger<InventoryController> logger)
    {
        _inventoryService = inventoryService;
        _userProfileRepository = userProfileRepository;
        _mediaStorageService = mediaStorageService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        try
        {
            return View(
                await _inventoryService.GetPageAsync());
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Inventory could not be loaded.");

            TempData["ErrorMessage"] =
                "Inventory could not be loaded right now.";

            return View(
                new KZNDoghouse.Web.Models.InventoryPageViewModel());
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateItem(
        string name,
        string? category,
        string? unit,
        int initialQuantity,
        int lowStockThreshold,
        DateTime? initialExpiryDate,
        IFormFile? imageFile)
    {
        var profile = await GetCurrentProfileAsync();

        if (profile == null)
        {
            return Challenge();
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            TempData["ErrorMessage"] =
                "Item name is required.";

            return RedirectToAction(nameof(Index));
        }

        try
        {
            var item =
                await _inventoryService.CreateItemAsync(
                    name,
                    category,
                    unit,
                    Math.Max(0, initialQuantity),
                    Math.Max(0, lowStockThreshold),
                    initialExpiryDate,
                    profile.Id);

            if (imageFile != null && imageFile.Length > 0)
            {
                var upload =
                    await _mediaStorageService.UploadPublicImageAsync(
                        imageFile,
                        StorageFolders.Inventory,
                        item.Id);

                if (upload.Success)
                {
                    await _inventoryService.UpdateImageAsync(
                        item.Id,
                        upload.StoragePath,
                        upload.PublicUrl);
                }
                else
                {
                    TempData["ErrorMessage"] =
                        $"The item was created, but its image was not uploaded. {upload.Message}";
                }
            }

            TempData["SuccessMessage"] =
                $"{item.Name} added to inventory.";
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Inventory item {InventoryItemName} could not be created.",
                name);

            TempData["ErrorMessage"] =
                "The inventory item could not be saved. Check the database setup and try again.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RecordTransaction(
        Guid itemId,
        string transactionType,
        int quantityChange,
        DateTime? expiryDate,
        string? notes)
    {
        var profile = await GetCurrentProfileAsync();

        if (profile == null)
        {
            return Challenge();
        }

        try
        {
            var result =
                await _inventoryService.RecordTransactionAsync(
                    itemId,
                    transactionType,
                    quantityChange,
                    expiryDate,
                    notes,
                    profile.Id);

            TempData[result.Success
                ? "SuccessMessage"
                : "ErrorMessage"] = result.Message;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Inventory transaction for item {InventoryItemId} failed.",
                itemId);

            TempData["ErrorMessage"] =
                "The stock change could not be saved.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateImage(
        Guid itemId,
        IFormFile imageFile)
    {
        try
        {
            var item =
                await _inventoryService.GetItemAsync(itemId);

            if (item == null)
            {
                return NotFound();
            }

            var upload =
                await _mediaStorageService.UploadPublicImageAsync(
                    imageFile,
                    StorageFolders.Inventory,
                    itemId);

            if (!upload.Success)
            {
                TempData["ErrorMessage"] = upload.Message;
                return RedirectToAction(nameof(Index));
            }

            var oldPath = item.ImagePath;

            await _inventoryService.UpdateImageAsync(
                itemId,
                upload.StoragePath,
                upload.PublicUrl);

            await _mediaStorageService
                .DeletePublicImageAsync(oldPath);

            TempData["SuccessMessage"] =
                "Inventory image updated.";
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Image for inventory item {InventoryItemId} could not be updated.",
                itemId);

            TempData["ErrorMessage"] =
                "The inventory image could not be updated.";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task<KZNDoghouse.Web.Models.UserProfile?>
        GetCurrentProfileAsync()
    {
        var authId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(authId))
        {
            return null;
        }

        return await _userProfileRepository
            .GetByAuthUserIdAsync(authId);
    }
}
