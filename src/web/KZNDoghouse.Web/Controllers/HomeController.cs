using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Services;

namespace KZNDoghouse.Web.Controllers;

public class HomeController : Controller
{
    private const int FeaturedDogCount = 4;

    private readonly IDogService _dogService;
    private readonly ILogger<HomeController> _logger;

    public HomeController(
        IDogService dogService,
        ILogger<HomeController> logger)
    {
        _dogService = dogService;
        _logger = logger;
    }

    public async Task<IActionResult> Index()
    {
        var model = new HomeViewModel();

        try
        {
            var dogs = await _dogService.GetPublicDogsAsync();

            model.FeaturedDogs = dogs
                .Take(FeaturedDogCount)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Featured dogs could not be loaded for the home page.");
        }

        return View(model);
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
