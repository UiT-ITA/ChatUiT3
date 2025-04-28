using Azure;
using Azure.AI.OpenAI;
using ChatUitReact.Server.Models;
using OpenAI.Chat;
using System.ClientModel;
using System.Runtime.CompilerServices;
using System.Text;

namespace ChatUitReact.Server.Services
{
    public class OpenAIService
    {
        private readonly AzureOpenAIClient _client;
        private readonly string _deploymentName;
        private readonly ILogger<OpenAIService> _logger;

        public OpenAIService(IConfiguration configuration, ILogger<OpenAIService> logger)
        {
            var endpoint = configuration["AzureOpenAI:Endpoint"] ?? 
                throw new InvalidOperationException("Azure OpenAI endpoint not configured");
            var apiKey = configuration["AzureOpenAI:ApiKey"] ??
                throw new InvalidOperationException("Azure OpenAI API key not configured");
            _deploymentName = configuration["AzureOpenAI:DeploymentName"] ??
                throw new InvalidOperationException("Azure OpenAI deployment name not configured");

            _client = new AzureOpenAIClient(new Uri(endpoint), new AzureKeyCredential(apiKey));
            _logger = logger;
        }

        // Method for standard, non-streaming completions
        public async Task<CompletionResponse> GetCompletionAsync(CompletionRequest request)
        {
            try
            {
                var options = new ChatCompletionOptions
                {
                    Temperature = request.Temperature,
                    MaxOutputTokenCount = request.MaxTokens
                };

                var messages = new List<ChatMessage>()
                {
                    new UserChatMessage(request.Prompt)
                };

                var chatClient = _client.GetChatClient(_deploymentName);

                var response = await chatClient.CompleteChatAsync(messages, options);


                return new CompletionResponse
                {
                    Text = response.Value.Content[0].Text,
                    TokensUsed = response.Value.Usage.TotalTokenCount,
                    Success = true
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting completion from Azure OpenAI");
                return new CompletionResponse
                {
                    Success = false,
                    ErrorMessage = $"Error: {ex.Message}"
                };
            }
        }

        // Method for streaming completions
        public async IAsyncEnumerable<CompletionResponse> StreamCompletionAsync(
            CompletionRequest request,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            AsyncCollectionResult<StreamingChatCompletionUpdate>? completionUpdates = null;
            bool hasInitError = false;
            string? errorMessage = null;
            
            // Set up the client and options
            var options = new ChatCompletionOptions
            {
                Temperature = request.Temperature,
                MaxOutputTokenCount = request.MaxTokens
            };

            var messages = new List<ChatMessage>()
            {
                new UserChatMessage(request.Prompt)
            };

            var chatClient = _client.GetChatClient(_deploymentName);
            
            // Try to initialize the stream but catch errors outside of any yield
            try
            {
                completionUpdates = chatClient.CompleteChatStreamingAsync(messages, options, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initializing streaming completion from Azure OpenAI");
                hasInitError = true;
                errorMessage = $"Error initializing stream: {ex.Message}";
            }
            
            // Handle initialization error outside try/catch
            if (hasInitError || completionUpdates == null)
            {
                yield return new CompletionResponse
                {
                    Success = false,
                    ErrorMessage = errorMessage ?? "Failed to initialize completion stream"
                };
                yield break;
            }
            
            // Process the streaming updates
            var enumerator = completionUpdates.GetAsyncEnumerator(cancellationToken);
            
            while (true)
            {
                bool moveNextSuccess = false;
                StreamingChatCompletionUpdate? update = null;
                Exception? iterationException = null;
                
                // Try to move to the next item but catch errors outside of yields
                try
                {
                    moveNextSuccess = await enumerator.MoveNextAsync();
                    if (moveNextSuccess)
                    {
                        update = enumerator.Current;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error advancing stream from Azure OpenAI");
                    iterationException = ex;
                }
                
                // Handle stream completion
                if (!moveNextSuccess)
                {
                    break;
                }
                
                // Handle iteration exception outside try/catch
                if (iterationException != null)
                {
                    yield return new CompletionResponse
                    {
                        Success = false,
                        ErrorMessage = $"Error processing stream: {iterationException.Message}"
                    };
                    yield break;
                }
                
                // Process the update if we have one
                if (update != null && update.ContentUpdate.Count > 0)
                {
                    yield return new CompletionResponse
                    {
                        Text = update.ContentUpdate[0].Text,
                        Success = true
                    };
                }
            }
            
            // Clean up the enumerator
            await enumerator.DisposeAsync();
        }
    }
}
