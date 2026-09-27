using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace KZNDoghouse.Web.Models;

[Table("inventory_items")]
public class InventoryItem : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("category")]
    public string? Category { get; set; }

    [Column("quantity")]
    public int Quantity { get; set; }

    [Column("unit")]
    public string? Unit { get; set; }

    [Column("low_stock_threshold")]
    public int LowStockThreshold { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    public bool IsLowStock() => Quantity <= LowStockThreshold;
}