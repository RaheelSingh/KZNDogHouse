using KZNDoghouse.Web.Models;
using Supabase.Postgrest.Attributes;
using Xunit;

namespace KZNDoghouse.Web.Tests;

public class AdoptionRecordTests
{
    [Fact]
    public void NewAdoption_IsPendingPaperwork_NotAutomaticallyAdopted()
    {
        var record = new AdoptionRecord { DogId = Guid.NewGuid(), AdopterName = "Example" };
        Assert.Equal("Pending paperwork", record.Status);
        Assert.Null(record.AdoptedAt);
    }

    [Fact]
    public void Documents_LinkToSpecificAdoptionRecord()
    {
        var recordId = Guid.NewGuid();
        var document = new DogDocument { AdoptionRecordId = recordId, Category = "Adoption" };
        Assert.Equal(recordId, document.AdoptionRecordId);
    }
}
