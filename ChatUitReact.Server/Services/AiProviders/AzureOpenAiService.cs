namespace ChatUitReact.Server.Services;

using Azure;
using Azure.AI.OpenAI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ChatUitReact.Server.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading;
using OpenAI.Chat;
using System.ClientModel;

public class AzureOpenAiService
{
    private readonly AzureOpenAIClient _client;
    private readonly ILogger<AzureOpenAiService> _logger;

    public AzureOpenAiService(IConfiguration configuration, ILogger<AzureOpenAiService> logger)
    {
        _logger = logger;

        // Get Azure OpenAI configuration
        // Will be replaced with propper configuration management
        var endpoint = configuration["AzureOpenAI:Endpoint"];
        var key = configuration["AzureOpenAI:ApiKey"];
        
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(key))
        {
            throw new ArgumentException("Azure OpenAI endpoint and key must be configured");
        }

        _client = new AzureOpenAIClient(
            new Uri(endpoint),
            new AzureKeyCredential(key));
    }


    public async Task<string> GetChatCompletionAsync(
        List<AiChatMessage> messages, 
        AiChatSettings settings,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var chatClient = _client.GetChatClient(settings.Model.ModelId);
            var chatMessages = ConvertToChatMessages(messages);
            if (!string.IsNullOrEmpty(settings.SystemPrompt))
            {
                chatMessages.Insert(0, new SystemChatMessage(settings.SystemPrompt));
            }
            var options = BuildCompletionOptions(settings.ModelSettings);
            
            var completion = await chatClient.CompleteChatAsync(chatMessages, options, cancellationToken);
            
            var response = completion.Value.Content[0].Text;


            _logger.LogInformation("Chat completion response: {Response}", response);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat completion");
            throw;
        }
    }
    
    // Used for testing purposes
    public async Task<string> GetChatCompletionAsync(
        List<AiChatMessage> messages,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var chatClient = _client.GetChatClient("gpt-4o-mini");
            var chatMessages = ConvertToChatMessages(messages);
            var options = BuildCompletionOptions(null);

            var completion = await chatClient.CompleteChatAsync(chatMessages, options, cancellationToken);

            var response = completion.Value.Content[0].Text;

            _logger.LogInformation("Chat completion response: {Response}", response);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat completion");
            throw;
        }
    }

    // Streaming chat completion - returns collected chunks to avoid yielding in try-catch
    public async Task<AsyncCollectionResult<StreamingChatCompletionUpdate>> GetChatCompleteionStreamingAsync(
        List<AiChatMessage> messages,
        AiModel model,
        AiModelSettings settings,
        CancellationToken cancellationToken = default)
    {
        var results = new List<string>();

        try
        {
            var chatClient = _client.GetChatClient(model.ModelId);
            var chatMessages = ConvertToChatMessages(messages);
            var options = BuildCompletionOptions(settings);

            return chatClient.CompleteChatStreamingAsync(chatMessages, options, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming chat completion");
            throw;
        }
    }
    
    // Used for testing purposes
        public async Task<AsyncCollectionResult<StreamingChatCompletionUpdate>> GetChatCompletionStreamingAsync(
    List<AiChatMessage> messages,
    CancellationToken cancellationToken = default)
    {
        var results = new List<string>();

        try
        {
            var chatClient = _client.GetChatClient("gpt-4o");
            var chatMessages = ConvertToChatMessages(messages);
            var options = BuildCompletionOptions(null);

            return chatClient.CompleteChatStreamingAsync(chatMessages, options, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming chat completion");
            throw;
        }
    }

   
    public async Task<string> GetChatName(string prompt)
    {
        try
        {
            var chatClient = _client.GetChatClient("gpt-4o-mini");
            var chatMessages = new List<ChatMessage> {
                new SystemChatMessage("Create a name for this chat based on the users initial message. The name must be shorter than 30 characters. Make the name as descriptive as possible. You should **only** respond with the name, exactly the way the name should be written. It should have no quotes around it. It should not have any formating. It will be set directly as the name of the chat. The user's message:\n\n" + prompt)
            };
            var options = new ChatCompletionOptions
            {
                Temperature = 1f,
                MaxOutputTokenCount = 50,
            };
            var completion = await chatClient.CompleteChatAsync(chatMessages, options);

            var response = completion.Value.Content[0].Text.Trim();

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat name");
            throw;
        }
    }



    // Helper methods
    private List<ChatMessage> ConvertToChatMessages(List<AiChatMessage> messages)
    {
        var result = new List<ChatMessage>();
        
        foreach (var message in messages)
        {
            switch (message.Role)
            {
                case AiChatRole.User:
                    result.Add(new UserChatMessage(message.Content));
                    break;
                case AiChatRole.Assistant:
                    result.Add(new AssistantChatMessage(message.Content));
                    break;
                case AiChatRole.System:
                    result.Add(new SystemChatMessage(message.Content));
                    break;
            }
        }
        
        return result;
    }

    private ChatCompletionOptions BuildCompletionOptions(AiModelSettings? settings)
    {
        // Create options with available properties in the current version
        var options = new ChatCompletionOptions
        {
            Temperature = settings?.Temperature ?? 0.5f
        };
        
        return options;
    }

}
