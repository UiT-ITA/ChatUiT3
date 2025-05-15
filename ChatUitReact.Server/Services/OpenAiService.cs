namespace ChatUitReact.Server.Services;

using Azure;
using Azure.AI.OpenAI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ChatUitReact.Server.Models;
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using System.Text.Json;
using System.Runtime.CompilerServices;
using System.Threading;
using OpenAI;
using OpenAI.Chat;

public class OpenAiService
{
    private readonly AzureOpenAIClient _client;
    private readonly ILogger<OpenAiService> _logger;
    private readonly Dictionary<string, ChatClient> _chatClients = new();

    public OpenAiService(IConfiguration configuration, ILogger<OpenAiService> logger)
    {
        _logger = logger;
        
        // Get Azure OpenAI configuration
        var endpoint = configuration["AzureOpenAI:Endpoint"];
        var key = configuration["AzureOpenAI:ApiKey"];
        
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(key))
        {
            throw new ArgumentException("Azure OpenAI endpoint and key must be configured");
        }

        // Create the Azure OpenAI client
        _client = new AzureOpenAIClient(
            new Uri(endpoint),
            new AzureKeyCredential(key));
    }

    // Get or create a chat client for a deployment
    private ChatClient GetChatClient(string deploymentId)
    {
        if (!_chatClients.TryGetValue(deploymentId, out var chatClient))
        {
            chatClient = _client.GetChatClient(deploymentId);
            _chatClients[deploymentId] = chatClient;
        }
        return chatClient;
    }

    // Standard chat completion
    public async Task<AiChatMessage> GetChatCompletionAsync(
        List<AiChatMessage> messages, 
        AiModel model,
        AiModelSettings settings)
    {
        try
        {
            var chatClient = GetChatClient(model.ModelId);
            var chatMessages = ConvertToChatMessages(messages);
            var options = BuildCompletionOptions(settings);
            
            var completion = await chatClient.CompleteChatAsync(chatMessages, options);
            
            return ConvertToAiChatMessage(completion);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat completion");
            throw;
        }
    }

    // Streaming chat completion - returns collected chunks to avoid yielding in try-catch
    public async Task<List<string>> GetChatCompletionStreamChunksAsync(
        List<AiChatMessage> messages,
        AiModel model,
        AiModelSettings settings,
        CancellationToken cancellationToken = default)
    {
        var results = new List<string>();
        
        try
        {
            var chatClient = GetChatClient(model.ModelId);
            var chatMessages = ConvertToChatMessages(messages);
            var options = BuildCompletionOptions(settings);
            
            await foreach (var update in chatClient.CompleteChatStreamingAsync(chatMessages, options, cancellationToken))
            {
                foreach (var contentPart in update.ContentUpdate)
                {
                    if (!string.IsNullOrEmpty(contentPart.Text))
                    {
                        results.Add(contentPart.Text);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming chat completion");
            throw;
        }
        
        return results;
    }

    // Support for tool/function calling
    public async Task<AiChatMessage> GetChatCompletionWithToolsAsync(
        List<AiChatMessage> messages,
        AiModel model,
        AiModelSettings settings,
        List<AiChatTool> tools)
    {
        try
        {
            var chatClient = GetChatClient(model.ModelId);
            var chatMessages = ConvertToChatMessages(messages);
            var options = BuildCompletionOptions(settings);

            // Add tools to the options
            foreach (var tool in tools)
            {
                options.Tools.Add(ConvertToOpenAITool(tool));
            }
            
            var completion = await chatClient.CompleteChatAsync(chatMessages, options);
            
            return ConvertToAiChatMessage(completion);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat completion with tools");
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
                //case AiChatRole.User:
                //    result.Add(new UserChatMessage(message.Content));
                //    break;
                //case AiChatRole.Assistant:
                //    result.Add(new AssistantChatMessage(message.Content));
                //    break;
                //case AiChatRole.System:
                //    result.Add(new SystemChatMessage(message.Content));
                //    break;
            }
        }
        
        return result;
    }

    private ChatCompletionOptions BuildCompletionOptions(AiModelSettings settings)
    {
        // Create options with available properties in the current version
        var options = new ChatCompletionOptions
        {
            Temperature = settings.Temperature,
            TopP = settings.TopP,
            FrequencyPenalty = settings.FrequencyPenalty,
            PresencePenalty = settings.PresencePenalty
        };
        
        // Note: MaxTokens is handled differently in different versions
        // We'll let the API use its default max tokens setting
        
        return options;
    }

    private AiChatMessage ConvertToAiChatMessage(ChatCompletion completion)
    {
        return new AiChatMessage
        {
            Role = AiChatRole.Assistant,
            //Content = completion.Content?[0]?.Text ?? string.Empty
        };
    }

    private ChatTool ConvertToOpenAITool(AiChatTool tool)
    {
        // Use the newer SDK pattern for tools
        return ChatTool.CreateFunctionTool(
            functionName: tool.Name,
            functionDescription: tool.Description,
            functionParameters: BinaryData.FromString(tool.Schema)
        );
    }
}
