using ChatUiT.Server.Telemetry;
using Microsoft.AspNetCore.Http;

namespace ChatUiT.Server.Tests;

/// <summary>Checks the client.app, client.version and client.session fields read from a request.</summary>
public class TelemetryContextTests
{
    [Theory]
    [InlineData("web")]
    [InlineData("word")]
    [InlineData("excel")]
    [InlineData("powerpoint")]
    [InlineData("outlook")]
    [InlineData("teams")]
    public void Known_client_header_is_the_client_app(string client)
    {
        var request = Request("/api/v1/responses", client);

        Assert.Equal(client, Field(request, FieldNames.ClientApp));
    }

    [Theory]
    [InlineData("word")]
    [InlineData("teams")]
    public void Known_client_query_value_is_the_client_app(string client)
    {
        var request = Request("/apphub", null);
        request.QueryString = new QueryString($"?client={client}&client_version=abc123&client_session=s-1");

        Assert.Equal(client, Field(request, FieldNames.ClientApp));
        Assert.Equal("abc123", Field(request, FieldNames.ClientVersion));
        Assert.Equal("s-1", Field(request, FieldNames.ClientSession));
    }

    [Theory]
    [InlineData("/api/v1/responses", null, "api")]
    [InlineData("/api/v1/responses", "office", "api")]
    [InlineData("/api/chats", null, "unknown")]
    [InlineData("/api/chats", "office", "unknown")]
    public void Missing_or_unknown_client_falls_back_by_path(string path, string? client, string expected)
    {
        var request = Request(path, client);

        Assert.Equal(expected, Field(request, FieldNames.ClientApp));
    }

    [Fact]
    public void Version_and_session_headers_are_read()
    {
        var request = Request("/api/v1/responses", "outlook");
        request.Headers[TelemetryContext.VersionHeader] = "d2e62681280b";
        request.Headers[TelemetryContext.SessionHeader] = "3f2b9c1e-0a4d-4e7b-9c1a-2b3c4d5e6f70";

        Assert.Equal("d2e62681280b", Field(request, FieldNames.ClientVersion));
        Assert.Equal("3f2b9c1e-0a4d-4e7b-9c1a-2b3c4d5e6f70", Field(request, FieldNames.ClientSession));
    }

    private static HttpRequest Request(string path, string? client)
    {
        var request = new DefaultHttpContext().Request;
        request.Path = path;
        if (client != null)
        {
            request.Headers[TelemetryContext.ClientHeader] = client;
        }
        return request;
    }

    private static object? Field(HttpRequest request, string name) =>
        TelemetryContext.Fields(null, request).FirstOrDefault(f => f.Key == name).Value;
}
