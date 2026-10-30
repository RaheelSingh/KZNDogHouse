using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KZNDoghouse.Web.Controllers;

[Authorize(Roles = "Staff,Administrator")]
public sealed class AdoptionRecordsController : Controller
{
    private readonly IAdoptionRecordRepository _adoptions;
    private readonly IDogService _dogs;
    private readonly IDogDocumentService _documents;
    private readonly IUserProfileRepository _profiles;
    public AdoptionRecordsController(IAdoptionRecordRepository adoptions, IDogService dogs,
        IDogDocumentService documents, IUserProfileRepository profiles)
    {
        _adoptions = adoptions; _dogs = dogs; _documents = documents; _profiles = profiles;
    }

    private Task<IActionResult> Back(Guid dogId, string message, bool success = false)
    {
        TempData[success ? "SuccessMessage" : "ErrorMessage"] = message;
        return Task.FromResult<IActionResult>(RedirectToAction("Details", "Dogs", new { id = dogId }));
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(Guid dogId, string adopterName, string adopterPhone,
        string adopterAddress, string? adopterEmail, string? notes)
    {
        var dog = await _dogs.GetDogAsync(dogId);
        if (dog == null) return NotFound();
        if (dog.Status is DogStatuses.Fostered or DogStatuses.Adopted)
            return await Back(dogId, "A fostered or adopted dog cannot start a new adoption.");
        if (string.IsNullOrWhiteSpace(adopterName) || adopterName.Length > 160
            || string.IsNullOrWhiteSpace(adopterPhone) || adopterPhone.Length > 30
            || string.IsNullOrWhiteSpace(adopterAddress) || adopterAddress.Length > 400
            || (adopterEmail?.Length ?? 0) > 180 || (notes?.Length ?? 0) > 2000)
            return await Back(dogId, "Enter a valid adopter name, phone number, and address.");
        if (!string.IsNullOrWhiteSpace(adopterEmail) && !new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(adopterEmail))
            return await Back(dogId, "Enter a valid email address.");
        if ((await _adoptions.GetForDogAsync(dogId)).Any(x => x.Status is "Pending paperwork" or "Adopted"))
            return await Back(dogId, "This dog already has an open adoption record.");
        var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var profile = string.IsNullOrEmpty(authId) ? null : await _profiles.GetByAuthUserIdAsync(authId);
        if (profile == null) return Challenge();
        var record = new AdoptionRecord
        {
            Id = Guid.NewGuid(), DogId = dogId, AdopterName = adopterName.Trim(),
            AdopterPhone = adopterPhone.Trim(), AdopterEmail = adopterEmail?.Trim(),
            AdopterAddress = adopterAddress.Trim(), Notes = notes?.Trim(),
            CreatedBy = profile.Id, CreatedAt = DateTime.UtcNow, Status = "Pending paperwork"
        };
        await _adoptions.CreateAsync(record);
        return await Back(dogId, "Adoption record created. Upload signed paperwork before confirming.", true);
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> UploadAgreement(Guid dogId, Guid recordId, IFormFile? file)
    {
        var record = await _adoptions.GetAsync(recordId);
        if (record == null || record.DogId != dogId) return NotFound();
        if (record.Status != "Pending paperwork") return await Back(dogId, "Paperwork cannot be changed after completion.");
        var authId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var profile = string.IsNullOrEmpty(authId) ? null : await _profiles.GetByAuthUserIdAsync(authId);
        if (profile == null) return Challenge();
        var result = await _documents.UploadAsync(dogId, null, "Adoption", file, profile.Id,
            adoptionRecordId: recordId);
        return await Back(dogId, result.Message, result.Success);
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> Confirm(Guid dogId, Guid recordId)
    {
        var record = await _adoptions.GetAsync(recordId);
        var dog = await _dogs.GetDogAsync(dogId);
        if (record == null || dog == null || record.DogId != dogId) return NotFound();
        if (record.Status != "Pending paperwork" || dog.Status is DogStatuses.Adopted or DogStatuses.Fostered)
            return await Back(dogId, "This adoption is not eligible for confirmation.");
        if (!(await _documents.GetForDogAsync(dogId)).Any(d => d.AdoptionRecordId == recordId && d.Category == "Adoption"))
            return await Back(dogId, "Upload the signed adoption agreement before confirming.");
        await _adoptions.SetAdoptedAsync(recordId);
        await _dogs.ChangeStatusAsync(dogId, DogStatuses.Adopted);
        return await Back(dogId, "Adoption confirmed.", true);
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> Return(Guid dogId, Guid recordId, string? returnNotes)
    {
        var record = await _adoptions.GetAsync(recordId);
        if (record == null || record.DogId != dogId) return NotFound();
        if (record.Status != "Adopted") return await Back(dogId, "Only an active adoption can be returned.");
        if ((returnNotes?.Length ?? 0) > 2000) return await Back(dogId, "Return notes are too long.");
        await _adoptions.SetReturnedAsync(recordId, returnNotes?.Trim());
        await _dogs.ChangeStatusAsync(dogId, DogStatuses.Available);
        return await Back(dogId, "Dog returned from adoption and marked available.", true);
    }
}
