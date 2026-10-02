using System.ComponentModel.DataAnnotations;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Models;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Moq;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class ContactMessageTests
{
    private static ContactFormViewModel ValidForm() => new()
    {
        FirstName = "Jane",
        LastName = "Smith",
        Email = "jane@example.com",
        Phone = "031 123 4567",
        Topic = "Adoption",
        Message = "Hello there"
    };

    private static List<ValidationResult> Validate(ContactFormViewModel form)
    {
        var results = new List<ValidationResult>();

        Validator.TryValidateObject(form, new ValidationContext(form), results, true);

        return results;
    }

    private static bool HasErrorFor(List<ValidationResult> results, string member) =>
        results.Any(x => x.MemberNames.Contains(member));

    [Fact]
    public void Validate_AcceptsCompleteForm()
    {
        Assert.Empty(Validate(ValidForm()));
    }

    [Fact]
    public void Validate_AcceptsMissingPhone_BecauseItIsOptional()
    {
        var form = ValidForm();
        form.Phone = null;

        Assert.Empty(Validate(form));

        form.Phone = string.Empty;

        Assert.Empty(Validate(form));
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("12")]
    [InlineData("<script>")]
    public void Validate_RejectsInvalidPhone(string phone)
    {
        var form = ValidForm();
        form.Phone = phone;

        Assert.True(HasErrorFor(Validate(form), nameof(form.Phone)));
    }

    [Fact]
    public void Validate_RejectsInvalidEmail()
    {
        var form = ValidForm();
        form.Email = "not-an-email";

        Assert.True(HasErrorFor(Validate(form), nameof(form.Email)));
    }

    [Fact]
    public void Validate_RequiresNamesTopicAndMessage()
    {
        var form = ValidForm();
        form.FirstName = string.Empty;
        form.LastName = string.Empty;
        form.Topic = string.Empty;
        form.Message = string.Empty;

        var results = Validate(form);

        Assert.True(HasErrorFor(results, nameof(form.FirstName)));
        Assert.True(HasErrorFor(results, nameof(form.LastName)));
        Assert.True(HasErrorFor(results, nameof(form.Topic)));
        Assert.True(HasErrorFor(results, nameof(form.Message)));
    }

    [Fact]
    public void Validate_RejectsUnknownTopic()
    {
        var form = ValidForm();
        form.Topic = "Spam";

        Assert.True(HasErrorFor(Validate(form), nameof(form.Topic)));
    }

    [Fact]
    public void Validate_LimitsMessageLength()
    {
        var form = ValidForm();
        form.Message = new string('a', 2001);

        Assert.True(HasErrorFor(Validate(form), nameof(form.Message)));
    }

    [Theory]
    [InlineData("fostering", "Fostering")]
    [InlineData("VOLUNTEERING", "Volunteering")]
    [InlineData(" adoption ", "Adoption")]
    [InlineData("donations", "Donations & partnerships")]
    [InlineData("other", "Something else")]
    public void FromKey_ReturnsTheMatchingTopic(string key, string expected)
    {
        Assert.Equal(expected, ContactTopics.FromKey(key));
    }

    [Theory]
    [InlineData("nope")]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("Donations & partnerships")]
    public void FromKey_ReturnsNull_ForUnknownKeys(string? key)
    {
        Assert.Null(ContactTopics.FromKey(key));
    }

    [Fact]
    public void FromKey_OnlyEverReturnsListedTopics()
    {
        foreach (var key in new[] { "fostering", "volunteering", "adoption", "donations", "other" })
        {
            Assert.Contains(ContactTopics.FromKey(key), ContactTopics.All);
        }
    }

    [Fact]
    public async Task SubmitAsync_SavesTrimmedMessage_WithTheSenderProfile()
    {
        var repository = new Mock<IContactMessageRepository>();
        ContactMessage? saved = null;

        repository
            .Setup(x => x.CreateAsync(It.IsAny<ContactMessage>()))
            .Callback<ContactMessage>(m => saved = m)
            .ReturnsAsync((ContactMessage m) => m);

        var profileId = Guid.NewGuid();
        var form = ValidForm();
        form.FirstName = " Jane ";
        form.Phone = "   ";
        form.Message = " Hello there ";

        await new ContactMessageService(repository.Object).SubmitAsync(form, profileId);

        Assert.NotNull(saved);
        Assert.NotEqual(Guid.Empty, saved!.Id);
        Assert.Equal("Jane", saved.FirstName);
        Assert.Null(saved.Phone);
        Assert.Equal("Hello there", saved.Message);
        Assert.Equal("Adoption", saved.Topic);
        Assert.Equal(profileId, saved.SubmittedByUserId);
        Assert.False(saved.IsHandled);
        Assert.True((DateTime.UtcNow - saved.CreatedAt).TotalSeconds < 5);
    }

    [Fact]
    public async Task SubmitAsync_SavesMessage_ForGuestsWithoutAProfile()
    {
        var repository = new Mock<IContactMessageRepository>();
        ContactMessage? saved = null;

        repository
            .Setup(x => x.CreateAsync(It.IsAny<ContactMessage>()))
            .Callback<ContactMessage>(m => saved = m)
            .ReturnsAsync((ContactMessage m) => m);

        await new ContactMessageService(repository.Object).SubmitAsync(ValidForm(), null);

        Assert.Null(saved!.SubmittedByUserId);
    }

    [Theory]
    [InlineData("http://spam.example")]
    [InlineData("x")]
    [InlineData(" y ")]
    public async Task SubmitAsync_SavesNothing_WhenTheHiddenSpamFieldIsFilled(string trap)
    {
        var repository = new Mock<IContactMessageRepository>();
        var form = ValidForm();
        form.Website = trap;

        await new ContactMessageService(repository.Object).SubmitAsync(form, null);

        repository.Verify(x => x.CreateAsync(It.IsAny<ContactMessage>()), Times.Never);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task SubmitAsync_Saves_WhenTheHiddenSpamFieldIsEmpty(string? trap)
    {
        var repository = new Mock<IContactMessageRepository>();

        repository
            .Setup(x => x.CreateAsync(It.IsAny<ContactMessage>()))
            .ReturnsAsync((ContactMessage m) => m);

        var form = ValidForm();
        form.Website = trap;

        await new ContactMessageService(repository.Object).SubmitAsync(form, null);

        repository.Verify(x => x.CreateAsync(It.IsAny<ContactMessage>()), Times.Once);
    }
}
