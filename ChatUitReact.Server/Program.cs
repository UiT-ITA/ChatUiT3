using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Identity.Web;
using Microsoft.IdentityModel.Logging;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment())
{
    IdentityModelEventSource.ShowPII = true;
}


// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        string[] allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() 
            ?? new[] { "https://localhost:54979" };
            
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // This is critical for SignalR
    });
});

// Authentication and Authorization
builder.Services.AddAuthorization();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));

builder.Services.Configure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
{
    // Store the token for WebSockets to use after the initial HTTP handshake
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            // Extract token from the query string for SignalR
            var accessToken = context.Request.Query["access_token"];

            // If the request is for a hub...
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) &&
                (path.StartsWithSegments("/testHub") || path.StartsWithSegments("/testAuthHub") || path.StartsWithSegments("/chatHub")))
            {
                // Set the token for authentication
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});


builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddSignalR();

// Register services
builder.Services.AddSingleton<DatabaseService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<ChatNotificationService>();

var app = builder.Build();

app.UseDefaultFiles();
app.MapStaticAssets();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "OpenAPI V1");
    });
    app.UseCors("AllowReactApp");
}

//app.UseRouting();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/chatHub");
app.MapHub<TestHub>("/testHub");
app.MapHub<TestAuthHub>("/testAuthHub");
app.MapFallbackToFile("/index.html");

app.Run();