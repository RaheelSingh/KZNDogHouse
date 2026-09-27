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

    public DogsController(
        IDogService dogService,
        IUserProfileRepository userProfileRepository)
    {
        _dogService = dogService;
        _userProfileRepository = userProfileRepository;
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
}
