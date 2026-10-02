using KZNDoghouse.Web.Models;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class PublicDogFilterTests
{
    private static List<PublicDogListItem> SampleDogs() => new()
    {
        new() { Name = "Rocco", Size = "Medium", Status = "Available", IntakeDate = new DateTime(2026, 3, 1) },
        new() { Name = "Poppy", Size = "Small", Status = "Fostered", IntakeDate = new DateTime(2026, 5, 1) },
        new() { Name = "Biscuit", Size = "large", Status = "Available", IntakeDate = new DateTime(2026, 1, 1) },
        new() { Name = "Maple", Size = null, Status = "Fostered", IntakeDate = new DateTime(2026, 4, 1) }
    };

    private static string[] Names(IEnumerable<PublicDogListItem> dogs) =>
        dogs.Select(x => x.Name).ToArray();

    [Fact]
    public void Apply_SortsNewestFirst_ByDefault()
    {
        var filter = PublicDogFilter.Create(null, null, null, null);

        var result = filter.Apply(SampleDogs());

        Assert.Equal(new[] { "Poppy", "Maple", "Rocco", "Biscuit" }, Names(result));
    }

    [Fact]
    public void Apply_SortsByName_WhenRequested()
    {
        var filter = PublicDogFilter.Create(null, null, "NAME", null);

        var result = filter.Apply(SampleDogs());

        Assert.Equal(new[] { "Biscuit", "Maple", "Poppy", "Rocco" }, Names(result));
    }

    [Theory]
    [InlineData("Large", "Biscuit")]
    [InlineData("large", "Biscuit")]
    [InlineData("small", "Poppy")]
    [InlineData("MEDIUM", "Rocco")]
    public void Apply_FiltersBySize_IgnoringCase(string size, string expectedName)
    {
        var filter = PublicDogFilter.Create(size, null, null, null);

        var result = filter.Apply(SampleDogs());

        Assert.Equal(expectedName, Assert.Single(result).Name);
    }

    [Fact]
    public void Apply_FiltersReadyToAdopt_ToDogsThatAreNotFostered()
    {
        var filter = PublicDogFilter.Create(null, "ready", null, null);

        var result = filter.Apply(SampleDogs());

        Assert.Equal(new[] { "Rocco", "Biscuit" }, Names(result));
    }

    [Fact]
    public void Apply_FiltersInFosterCare_ToFosteredDogs()
    {
        var filter = PublicDogFilter.Create(null, "FOSTER", null, null);

        var result = filter.Apply(SampleDogs());

        Assert.Equal(new[] { "Poppy", "Maple" }, Names(result));
    }

    [Fact]
    public void Apply_CombinesSizeAndStatus()
    {
        var filter = PublicDogFilter.Create("Small", "foster", null, null);

        var result = filter.Apply(SampleDogs());

        Assert.Equal("Poppy", Assert.Single(result).Name);
    }

    [Fact]
    public void Apply_ReturnsNothing_WhenNoDogMatches()
    {
        var filter = PublicDogFilter.Create("Large", "foster", null, null);

        var result = filter.Apply(SampleDogs());

        Assert.Empty(result);
    }

    [Theory]
    [InlineData("Huge")]
    [InlineData("<script>")]
    [InlineData("'; DROP TABLE dogs;--")]
    [InlineData("")]
    public void Create_IgnoresUnknownSize(string size)
    {
        var filter = PublicDogFilter.Create(size, null, null, null);

        Assert.Null(filter.Size);
        Assert.False(filter.IsActive);
        Assert.Equal(4, filter.Apply(SampleDogs()).Count);
    }

    [Fact]
    public void Create_IgnoresUnknownStatusAndSort()
    {
        var filter = PublicDogFilter.Create(null, "adopted", "price", null);

        Assert.Null(filter.Status);
        Assert.Equal(PublicDogFilter.SortNewest, filter.Sort);
    }

    [Theory]
    [InlineData(null, 8)]
    [InlineData(0, 8)]
    [InlineData(-5, 8)]
    [InlineData(16, 16)]
    [InlineData(100000, 200)]
    public void Create_ClampsTake(int? take, int expected)
    {
        var filter = PublicDogFilter.Create(null, null, null, take);

        Assert.Equal(expected, filter.Take);
    }

    [Fact]
    public void IsActive_IsTrueOnlyForSizeOrStatus()
    {
        Assert.False(PublicDogFilter.Create(null, null, "name", 24).IsActive);
        Assert.True(PublicDogFilter.Create("Small", null, null, null).IsActive);
        Assert.True(PublicDogFilter.Create(null, "ready", null, null).IsActive);
    }

    [Fact]
    public void ListViewModel_ReportsMoreDogs_WhenPageIsShorterThanMatches()
    {
        var viewModel = new PublicDogListViewModel
        {
            Dogs = SampleDogs().Take(2).ToList(),
            MatchCount = 4,
            Filter = PublicDogFilter.Create(null, null, null, null)
        };

        Assert.True(viewModel.HasMore);
        Assert.Equal(16, viewModel.NextTake);

        viewModel.Dogs = SampleDogs();

        Assert.False(viewModel.HasMore);
    }
}
