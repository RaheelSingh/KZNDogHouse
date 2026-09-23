using KZNDoghouse.Web.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Policy = AuthorizationPolicies.PortalAccess)]
public class PortalController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}