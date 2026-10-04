using System.Threading.RateLimiting;
using KZNDoghouse.Web.Configuration;
using KZNDoghouse.Web.Constants;
using KZNDoghouse.Web.Repositories;
using KZNDoghouse.Web.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 55 * 1024 * 1024;
});

builder.Services.Configure<SupabaseSettings>(
    builder.Configuration.GetSection(
        SupabaseSettings.SectionName));

builder.Services.AddScoped<
    ISupabaseClientFactory,
    SupabaseClientFactory>();

builder.Services.AddScoped<
    IAuthService,
    AuthService>();

builder.Services.AddScoped<AuthCookieEvents>();

builder.Services.AddScoped<
    IUserProfileRepository,
    UserProfileRepository>();

builder.Services.AddScoped<
    IUserService,
    UserService>();

builder.Services
    .AddAuthentication(
        CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Auth/Login";
        options.AccessDeniedPath = "/Auth/AccessDenied";
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.EventsType = typeof(AuthCookieEvents);
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(
        AuthorizationPolicies.PortalAccess,
        policy =>
        {
            policy.RequireRole(
                UserRoles.Staff,
                UserRoles.Administrator);
        });

    options.AddPolicy(
        AuthorizationPolicies.VetMedicalAccess,
        policy =>
        {
            policy.RequireRole(
                UserRoles.Vet);
        });
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode =
        StatusCodes.Status429TooManyRequests;

    options.AddPolicy(
        RateLimitPolicies.Login,
        context =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: GetClientKey(context),
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(5),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

    options.AddPolicy(
        RateLimitPolicies.Register,
        context =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: GetClientKey(context),
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 5,
                    Window = TimeSpan.FromMinutes(10),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

    options.OnRejected = async (context, cancellationToken) =>
    {
        var isRegister =
            context.HttpContext.Request.Path
                .StartsWithSegments(
                    "/Auth/Register");

        var target = isRegister
            ? "/Auth/Register?rateLimited=true"
            : "/Auth/Login?rateLimited=true";

        context.HttpContext.Response.Redirect(target);

        await Task.CompletedTask;
    };
});

builder.Services.AddScoped<IDogRepository, DogRepository>();
builder.Services.AddScoped<IDogImageRepository, DogImageRepository>();
builder.Services.AddScoped<IMediaStorageService, MediaStorageService>();
builder.Services.AddScoped<IDogImageService, DogImageService>();
builder.Services.AddScoped<IDogService, DogService>();
builder.Services.AddScoped<IDogMedicalRecordRepository, DogMedicalRecordRepository>();
builder.Services.AddScoped<IDogNoteRepository, DogNoteRepository>();
builder.Services.AddScoped<IDogMedicalService, DogMedicalService>();
builder.Services.AddScoped<IFosteringRecordRepository, FosteringRecordRepository>();
builder.Services.AddScoped<IFosteringService, FosteringService>();
builder.Services.AddScoped<IAvailabilitySlotRepository, AvailabilitySlotRepository>();
builder.Services.AddScoped<IAvailabilityService, AvailabilityService>();
builder.Services.AddScoped<ICalendarEventRepository, CalendarEventRepository>();
builder.Services.AddScoped<ICalendarEventService, CalendarEventService>();
builder.Services.AddScoped<IFosterApplicationRepository, FosterApplicationRepository>();
builder.Services.AddScoped<IFosterApplicationService, FosterApplicationService>();
builder.Services.AddScoped<IContactMessageRepository, ContactMessageRepository>();
builder.Services.AddScoped<IContactMessageService, ContactMessageService>();
builder.Services.AddScoped<IInventoryRepository, InventoryRepository>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<IAppNotificationRepository, AppNotificationRepository>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IPortalDashboardService, PortalDashboardService>();
builder.Services.AddScoped<IVetAccessRepository, VetAccessRepository>();
builder.Services.AddScoped<IVetAccessService, VetAccessService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] =
        "strict-origin-when-cross-origin";

    await next();
});

app.UseHttpsRedirection();

app.UseRouting();

app.UseRateLimiter();

app.UseAuthentication();

app.UseAuthorization();

app.MapStaticAssets();

app.MapControllers();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();

static string GetClientKey(HttpContext context)
{
    return context.Connection.RemoteIpAddress
        ?.ToString()
        ?? "unknown";
}
