using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text;

namespace ChatUitReact.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "DefaultAuth")]
    public class AiCompletionController : ControllerBase
    {
        private readonly OpenAIService _openAIService;
        private readonly ILogger<AiCompletionController> _logger;

        public AiCompletionController(OpenAIService openAIService, ILogger<AiCompletionController> logger)
        {
            _openAIService = openAIService;
            _logger = logger;
        }

        [HttpPost("complete")]
        public async Task<ActionResult<CompletionResponse>> GetCompletion([FromBody] CompletionRequest request)
        {
            // Log who's accessing the API
            var isApiClient = User.HasClaim("ApiClient", "true");
            var username = User.Identity?.Name;

            if (isApiClient)
            {
                _logger.LogInformation("API client requested AI completion");
            }
            else
            {
                _logger.LogInformation("User {Username} requested AI completion", username);
            }

            if (string.IsNullOrWhiteSpace(request.Prompt))
            {
                return BadRequest(new CompletionResponse
                {
                    Success = false,
                    ErrorMessage = "Prompt cannot be empty"
                });
            }
            
            var result = await _openAIService.GetCompletionAsync(request);
            return result.Success ? Ok(result) : StatusCode(500, result);
        }

        [HttpPost("stream")]
        public IActionResult StreamCompletion([FromBody] CompletionRequest request)
        {
            // Log who's accessing the API
            var isApiClient = User.HasClaim("ApiClient", "true");
            var username = User.Identity?.Name;

            if (isApiClient)
            {
                _logger.LogInformation("API client requested streaming AI completion");
            }
            else
            {
                _logger.LogInformation("User {Username} requested streaming AI completion", username);
            }

            if (string.IsNullOrWhiteSpace(request.Prompt))
            {
                return BadRequest(new CompletionResponse
                {
                    Success = false,
                    ErrorMessage = "Prompt cannot be empty"
                });
            }

            // Return a streamed response
            return new StreamingResult(_openAIService.StreamCompletionAsync(request));
        }

        // Custom IActionResult implementation for streaming
        private class StreamingResult : IActionResult
        {
            private readonly IAsyncEnumerable<CompletionResponse> _responseStream;

            public StreamingResult(IAsyncEnumerable<CompletionResponse> responseStream)
            {
                _responseStream = responseStream;
            }

            public async Task ExecuteResultAsync(ActionContext context)
            {
                var response = context.HttpContext.Response;
                response.ContentType = "text/event-stream";
                response.Headers.Add("Cache-Control", "no-cache");
                response.Headers.Add("Connection", "keep-alive");

                await foreach (var chunk in _responseStream)
                {
                    if (!chunk.Success)
                    {
                        // Send error event
                        await WriteEventAsync(response, "error", $"{{\"message\":\"{chunk.ErrorMessage}\"}}");
                        break;
                    }

                    // Send data event with the chunk text
                    await WriteEventAsync(response, "data", $"{{\"text\":\"{EscapeJsonString(chunk.Text)}\"}}");

                    // Flush to ensure the client receives each chunk immediately
                    await response.Body.FlushAsync();
                }

                // End of stream
                await WriteEventAsync(response, "done", "{}");
            }

            private static async Task WriteEventAsync(HttpResponse response, string eventType, string data)
            {
                var eventBuilder = new StringBuilder();
                eventBuilder.Append($"event: {eventType}\n");
                eventBuilder.Append($"data: {data}\n\n");
                await response.WriteAsync(eventBuilder.ToString());
            }

            private static string EscapeJsonString(string text)
            {
                return text.Replace("\\", "\\\\")
                           .Replace("\"", "\\\"")
                           .Replace("\n", "\\n")
                           .Replace("\r", "\\r")
                           .Replace("\t", "\\t");
            }
        }
    }
}
