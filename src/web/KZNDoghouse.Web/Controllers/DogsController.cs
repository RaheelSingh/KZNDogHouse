using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator")]
public class DogsController : Controller
{
    private readonly IDogService _dogService;
    private readonly IDogImageService _dogImageService;
    private readonly IDogVideoService? _videoService;
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly IDogMedicalService _dogMedicalService;
    private readonly IDogDocumentService _documents;
    private readonly IMedicalAlertService _medicalAlerts;
    private readonly IFosteringService _fosteringService;
    private readonly ILogger<DogsController> _logger;

    public DogsController(
        IDogService dogService,
        IDogImageService dogImageService,
        IUserProfileRepository userProfileRepository,
        IDogMedicalService dogMedicalService,
        IDogDocumentService documents,
        IMedicalAlertService medicalAlerts,
        IFosteringService fosteringService,
        ILogger<DogsController> logger,
        IDogVideoService? videoService = null)
    {
        _dogService = dogService;
        _dogImageService = dogImageService;
        _videoService = videoService;
        _userProfileRepository = userProfileRepository;
        _dogMedicalService = dogMedicalService;
        _documents = documents;
        _medicalAlerts = medicalAlerts;
        _fosteringService = fosteringService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Index(string? status)
    {
        var dogs = await _dogService.GetAllDogsAsync();

        ViewData["SelectedStatus"] = status;

        if (!string.IsNullOrWhiteSpace(status)
            && DogStatuses.All.Contains(status))
        {
            dogs = dogs
                .Where(x => x.Status == status)
                .ToList();
        }

        return View(dogs);
    }

    [HttpGet]
    public IActionResult Create()
    {
        return View(new DogFormViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(
        DogFormViewModel model, IFormFile? video = null)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        TempData.Remove("SuccessMessage");
        TempData.Remove("ErrorMessage");

        var currentProfile =
            await GetCurrentProfileAsync();

        if (currentProfile == null)
        {
            return Challenge();
        }

        try
        {
            var dog = new Dog
            {
                Name = model.Name.Trim(),
                Breed = model.Breed?.Trim(),
                DateOfBirth = model.DateOfBirth,
                EstimatedAgeYears = model.EstimatedAgeYears,
                Gender = model.Gender,
                Size = model.Size,
                WeightKg = model.WeightKg,
                Temperament = model.Temperament?.Trim(),
                About = model.About?.Trim(),
                KennelLocation = model.KennelLocation?.Trim(),
                IntakeDate = model.IntakeDate,
                IntakeType = model.IntakeType,
                Status = model.Status,
                IsVaccinated = model.IsVaccinated,
                IsSpayedNeutered = model.IsSpayedNeutered
            };

            var createdDog =
                await _dogService.RegisterDogAsync(
                    dog,
                    currentProfile.Id);

            var upload =
                await _dogImageService.UploadAsync(
                    createdDog.Id,
                    model.Images,
                    currentProfile.Id);

            TempData["SuccessMessage"] =
                $"{createdDog.Name} has been added."
                + (upload.ChangedCount > 0
                    ? $" {upload.Message}"
                    : string.Empty);

            if (!upload.Success)
            {
                TempData["ErrorMessage"] = upload.Message;
            }

            if (video != null && _videoService != null)
            {
                var videoResult = await _videoService.UploadAsync(createdDog.Id, video);
                if (!videoResult.Success) TempData["ErrorMessage"] = videoResult.Message;
            }

            return RedirectToAction(
                nameof(Details),
                new { id = createdDog.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dog creation failed.");
            ModelState.AddModelError(
                string.Empty,
                "The dog could not be saved right now. Please check the details and try again.");
            return View(model);
        }
    }

    [HttpGet]
    public async Task<IActionResult> Edit(Guid id)
    {
        var dog = await _dogService.GetDogAsync(id);

        if (dog == null)
        {
            return NotFound();
        }

        var model = new DogFormViewModel
        {
            Name = dog.Name,
            Breed = dog.Breed,
            DateOfBirth = dog.DateOfBirth,
            EstimatedAgeYears = dog.EstimatedAgeYears,
            Gender = dog.Gender,
            Size = dog.Size,
            WeightKg = dog.WeightKg,
            Temperament = dog.Temperament,
            About = dog.About,
            KennelLocation = dog.KennelLocation,
            IntakeDate = dog.IntakeDate,
            IntakeType = dog.IntakeType,
            Status = dog.Status,
            IsVaccinated = dog.IsVaccinated,
            IsSpayedNeutered = dog.IsSpayedNeutered
        };

        ViewData["DogId"] = dog.Id;
        ViewData["DogName"] = dog.Name;

        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(
        Guid id,
        DogFormViewModel model, IFormFile? video = null)
    {
        if (!ModelState.IsValid)
        {
            ViewData["DogId"] = id;
            return View(model);
        }

        var dog = await _dogService.GetDogAsync(id);

        if (dog == null)
        {
            return NotFound();
        }

        try
        {
            dog.Name = model.Name.Trim();
            dog.Breed = model.Breed?.Trim();
            dog.DateOfBirth = model.DateOfBirth;
            dog.EstimatedAgeYears = model.EstimatedAgeYears;
            dog.Gender = model.Gender;
            dog.Size = model.Size;
            dog.WeightKg = model.WeightKg;
            dog.Temperament = model.Temperament?.Trim();
            dog.About = model.About?.Trim();
            dog.KennelLocation = model.KennelLocation?.Trim();
            dog.IntakeDate = model.IntakeDate;
            dog.IntakeType = model.IntakeType;
            dog.Status = model.Status;
            dog.IsVaccinated = model.IsVaccinated;
            dog.IsSpayedNeutered = model.IsSpayedNeutered;
            dog.UpdatedAt = DateTime.UtcNow;

            await _dogService.UpdateDogAsync(dog);

            var currentProfile =
                await GetCurrentProfileAsync();

            if (currentProfile != null)
            {
                var upload =
                    await _dogImageService.UploadAsync(
                        dog.Id,
                        model.Images,
                        currentProfile.Id);

                if (!upload.Success)
                {
                    TempData["ErrorMessage"] = upload.Message;
                }
            }

            if (video != null && _videoService != null)
            {
                var videoResult = await _videoService.UploadAsync(dog.Id, video);
                if (!videoResult.Success) TempData["ErrorMessage"] = videoResult.Message;
            }

            TempData["SuccessMessage"] =
                $"{dog.Name}'s profile has been updated.";

            return RedirectToAction(
                nameof(Details),
                new { id = dog.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dog update failed for {DogId}.", id);
            ViewData["DogId"] = id;
            ViewData["DogName"] = dog.Name;
            ModelState.AddModelError(
                string.Empty,
                "The dog could not be updated right now. Please try again.");
            return View(model);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UploadImages(
        Guid dogId,
        List<IFormFile> images)
    {
        var currentProfile =
            await GetCurrentProfileAsync();

        if (currentProfile == null)
        {
            return Challenge();
        }

        var result =
            await _dogImageService.UploadAsync(
                dogId,
                images,
                currentProfile.Id);

        TempData[result.Success
            ? "SuccessMessage"
            : "ErrorMessage"] = result.Message;

        return RedirectToAction(
            nameof(Details),
            new { id = dogId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetPrimaryImage(
        Guid dogId,
        Guid imageId)
    {
        var result =
            await _dogImageService.SetPrimaryAsync(
                dogId,
                imageId);

        TempData[result.Success
            ? "SuccessMessage"
            : "ErrorMessage"] = result.Message;

        return RedirectToAction(
            nameof(Details),
            new { id = dogId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteImage(
        Guid dogId,
        Guid imageId)
    {
        var result =
            await _dogImageService.DeleteAsync(
                dogId,
                imageId);

        TempData[result.Success
            ? "SuccessMessage"
            : "ErrorMessage"] = result.Message;

        return RedirectToAction(
            nameof(Details),
            new { id = dogId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        string status)
    {
        if (!DogStatuses.All.Contains(status))
        {
            TempData["ErrorMessage"] =
                "The selected status is invalid.";

            return RedirectToAction(
                nameof(Details),
                new { id });
        }

        await _dogService.ChangeStatusAsync(id, status);
        if (status == "Under Treatment")
        {
            try
            {
                var dog = await _dogService.GetDogAsync(id);
                await _medicalAlerts.NotifyAssignedVetsAsync(id, dog?.Name ?? "A dog", "Care status changed to Under Treatment");
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Dog status saved but assigned-vet alert failed."); }
        }

        TempData["SuccessMessage"] =
            "Status updated.";

        return RedirectToAction(
            nameof(Details),
            new { id });
    }

    [HttpGet]
    public async Task<IActionResult> Details(Guid id)
    {
        var dog = await _dogService.GetDogAsync(id);

        if (dog == null)
        {
            return NotFound();
        }

        var model = new DogDetailsViewModel
        {
            Dog = dog,
            Videos = _videoService == null ? Array.Empty<DogVideo>() : await _videoService.GetForDogAsync(id),
            MedicalRecords = await _dogMedicalService.GetRecordsAsync(id),
            Documents = await _documents.GetForDogAsync(id),
            Notes =
                await _dogMedicalService.GetNotesAsync(id),
            FosteringHistory =
                await _fosteringService.GetHistoryForDogAsync(id),
            Images =
                await _dogImageService.GetForDogAsync(id)
        };

        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddMedicalRecord(
        Guid dogId,
        string recordType,
        string title,
        string? details,
        string? vetName,
        DateTime? nextActionDate,
        IFormFile? attachment)
    {
        if (!MedicalRecordTypes.All.Contains(recordType)
            || string.IsNullOrWhiteSpace(title))
        {
            TempData["ErrorMessage"] =
                "Choose a valid medical record type and enter a title.";
            return RedirectToAction(
                nameof(Details),
                new { id = dogId });
        }

        var currentProfile =
            await GetCurrentProfileAsync();

        if (currentProfile == null)
        {
            return Challenge();
        }

        var createdRecord = await _dogMedicalService.AddRecordAsync(
            dogId,
            recordType,
            title.Trim(),
            details?.Trim(),
            vetName?.Trim(),
            nextActionDate,
            currentProfile.Id);

        TempData["SuccessMessage"] = "Medical record added.";
        if (attachment != null && attachment.Length > 0)
        {
            var result = await _documents.UploadAsync(dogId, createdRecord.Id, "Medical", attachment, currentProfile.Id);
            if (!result.Success) TempData["ErrorMessage"] = result.Message;
        }
        try
        {
            var dog = await _dogService.GetDogAsync(dogId);
            await _medicalAlerts.NotifyAssignedVetsAsync(dogId, dog?.Name ?? "A dog", title);
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Medical record saved but vet notification failed."); }

        return RedirectToAction(
            nameof(Details),
            new { id = dogId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResolveMedicalRecord(
        Guid dogId,
        Guid recordId)
    {
        await _dogMedicalService.ResolveRecordAsync(recordId);
        try
        {
            var dog = await _dogService.GetDogAsync(dogId);
            await _medicalAlerts.NotifyAssignedVetsAsync(dogId, dog?.Name ?? "A dog", "A medical record was resolved");
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Record resolved but vet alert failed."); }

        TempData["SuccessMessage"] =
            "Medical record marked as resolved.";

        return RedirectToAction(
            nameof(Details),
            new { id = dogId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddNote(
        Guid dogId,
        string note)
    {
        if (string.IsNullOrWhiteSpace(note))
        {
            TempData["ErrorMessage"] = "Enter a note before saving.";
            return RedirectToAction(
                nameof(Details),
                new { id = dogId });
        }

        var currentProfile =
            await GetCurrentProfileAsync();

        await _dogMedicalService.AddNoteAsync(
            dogId,
            note.Trim(),
            currentProfile?.Id);

        TempData["SuccessMessage"] =
            "Note saved.";

        return RedirectToAction(
            nameof(Details),
            new { id = dogId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ReturnFromFostering(
        Guid dogId,
        Guid fosteringRecordId,
        string? feedback)
    {
        await _fosteringService.ReturnDogAsync(
            fosteringRecordId,
            dogId,
            feedback);

        TempData["SuccessMessage"] =
            "Dog marked as returned and status set to Available.";

        return RedirectToAction(
            nameof(Details),
            new { id = dogId });
    }

    private async Task<UserProfile?> GetCurrentProfileAsync()
    {
        var currentAuthUserId =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(currentAuthUserId))
        {
            return null;
        }

        return await _userProfileRepository
            .GetByAuthUserIdAsync(currentAuthUserId);
    }
}
