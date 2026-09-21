using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

public class PortalController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}