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

builder.Services.Configure<GoogleMapsSettings>(
    builder.Configuration.GetSection(
        GoogleMapsSettings.SectionName));

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});

builder.Services.AddMemoryCache();

builder.Services.AddScoped<
    ISupabaseClientFactory,
    SupabaseClientFactory>();

builder.Services.AddScoped<
    IAuthService,
    AuthService>();

builder.Services.AddSingleton<
    IPasswordResetStateService,
    PasswordResetStateService>();

builder.Services.AddScoped<
    IApiAuthenticationService,
    ApiAuthenticationService>();

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
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
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

    options.AddPolicy(
        RateLimitPolicies.PasswordReset,
        context =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: GetClientKey(context),
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(15),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

    options.AddPolicy(
        RateLimitPolicies.Api,
        context =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: GetClientKey(context),
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 120,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));

    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.HttpContext.Request.Path.StartsWithSegments("/api"))
        {
            context.HttpContext.Response.StatusCode =
                StatusCodes.Status429TooManyRequests;

            await context.HttpContext.Response.WriteAsJsonAsync(
                new
                {
                    success = false,
                    message = "Too many API requests. Please wait before trying again."
                },
                cancellationToken);

            return;
        }

        var path = context.HttpContext.Request.Path;

        var target =
            path.StartsWithSegments("/Auth/Register")
                ? "/Auth/Register?rateLimited=true"
            : path.StartsWithSegments("/Auth/ForgotPassword")
                ? "/Auth/ForgotPassword?rateLimited=true"
            : path.StartsWithSegments("/Auth/ResetCode")
                ? "/Auth/ResetCode?rateLimited=true"
            : "/Auth/Login?rateLimited=true";

        context.HttpContext.Response.Redirect(target);
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
builder.Services.AddScoped<IDogDocumentService, DogDocumentService>();
builder.Services.AddScoped<IDogVideoService, DogVideoService>();
builder.Services.AddScoped<IMedicalAlertService, MedicalAlertService>();
builder.Services.AddScoped<IFosteringRecordRepository, FosteringRecordRepository>();
builder.Services.AddScoped<IAdoptionRecordRepository, AdoptionRecordRepository>();
builder.Services.AddScoped<IFosteringService, FosteringService>();
builder.Services.AddScoped<IAvailabilitySlotRepository, AvailabilitySlotRepository>();
builder.Services.AddScoped<IAvailabilityService, AvailabilityService>();
builder.Services.AddScoped<ICalendarEventRepository, CalendarEventRepository>();
builder.Services.AddScoped<ICalendarEventService, CalendarEventService>();
builder.Services.AddScoped<IEventAssignmentRepository, EventAssignmentRepository>();
builder.Services.AddScoped<IEventRegistrationService, EventRegistrationService>();
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

app.UseExceptionHandler("/Home/Error");

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["X-Permitted-Cross-Domain-Policies"] = "none";
    context.Response.Headers["Permissions-Policy"] =
        "camera=(), microphone=(), geolocation=()";
    context.Response.Headers["Referrer-Policy"] =
        "strict-origin-when-cross-origin";

    await next();
});

app.UseHttpsRedirection();

app.UseResponseCompression();

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

public partial class Program
{
}