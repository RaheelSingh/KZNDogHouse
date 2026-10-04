using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Policy = AuthorizationPolicies.PortalAccess)]
public class PortalController : Controller
{
    private readonly IPortalDashboardService _dashboardService;

    public PortalController(
        IPortalDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    public async Task<IActionResult> Index()
    {
        var model =
            await _dashboardService.GetDashboardAsync();

        return View(model);
    }
}
