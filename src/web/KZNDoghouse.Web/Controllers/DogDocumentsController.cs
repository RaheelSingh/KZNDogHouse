using System.Security.Claims;
using KZNDoghouse.Web.Services;
using KZNDoghouse.Web.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator,Vet")]
public class DogDocumentsController : Controller
{
    private readonly IDogDocumentService _documents;
    private readonly IVetAccessService _vetAccess;
    private readonly IUserProfileRepository _users;

    public DogDocumentsController(IDogDocumentService documents, IVetAccessService vetAccess, IUserProfileRepository users)
    {
        _documents = documents;
        _vetAccess = vetAccess;
        _users = users;
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Upload(Guid dogId, string category, IFormFile? file)
    {
        // Foster and adoption paperwork must be associated with a reviewed application
        // or adoption record, not uploaded as an unlinked dog-wide file.
        if (category != "Medical") return BadRequest();
        var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(authId)) return Challenge();
        var profile = await _users.GetByAuthUserIdAsync(authId);
        if (profile == null) return Challenge();
        if (User.IsInRole("Vet"))
        {
            if (category != "Medical" || await _vetAccess.GetAuthorizedDogDetailsAsync(authId, dogId) == null) return Forbid();
        }
        var uploaded = await _documents.UploadAsync(dogId, null, category, file, profile.Id);
        TempData[uploaded.Success ? "SuccessMessage" : "ErrorMessage"] = uploaded.Message;
        return RedirectToAction("Details", User.IsInRole("Vet") ? "VetDogs" : "Dogs", new { id = dogId });
    }

    [HttpGet]
    public async Task<IActionResult> Download(Guid id)
    {
        var document = await _documents.GetAsync(id);
        if (document == null) return NotFound();
        if (User.IsInRole("Vet"))
        {
            if (document.Category != "Medical") return Forbid();
            var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(authId) || await _vetAccess.GetAuthorizedDogDetailsAsync(authId, document.DogId) == null) return Forbid();
        }
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        var bytes = await _documents.DownloadAsync(document);
        return File(bytes, document.ContentType, document.FileName);
    }
}
