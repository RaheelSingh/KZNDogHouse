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
    private readonly IUserProfileRepository _userProfileRepository;
    private readonly IDogMedicalService _dogMedicalService;
    private readonly IFosteringService _fosteringService;

    public DogsController(
        IDogService dogService,
        IUserProfileRepository userProfileRepository,
        IDogMedicalService dogMedicalService,
        IFosteringService fosteringService)
    {
        _dogService = dogService;
        _userProfileRepository = userProfileRepository;
        _dogMedicalService = dogMedicalService;
        _fosteringService = fosteringService;
    }
    [HttpGet]
    public async Task<IActionResult> Index(string? status)
    {
        var dogs = await _dogService.GetAllDogsAsync();

        ViewData["SelectedStatus"] = status;

        if (!string.IsNullOrWhiteSpace(status)
            && DogStatuses.All.Contains(status))
        {
            dogs = dogs.Where(x => x.Status == status).ToList();
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
    public async Task<IActionResult> Create(DogFormViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var currentAuthUserId =
            User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(currentAuthUserId))
        {
            return Challenge();
        }

        var currentProfile =
            await _userProfileRepository.GetByAuthUserIdAsync(currentAuthUserId);

        if (currentProfile == null)
        {
            return Challenge();
        }

        var dog = new Dog
        {
            Name = model.Name,
            Breed = model.Breed,
            DateOfBirth = model.DateOfBirth,
            EstimatedAgeYears = model.EstimatedAgeYears,
            Gender = model.Gender,
            Size = model.Size,
            WeightKg = model.WeightKg,
            EyeColour = model.EyeColour,
            Temperament = model.Temperament,
            About = model.About,
            KennelLocation = model.KennelLocation,
            IntakeDate = model.IntakeDate,
            IntakeType = model.IntakeType,
            Status = model.Status,
            IsVaccinated = model.IsVaccinated
        };

        await _dogService.RegisterDogAsync(dog, currentProfile.Id);

        TempData["SuccessMessage"] = $"{dog.Name} has been added.";

        return RedirectToAction(nameof(Index));
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
        EyeColour = dog.EyeColour,
        Temperament = dog.Temperament,
        About = dog.About,
        KennelLocation = dog.KennelLocation,
        IntakeDate = dog.IntakeDate,
        IntakeType = dog.IntakeType,
        Status = dog.Status,
        IsVaccinated = dog.IsVaccinated
    };

    ViewData["DogId"] = dog.Id;
    ViewData["DogName"] = dog.Name;

    return View(model);
}

[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Edit(Guid id, DogFormViewModel model)
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

    dog.Name = model.Name;
    dog.Breed = model.Breed;
    dog.DateOfBirth = model.DateOfBirth;
    dog.EstimatedAgeYears = model.EstimatedAgeYears;
    dog.Gender = model.Gender;
    dog.Size = model.Size;
    dog.WeightKg = model.WeightKg;
    dog.EyeColour = model.EyeColour;
    dog.Temperament = model.Temperament;
    dog.About = model.About;
    dog.KennelLocation = model.KennelLocation;
    dog.IntakeDate = model.IntakeDate;
    dog.IntakeType = model.IntakeType;
    dog.Status = model.Status;
    dog.IsVaccinated = model.IsVaccinated;
    dog.UpdatedAt = DateTime.UtcNow;

    await _dogService.UpdateDogAsync(dog);

    TempData["SuccessMessage"] = $"{dog.Name}'s profile has been updated.";

    return RedirectToAction(nameof(Details), new { id = dog.Id });
}

[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> UpdateStatus(Guid id, string status)
{
    if (!DogStatuses.All.Contains(status))
    {
        TempData["ErrorMessage"] = "The selected status is invalid.";
        return RedirectToAction(nameof(Details), new { id });
    }

    await _dogService.ChangeStatusAsync(id, status);

    TempData["SuccessMessage"] = "Status updated.";

    return RedirectToAction(nameof(Details), new { id });
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
            MedicalRecords = await _dogMedicalService.GetRecordsAsync(id),
            Notes = await _dogMedicalService.GetNotesAsync(id),
            FosteringHistory = await _fosteringService.GetHistoryForDogAsync(id)
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
        DateTime? nextActionDate)
    {
        var currentProfile = await GetCurrentProfileAsync();

        if (currentProfile == null)
        {
            return Challenge();
        }

        await _dogMedicalService.AddRecordAsync(
            dogId, recordType, title, details, vetName, nextActionDate, currentProfile.Id);

        TempData["SuccessMessage"] = "Medical record added.";

        return RedirectToAction(nameof(Details), new { id = dogId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResolveMedicalRecord(Guid dogId, Guid recordId)
    {
        await _dogMedicalService.ResolveRecordAsync(recordId);

        TempData["SuccessMessage"] = "Medical record marked as resolved.";

        return RedirectToAction(nameof(Details), new { id = dogId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AddNote(Guid dogId, string note)
    {
        var currentProfile = await GetCurrentProfileAsync();

        await _dogMedicalService.AddNoteAsync(dogId, note, currentProfile?.Id);

        TempData["SuccessMessage"] = "Note saved.";

        return RedirectToAction(nameof(Details), new { id = dogId });
    }

    private async Task<UserProfile?> GetCurrentProfileAsync()
    {
        var currentAuthUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(currentAuthUserId))
        {
            return null;
        }

        return await _userProfileRepository.GetByAuthUserIdAsync(currentAuthUserId);
    }
    
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> ReturnFromFostering(
    Guid dogId, Guid fosteringRecordId, string? feedback)
{
    await _fosteringService.ReturnDogAsync(fosteringRecordId, dogId, feedback);

    TempData["SuccessMessage"] = $"Dog marked as returned and status set to Available.";

    return RedirectToAction(nameof(Details), new { id = dogId });
}
}
