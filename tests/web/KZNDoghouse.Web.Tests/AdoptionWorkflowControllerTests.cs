using System.Security.Claims;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Controllers;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Moq;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class AdoptionWorkflowControllerTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-an-email")]
    public async Task CreatingAdoption_RequiresValidEmail(string? email)
    {
        var dogId = Guid.NewGuid();
        var adoptions = new Mock<IAdoptionRecordRepository>();
        var dogs = new Mock<IDogService>();
        dogs.Setup(x => x.GetDogAsync(dogId)).ReturnsAsync(new Dog { Id = dogId, Status = DogStatuses.Available });
        var controller = Build(adoptions, dogs, new Mock<IDogDocumentService>(), new Mock<IUserProfileRepository>());

        await controller.Create(dogId, "Person", "071 234 5678", "Street", email, null, null);

        adoptions.Verify(x => x.CreateAsync(It.IsAny<AdoptionRecord>()), Times.Never);
        Assert.Equal("A valid adopter email address is required.", controller.TempData["ErrorMessage"]);
    }

    [Fact]
    public async Task CreatingAdoption_LinksInitialDocumentsToNewRecord()
    {
        var dogId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var dogs = new Mock<IDogService>();
        dogs.Setup(x => x.GetDogAsync(dogId)).ReturnsAsync(new Dog { Id = dogId, Status = DogStatuses.Available });
        var adoptions = new Mock<IAdoptionRecordRepository>();
        adoptions.Setup(x => x.GetForDogAsync(dogId)).ReturnsAsync((IReadOnlyList<AdoptionRecord>)Array.Empty<AdoptionRecord>());
        adoptions.Setup(x => x.CreateAsync(It.IsAny<AdoptionRecord>()))
            .ReturnsAsync((AdoptionRecord record) => record);
        var profiles = new Mock<IUserProfileRepository>();
        profiles.Setup(x => x.GetByAuthUserIdAsync("test-auth")).ReturnsAsync(new UserProfile { Id = profileId });
        var documents = new Mock<IDogDocumentService>();
        documents.Setup(x => x.UploadAsync(dogId, null, "Adoption", It.IsAny<IFormFile?>(), profileId, null, It.IsAny<Guid?>()))
            .ReturnsAsync(new DocumentUploadResult(true, "Saved"));
        var first = new Mock<IFormFile>();
        first.SetupGet(x => x.Length).Returns(100);
        var second = new Mock<IFormFile>();
        second.SetupGet(x => x.Length).Returns(200);
        var controller = Build(adoptions, dogs, documents, profiles);
        controller.ControllerContext.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-auth")
        }, "test"));

        await controller.Create(dogId, "Person", "071 234 5678", "Street", "person@example.com", null,
            [first.Object, second.Object]);

        adoptions.Verify(x => x.CreateAsync(It.Is<AdoptionRecord>(record =>
            record.AdopterEmail == "person@example.com" && record.Status == "Pending paperwork")), Times.Once);
        documents.Verify(x => x.UploadAsync(dogId, null, "Adoption", It.IsAny<IFormFile?>(), profileId,
            null, It.IsAny<Guid?>()), Times.Exactly(2));
        Assert.NotNull(controller.TempData["SuccessMessage"]);
    }

    [Fact]
    public async Task AdoptedRecord_CanReceiveAdditionalPrivateDocuments()
    {
        var dogId = Guid.NewGuid();
        var recordId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var adoptions = new Mock<IAdoptionRecordRepository>();
        adoptions.Setup(x => x.GetAsync(recordId)).ReturnsAsync(new AdoptionRecord
        {
            Id = recordId, DogId = dogId, Status = "Adopted"
        });
        var profiles = new Mock<IUserProfileRepository>();
        profiles.Setup(x => x.GetByAuthUserIdAsync("test-auth")).ReturnsAsync(new UserProfile { Id = profileId });
        var documentService = new Mock<IDogDocumentService>();
        documentService.Setup(x => x.UploadAsync(dogId, null, "Adoption", It.IsAny<IFormFile?>(), profileId, null, recordId))
            .ReturnsAsync(new DocumentUploadResult(true, "Document uploaded securely."));
        var controller = Build(adoptions, new Mock<IDogService>(), documentService, profiles);
        controller.ControllerContext.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-auth")
        }, "test"));
        var upload = new Mock<IFormFile>();

        await controller.UploadAgreement(dogId, recordId, upload.Object);

        documentService.Verify(x => x.UploadAsync(dogId, null, "Adoption", upload.Object, profileId, null, recordId), Times.Once);
        Assert.Equal("Document uploaded securely.", controller.TempData["SuccessMessage"]);
    }

    [Fact]
    public async Task ReturningRecord_RequiresDogToStillBeAdopted()
    {
        var dogId = Guid.NewGuid();
        var recordId = Guid.NewGuid();
        var adoptions = new Mock<IAdoptionRecordRepository>();
        adoptions.Setup(x => x.GetAsync(recordId)).ReturnsAsync(new AdoptionRecord { Id = recordId, DogId = dogId, Status = "Adopted" });
        var dogs = new Mock<IDogService>();
        dogs.Setup(x => x.GetDogAsync(dogId)).ReturnsAsync(new Dog { Id = dogId, Status = DogStatuses.Fostered });
        var controller = Build(adoptions, dogs, new Mock<IDogDocumentService>(), new Mock<IUserProfileRepository>());

        await controller.Return(dogId, recordId, null);

        adoptions.Verify(x => x.SetReturnedAsync(It.IsAny<Guid>(), It.IsAny<string?>()), Times.Never);
        dogs.Verify(x => x.ChangeStatusAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
    }

    private static AdoptionRecordsController Build(
        Mock<IAdoptionRecordRepository> adoptions, Mock<IDogService> dogs,
        Mock<IDogDocumentService> documents, Mock<IUserProfileRepository> profiles)
    {
        var controller = new AdoptionRecordsController(adoptions.Object, dogs.Object, documents.Object, profiles.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        var provider = new Mock<ITempDataProvider>();
        provider.Setup(x => x.LoadTempData(It.IsAny<HttpContext>()))
            .Returns(new Dictionary<string, object>());
        controller.TempData = new TempDataDictionary(controller.HttpContext, provider.Object);
        return controller;
    }
}
