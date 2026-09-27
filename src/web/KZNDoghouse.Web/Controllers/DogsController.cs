using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator")]
public class DogsController : Controller
{
    private readonly IDogService _dogService;

    public DogsController(IDogService dogService)
    {
        _dogService = dogService;
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
}